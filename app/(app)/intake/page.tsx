import { requireShop } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { shopIsWritable, readOnlyReason } from "@/lib/plan";
import { IntakeForm } from "@/components/IntakeForm";
import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata = { title: "New intake" };

export default async function IntakePage() {
  const { shop } = await requireShop();

  if (!shopIsWritable(shop)) {
    return (
      <div className="px-4 py-10 text-center">
        <p className="text-3xl" aria-hidden>🔒</p>
        <p className="mx-auto mt-3 max-w-sm text-sm text-slate-600">
          {readOnlyReason(shop)}
        </p>
        <Link href="/settings?tab=billing" className="btn-primary mt-5">
          Go to Billing
        </Link>
      </div>
    );
  }

  const supabase = createClient();
  const { data: presets } = await supabase
    .from("price_presets")
    .select("id, label, amount_cents")
    .eq("shop_id", shop.id)
    .order("label");

  return (
    <div className="mx-auto max-w-lg px-4 py-4">
      <h1 className="mb-3 text-lg font-bold tracking-tight">New intake</h1>
      <IntakeForm shopId={shop.id} presets={presets ?? []} />
    </div>
  );
}
