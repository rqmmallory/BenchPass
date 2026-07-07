import { NextResponse, type NextRequest } from "next/server";
import { requireShopApi } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { shopIsWritable, readOnlyReason } from "@/lib/plan";
import { deliverMessage } from "@/lib/notify";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type SendBody = {
  ticket_id?: unknown;
  channel?: unknown;
  body?: unknown;
};

export async function POST(request: NextRequest) {
  const ctx = await requireShopApi();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!shopIsWritable(ctx.shop)) {
    return NextResponse.json({ error: readOnlyReason(ctx.shop) }, { status: 403 });
  }

  const raw = (await request.json().catch(() => null)) as SendBody | null;
  const ticketId = typeof raw?.ticket_id === "string" ? raw.ticket_id : "";
  const channel = raw?.channel === "email" ? "email" : raw?.channel === "sms" ? "sms" : null;
  const body = typeof raw?.body === "string" ? raw.body.trim().slice(0, 1200) : "";

  if (!UUID_RE.test(ticketId) || !channel || !body) {
    return NextResponse.json({ error: "Invalid message" }, { status: 400 });
  }

  const supabase = createClient();
  const { data: ticket } = await supabase
    .from("tickets")
    .select("id, customers(name, phone, email)")
    .eq("id", ticketId)
    .maybeSingle();

  if (!ticket || !ticket.customers) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  const outcome = await deliverMessage({
    supabase,
    ticketId: ticket.id,
    channel,
    body,
    shop: ctx.shop,
    customer: ticket.customers,
  });

  if (!outcome.ok) {
    return NextResponse.json({ error: outcome.error }, { status: 502 });
  }

  return NextResponse.json({ ok: true, channel });
}
