import { notFound } from "next/navigation";
import { requireShop } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { shopIsWritable } from "@/lib/plan";
import { isTicketStatus } from "@/lib/status";
import { photoUrl } from "@/lib/storage";
import { buildTemplateVars, publicTicketUrl } from "@/lib/notify";
import { resolveTemplate, TEMPLATE_KEYS, type TemplateKey } from "@/lib/templates";
import { TicketDetail } from "@/components/TicketDetail";

export const dynamic = "force-dynamic";

export const metadata = { title: "Ticket" };

export default async function TicketPage({
  params,
}: {
  params: { id: string };
}) {
  const { shop } = await requireShop();
  const supabase = createClient();

  const { data: ticket } = await supabase
    .from("tickets")
    .select(
      "*, customers(id, name, phone, email), instruments(id, type, make, model, serial, photo_urls)",
    )
    .eq("id", params.id)
    .maybeSingle();

  if (!ticket || !ticket.customers || !isTicketStatus(ticket.status)) notFound();

  const [{ data: messages }, { data: templates }] = await Promise.all([
    supabase
      .from("messages")
      .select("id, channel, body, sent_at")
      .eq("ticket_id", ticket.id)
      .order("sent_at", { ascending: true }),
    supabase
      .from("templates")
      .select("key, body")
      .eq("shop_id", shop.id),
  ]);

  // Resolve template variables server-side so the message panel opens pre-filled.
  const vars = buildTemplateVars({
    shop,
    customer: ticket.customers,
    instrument: ticket.instruments,
    ticket,
  });
  const resolvedTemplates = {} as Record<TemplateKey, string>;
  for (const key of TEMPLATE_KEYS) {
    const t = (templates ?? []).find((row) => row.key === key);
    resolvedTemplates[key] = t ? resolveTemplate(t.body, vars) : "";
  }

  return (
    <TicketDetail
      writable={shopIsWritable(shop)}
      publicUrl={publicTicketUrl(ticket.public_token)}
      ticket={{
        id: ticket.id,
        status: ticket.status,
        problem: ticket.problem,
        internalNotes: ticket.internal_notes,
        customerSummary: ticket.customer_summary,
        quoteCents: ticket.quote_cents,
        depositCents: ticket.deposit_cents,
        partsStatus: ticket.parts_status,
        intakeAt: ticket.intake_at,
        readyAt: ticket.ready_at,
        pickedUpAt: ticket.picked_up_at,
      }}
      customer={{
        id: ticket.customers.id,
        name: ticket.customers.name,
        phone: ticket.customers.phone,
        email: ticket.customers.email,
      }}
      instrument={
        ticket.instruments
          ? {
              type: ticket.instruments.type,
              make: ticket.instruments.make,
              model: ticket.instruments.model,
              serial: ticket.instruments.serial,
              photoUrls: (ticket.instruments.photo_urls ?? []).map(photoUrl),
            }
          : null
      }
      messages={(messages ?? []).map((m) => ({
        id: m.id,
        channel: m.channel === "email" ? ("email" as const) : ("sms" as const),
        body: m.body,
        sentAt: m.sent_at,
      }))}
      templates={resolvedTemplates}
    />
  );
}
