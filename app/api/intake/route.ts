import { NextResponse, type NextRequest } from "next/server";
import { requireShopApi } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { shopIsWritable, readOnlyReason } from "@/lib/plan";
import { normalizePhone } from "@/lib/format";
import { resolveTemplate } from "@/lib/templates";
import { buildTemplateVars, deliverMessage } from "@/lib/notify";
import { INSTRUMENT_TYPES } from "@/lib/status";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type IntakeBody = {
  ticket_id?: unknown; // client-generated so photos can upload before save
  customer_id?: unknown;
  customer_name?: unknown;
  customer_phone?: unknown;
  problem?: unknown;
  instrument_id?: unknown;
  instrument?: {
    type?: unknown;
    make?: unknown;
    model?: unknown;
    serial?: unknown;
  } | null;
  photo_paths?: unknown;
  quote_cents?: unknown;
  deposit_cents?: unknown;
};

function text(value: unknown, maxLen: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLen) : "";
}

function cents(value: unknown): number | null {
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= 100_000_00
    ? value
    : null;
}

export async function POST(request: NextRequest) {
  const ctx = await requireShopApi();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!shopIsWritable(ctx.shop)) {
    return NextResponse.json({ error: readOnlyReason(ctx.shop) }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as IntakeBody | null;
  if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });

  // The only hard requirements: who it belongs to, and what's wrong.
  const problem = text(body.problem, 4000);
  const customerName = text(body.customer_name, 160);
  const existingCustomerId =
    typeof body.customer_id === "string" && UUID_RE.test(body.customer_id)
      ? body.customer_id
      : null;
  if (!problem) {
    return NextResponse.json({ error: "Describe what's wrong" }, { status: 400 });
  }
  if (!existingCustomerId && !customerName) {
    return NextResponse.json({ error: "Customer name is required" }, { status: 400 });
  }

  const ticketId =
    typeof body.ticket_id === "string" && UUID_RE.test(body.ticket_id)
      ? body.ticket_id
      : crypto.randomUUID();

  const phone = text(body.customer_phone, 30);
  const photoPaths = Array.isArray(body.photo_paths)
    ? body.photo_paths
        .filter((p): p is string => typeof p === "string")
        // Only accept paths inside this ticket's folder in this shop.
        .filter((p) => p.startsWith(`shops/${ctx.shop.id}/tickets/${ticketId}/`))
        .slice(0, 4)
    : [];

  const supabase = createClient();

  // 1. Customer — reuse or create.
  let customerId = existingCustomerId;
  if (customerId) {
    const { data: found } = await supabase
      .from("customers")
      .select("id")
      .eq("id", customerId)
      .maybeSingle();
    if (!found) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }
  } else {
    const { data: customer, error } = await supabase
      .from("customers")
      .insert({
        shop_id: ctx.shop.id,
        name: customerName,
        phone: phone ? normalizePhone(phone) : null,
      })
      .select("id")
      .single();
    if (error || !customer) {
      return NextResponse.json({ error: "Could not save customer" }, { status: 500 });
    }
    customerId = customer.id;
  }

  // 2. Instrument — reuse (appending any new photos) or create.
  const instrumentType = text(body.instrument?.type, 40);
  let instrumentId =
    typeof body.instrument_id === "string" && UUID_RE.test(body.instrument_id)
      ? body.instrument_id
      : null;

  if (instrumentId) {
    const { data: existing } = await supabase
      .from("instruments")
      .select("id, photo_urls")
      .eq("id", instrumentId)
      .eq("customer_id", customerId)
      .maybeSingle();
    if (!existing) {
      return NextResponse.json({ error: "Instrument not found" }, { status: 404 });
    }
    if (photoPaths.length > 0) {
      await supabase
        .from("instruments")
        .update({ photo_urls: [...(existing.photo_urls ?? []), ...photoPaths] })
        .eq("id", instrumentId);
    }
  } else {
    const { data: instrument, error } = await supabase
      .from("instruments")
      .insert({
        shop_id: ctx.shop.id,
        customer_id: customerId,
        type:
          (INSTRUMENT_TYPES as readonly string[]).includes(instrumentType)
            ? instrumentType
            : instrumentType || null,
        make: text(body.instrument?.make, 80) || null,
        model: text(body.instrument?.model, 80) || null,
        serial: text(body.instrument?.serial, 80) || null,
        photo_urls: photoPaths.length > 0 ? photoPaths : null,
      })
      .select("id")
      .single();
    if (error || !instrument) {
      return NextResponse.json({ error: "Could not save instrument" }, { status: 500 });
    }
    instrumentId = instrument.id;
  }

  // 3. Ticket.
  const { data: ticket, error: ticketError } = await supabase
    .from("tickets")
    .insert({
      id: ticketId,
      shop_id: ctx.shop.id,
      customer_id: customerId,
      instrument_id: instrumentId,
      status: "queued",
      problem,
      quote_cents: cents(body.quote_cents),
      deposit_cents: cents(body.deposit_cents) ?? 0,
    })
    .select("id, public_token, quote_cents")
    .single();
  if (ticketError || !ticket) {
    return NextResponse.json({ error: "Could not create ticket" }, { status: 500 });
  }

  // 4. Fire the "received" text. Failure never blocks intake.
  let smsSent = false;
  const { data: customer } = await supabase
    .from("customers")
    .select("name, phone, email")
    .eq("id", customerId)
    .single();
  const { data: instrument } = await supabase
    .from("instruments")
    .select("type, make, model")
    .eq("id", instrumentId)
    .maybeSingle();

  if (customer?.phone) {
    const { data: template } = await supabase
      .from("templates")
      .select("body")
      .eq("shop_id", ctx.shop.id)
      .eq("key", "received")
      .maybeSingle();
    if (template) {
      const resolved = resolveTemplate(
        template.body,
        buildTemplateVars({
          shop: ctx.shop,
          customer,
          instrument: instrument ?? null,
          ticket: { public_token: ticket.public_token, quote_cents: ticket.quote_cents },
        }),
      );
      const outcome = await deliverMessage({
        supabase,
        ticketId: ticket.id,
        channel: "sms",
        body: resolved,
        shop: ctx.shop,
        customer,
      });
      smsSent = outcome.ok;
    }
  }

  return NextResponse.json({
    ticket_id: ticket.id,
    public_token: ticket.public_token,
    sms_sent: smsSent,
  });
}
