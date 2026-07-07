import Link from "next/link";
import { requireShop } from "@/lib/auth";
import { readOnlyReason, shopIsWritable, trialDaysLeft } from "@/lib/plan";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { shop } = await requireShop();
  const writable = shopIsWritable(shop);
  const trialDays =
    shop.subscription_status === "trialing" ? trialDaysLeft(shop) : null;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col">
      <header className="no-print sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
        <nav className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4">
          <Link
            href="/"
            className="truncate text-base font-bold tracking-tight text-slate-900"
          >
            {shop.name || "BenchPass"}
          </Link>
          <div className="flex items-center gap-1 text-sm font-medium">
            <Link href="/" className="rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900">
              Board
            </Link>
            <Link href="/history" className="rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900">
              History
            </Link>
            <Link
              href="/settings"
              aria-label="Settings"
              className="rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            >
              <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </Link>
          </div>
        </nav>
        {!writable && (
          <div className="border-t border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm font-medium text-amber-800">
            {readOnlyReason(shop)}{" "}
            <Link href="/settings?tab=billing" className="underline">
              Go to Billing
            </Link>
          </div>
        )}
        {writable && trialDays !== null && trialDays <= 3 && (
          <div className="border-t border-blue-200 bg-blue-50 px-4 py-2 text-center text-sm font-medium text-blue-800">
            Your free trial ends in {trialDays} day{trialDays === 1 ? "" : "s"}.{" "}
            <Link href="/settings?tab=billing" className="underline">
              Activate subscription
            </Link>
          </div>
        )}
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
