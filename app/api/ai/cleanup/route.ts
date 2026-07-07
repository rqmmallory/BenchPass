import { NextResponse, type NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { requireShopApi } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SYSTEM_PROMPT =
  "You are writing a short, professional, customer-facing repair summary for a musical instrument repair shop. Write in plain English — no technical jargon the customer would not understand. Warm but concise. 2–4 sentences. Do not include pricing. Do not start with \"I\" or the shop name. End with one sentence describing what the customer should notice when they play it.";

/**
 * "Clean up my notes" — turns terse bench notes into a customer-facing summary.
 * Streams plain text; the client persists the final text via PATCH /api/tickets/[id].
 */
export async function POST(request: NextRequest) {
  const ctx = await requireShopApi();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as {
    ticket_id?: unknown;
    internal_notes?: unknown;
  } | null;

  const ticketId = typeof body?.ticket_id === "string" ? body.ticket_id : "";
  const notes =
    typeof body?.internal_notes === "string" ? body.internal_notes.trim() : "";

  if (!UUID_RE.test(ticketId) || !notes) {
    return NextResponse.json(
      { error: "ticket_id and internal_notes are required" },
      { status: 400 },
    );
  }

  // Ownership check — RLS scopes this select to the caller's shop.
  const supabase = createClient();
  const { data: ticket } = await supabase
    .from("tickets")
    .select("id")
    .eq("id", ticketId)
    .maybeSingle();
  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    const stream = anthropic.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: notes.slice(0, 8000) }],
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              controller.enqueue(encoder.encode(event.delta.text));
            }
          }
          controller.close();
        } catch {
          controller.error(new Error("stream failed"));
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    // The client shows "AI unavailable — write a summary manually".
    return NextResponse.json({ error: "AI unavailable" }, { status: 502 });
  }
}
