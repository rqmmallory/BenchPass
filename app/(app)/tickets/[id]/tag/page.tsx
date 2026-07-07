import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { requireShop } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { publicTicketUrl } from "@/lib/notify";
import { formatDate, formatPhone, shortId } from "@/lib/format";
import { AutoPrint } from "@/components/AutoPrint";
import { PrintNow } from "@/components/PrintNow";

export const dynamic = "force-dynamic";

export const metadata = { title: "Print tag" };

/** Printable repair tag, formatted for a 2" × 3.5" label. */
export default async function TagPage({ params }: { params: { id: string } }) {
  await requireShop();
  const supabase = createClient();

  const { data: ticket } = await supabase
    .from("tickets")
    .select(
      "id, public_token, problem, intake_at, customers(name, phone), instruments(type, make, model)",
    )
    .eq("id", params.id)
    .maybeSingle();

  if (!ticket || !ticket.customers) notFound();

  const url = publicTicketUrl(ticket.public_token);
  // qrcode renders server-side to a data URI — nothing to load at print time.
  const qrDataUrl = await QRCode.toDataURL(url, { margin: 0, width: 240 });

  const instrumentName =
    [ticket.instruments?.make, ticket.instruments?.model].filter(Boolean).join(" ") ||
    ticket.instruments?.type ||
    "Instrument";

  return (
    <div className="flex flex-col items-center px-4 py-6">
      <style>{`@page { size: 3.5in 2in; margin: 0.08in; }`}</style>
      <AutoPrint />

      <div className="no-print mb-4 flex w-full max-w-sm items-center justify-between">
        <Link
          href={`/tickets/${ticket.id}`}
          className="text-sm font-medium text-brand-600 hover:underline"
        >
          ← Ticket
        </Link>
        <Link href="/" className="text-sm font-medium text-brand-600 hover:underline">
          Board
        </Link>
      </div>

      {/* The label itself — 3.5in × 2in */}
      <div
        className="flex border border-slate-300 bg-white print:border-0"
        style={{ width: "3.34in", height: "1.84in" }}
      >
        <div className="flex min-w-0 flex-1 flex-col justify-between p-2">
          <div className="min-w-0">
            <p className="text-[26px] font-black leading-none tracking-tight">
              #{shortId(ticket.id)}
            </p>
            <p className="mt-1 truncate text-[13px] font-bold leading-tight">
              {ticket.customers.name}
            </p>
            {ticket.customers.phone && (
              <p className="truncate text-[11px] leading-tight text-slate-600">
                {formatPhone(ticket.customers.phone)}
              </p>
            )}
            <p className="mt-0.5 truncate text-[12px] font-semibold leading-tight">
              {instrumentName}
            </p>
            <p className="line-clamp-2 text-[10px] leading-tight text-slate-600">
              {ticket.problem}
            </p>
          </div>
          <p className="text-[9px] text-slate-500">
            In {formatDate(ticket.intake_at)} · scan for status
          </p>
        </div>
        <div className="flex items-center p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrDataUrl}
            alt={`QR code for repair status: ${url}`}
            style={{ width: "1.3in", height: "1.3in" }}
          />
        </div>
      </div>

      <div className="no-print mt-6">
        <PrintNow />
      </div>
    </div>
  );
}
