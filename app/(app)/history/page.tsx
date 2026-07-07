import Link from "next/link";
import { requireShop } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatMoney, shortId } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata = { title: "History" };

export default async function HistoryPage() {
  const { shop } = await requireShop();
  const supabase = createClient();

  const { data: rows } = await supabase
    .from("tickets")
    .select(
      "id, problem, quote_cents, picked_up_at, customers(name), instruments(type, make, model)",
    )
    .eq("shop_id", shop.id)
    .eq("status", "picked_up")
    .order("picked_up_at", { ascending: false })
    .limit(200);

  const tickets = rows ?? [];

  return (
    <div className="px-4 py-4">
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-lg font-bold tracking-tight">History</h1>
        <Link href="/" className="text-sm font-medium text-brand-600 hover:underline">
          Back to board
        </Link>
      </div>

      {tickets.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center">
          <p className="text-3xl" aria-hidden>🗂️</p>
          <p className="mt-2 text-sm text-slate-500">
            Completed repairs will show up here once tickets are marked picked up.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {tickets.map((t) => (
            <li key={t.id}>
              <Link
                href={`/tickets/${t.id}`}
                className="card flex items-center justify-between gap-3 p-3.5 transition hover:border-brand-500"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold">
                    {t.customers?.name ?? "Unknown customer"}
                    <span className="ml-2 text-xs font-normal text-slate-400">
                      #{shortId(t.id)}
                    </span>
                  </p>
                  <p className="truncate text-sm text-slate-500">
                    {[t.instruments?.make, t.instruments?.model]
                      .filter(Boolean)
                      .join(" ") ||
                      t.instruments?.type ||
                      "Instrument"}{" "}
                    · {t.problem}
                  </p>
                </div>
                <div className="shrink-0 text-right text-sm">
                  {t.quote_cents != null && (
                    <p className="font-semibold text-slate-700">
                      {formatMoney(t.quote_cents)}
                    </p>
                  )}
                  <p className="text-xs text-slate-400">{formatDate(t.picked_up_at)}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
