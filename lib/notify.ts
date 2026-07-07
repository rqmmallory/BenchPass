import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/types/supabase";
import { sendSms } from "@/lib/sms";
import { sendEmail } from "@/lib/email";
import { formatMoney } from "@/lib/format";
import { instrumentLabel, type TemplateVars } from "@/lib/templates";

export function publicTicketUrl(publicToken: string): string {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "";
  return `${base}/r/${publicToken}`;
}

export function buildTemplateVars(params: {
  shop: Pick<Tables<"shops">, "name">;
  customer: Pick<Tables<"customers">, "name">;
  instrument: Pick<Tables<"instruments">, "type" | "make" | "model"> | null;
  ticket: Pick<Tables<"tickets">, "public_token" | "quote_cents">;
}): TemplateVars {
  return {
    customer_name: params.customer.name.split(" ")[0] ?? params.customer.name,
    instrument: instrumentLabel(params.instrument),
    shop_name: params.shop.name,
    public_url: publicTicketUrl(params.ticket.public_token),
    quote: params.ticket.quote_cents != null
      ? formatMoney(params.ticket.quote_cents).replace(/^\$/, "")
      : "",
  };
}

export type SendOutcome =
  | { ok: true; channel: "sms" | "email" }
  | { ok: false; error: string };

/**
 * Send an already-resolved message body to a customer (SMS first, email as the
 * explicit alternative) and log it to the messages table. Failures are
 * returned, never thrown — notifications must not break the save flow.
 */
export async function deliverMessage(params: {
  supabase: SupabaseClient<Database>;
  ticketId: string;
  channel: "sms" | "email";
  body: string;
  shop: Pick<Tables<"shops">, "name" | "sms_from">;
  customer: Pick<Tables<"customers">, "name" | "phone" | "email">;
}): Promise<SendOutcome> {
  const { supabase, ticketId, channel, body, shop, customer } = params;

  let twilioSid: string | null = null;

  if (channel === "sms") {
    if (!customer.phone) return { ok: false, error: "Customer has no phone number" };
    const result = await sendSms({
      to: customer.phone,
      from: shop.sms_from ?? "",
      body,
    });
    if (!result.ok) return { ok: false, error: result.error };
    twilioSid = result.sid;
  } else {
    if (!customer.email) return { ok: false, error: "Customer has no email address" };
    const result = await sendEmail({
      to: customer.email,
      subject: `Update from ${shop.name}`,
      text: body,
      fromName: shop.name,
    });
    if (!result.ok) return { ok: false, error: result.error };
  }

  const { error: logError } = await supabase.from("messages").insert({
    ticket_id: ticketId,
    channel,
    body,
    twilio_sid: twilioSid,
  });
  if (logError) {
    // Message went out but logging failed — surface for observability without
    // leaking customer content.
    console.error("Failed to log outbound message", { ticketId, channel });
  }

  return { ok: true, channel };
}
