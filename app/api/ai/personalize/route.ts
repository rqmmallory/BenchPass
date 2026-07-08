import { NextResponse, type NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { requireShopApi } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { STATUS_LABELS, isTicketStatus } from "@/lib/status";
import { instrumentLabel } from "@/lib/templates";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SYSTEM_PROMPT =
  "You lightly rephrase a short SMS from a musical instrument repair shop so it reads naturally and personally, using the ticket context provided. Keep the same meaning and tone of a friendly local shop. Preserve every URL, price, name, and factual detail exactly. Stay under 320 characters. Return only the message text — no quotes, no preamble.";

/**
 * "Personalise →" in the send-message panel: a quick claude-haiku-4-5 pass
 * that varies the template language for this specific ticket.
 */
export async function POST(request: NextRequest) {
  const ctx = await requireShopApi();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const raw = (await request.json().catch(() => null)) as {
    ticket_id?: unknown;
    body?: unknown;
  } | null;
  const ticketId = typeof raw?.ticket_id === "string" ? raw.ticket_id : "";
  const body = typeof raw?.body === "string" ? raw.body.trim().slice(0, 1200) : "";

  if (!UUID_RE.test(ticketId) || !body) {
    return NextResponse.json(
      { error: "ticket_id and body are required" },
      { status: 400 },
    );
  }

  // Ownership check via RLS, and ticket context for the model.
  const supabase = createClient();
  const { data: ticket } = await supabase
    .from("tickets")
    .select("status, problem, customers(name), instruments(type, make, model)")
    .eq("id", ticketId)
    .maybeSingle();
  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  const context = [
    `Customer: ${ticket.customers?.name ?? "unknown"}`,
    `Instrument: ${instrumentLabel(ticket.instruments)}`,
    `Repair status: ${isTicketStatus(ticket.status) ? STATUS_LABELS[ticket.status] : ticket.status}`,
    `Reported problem: ${ticket.problem}`,
    "",
    "Message to personalise:",
    body,
  ].join("\n");

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 300,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: context }],
    });
    const block = response.content[0];
    const personalized = block?.type === "text" ? block.text.trim() : "";
    if (!personalized) throw new Error("empty response");
    return NextResponse.json({ body: personalized });
  } catch {
    return NextResponse.json({ error: "AI unavailable" }, { status: 502 });
  }
}
