import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatMoney, formatPhone } from "@/lib/format";
import { PUBLIC_STATUS, isTicketStatus } from "@/lib/status";
import { photoUrl } from "@/lib/storage";

// Fully server-rendered: works with JavaScript disabled and stays fast on
// mobile. Tokens are 32 hex chars of entropy — unguessable.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Repair status",
  robots: { index: false, follow: false },
};

export default async function PublicTicketPage({
  params,
}: {
  params: { token: string };
}) {
  const token = params.token;
  if (!/^[0-9a-f]{16,64}$/i.test(token)) notFound();

  // Service role (no session on this page); we select ONLY customer-safe
  // fields — never internal_notes or other shop data.
  const admin = createAdminClient();
  const { data: ticket } = await admin
    .from("tickets")
    .select(
      "status, problem, customer_summary, quote_cents, shops(name, logo_url, phone, address), instruments(photo_urls)",
    )
    .eq("public_token", token)
    .maybeSingle();

  if (!ticket || !ticket.shops || !isTicketStatus(ticket.status)) notFound();

  const shop = ticket.shops;
  const status = PUBLIC_STATUS[ticket.status];
  const photos = (ticket.instruments?.photo_urls ?? []).map(photoUrl);
  const summary = ticket.customer_summary?.trim() || ticket.problem;

  return (
    <main className="mx-auto min-h-screen w-full max-w-md px-5 py-8">
      {/* Shop header */}
      <header className="flex items-center gap-3">
        {shop.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoUrl(shop.logo_url)}
            alt={`${shop.name} logo`}
            width={48}
            height={48}
            className="h-12 w-12 rounded-xl bg-white object-contain shadow-card"
          />
        ) : (
          <div aria-hidden className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-xl text-white">
            🎸
          </div>
        )}
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold leading-tight">{shop.name}</h1>
          {shop.address && (
            <p className="truncate text-xs text-slate-500">{shop.address}</p>
          )}
        </div>
      </header>

      {/* Status */}
      <section
        aria-label="Repair status"
        className="card mt-6 p-6 text-center"
      >
        <p className="text-5xl" aria-hidden>
          {status.emoji}
        </p>
        <h2 className="mt-3 text-xl font-bold tracking-tight">{status.label}</h2>
      </section>

      {/* Photos */}
      {photos.length > 0 && (
        <section aria-label="Instrument photos" className="mt-4 flex gap-2.5 overflow-x-auto">
          {photos.map((url) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={url}
              src={url}
              alt="Your instrument"
              loading="lazy"
              className="h-28 w-28 shrink-0 rounded-xl object-cover shadow-card"
            />
          ))}
        </section>
      )}

      {/* Summary */}
      <section className="card mt-4 p-5">
        <h3 className="text-sm font-semibold text-slate-500">Repair summary</h3>
        <p className="mt-1.5 whitespace-pre-wrap text-[15px] leading-relaxed text-slate-800">
          {summary}
        </p>
        {ticket.quote_cents != null && (
          <p className="mt-4 border-t border-slate-100 pt-3 text-sm text-slate-600">
            Quote:{" "}
            <span className="font-bold text-slate-900">
              {formatMoney(ticket.quote_cents)}
            </span>
          </p>
        )}
      </section>

      {/* Contact */}
      {shop.phone && (
        <a href={`tel:${shop.phone}`} className="btn-primary mt-5 w-full">
          Questions? Contact us · {formatPhone(shop.phone)}
        </a>
      )}

      <footer className="mt-10 text-center text-xs text-slate-400">
        Powered by{" "}
        <a href="https://benchpass.app" className="font-medium text-slate-500 underline">
          BenchPass
        </a>
      </footer>
    </main>
  );
}
