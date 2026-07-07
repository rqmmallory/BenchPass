import { requireShop } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { trialDaysLeft } from "@/lib/plan";
import { TEMPLATE_KEYS, type TemplateKey } from "@/lib/templates";
import { SettingsClient, type SettingsTab } from "@/components/SettingsClient";

export const dynamic = "force-dynamic";

export const metadata = { title: "Settings" };

const TABS: SettingsTab[] = ["shop", "messages", "presets", "billing", "account"];

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  const { shop, email } = await requireShop();
  const supabase = createClient();

  const [{ data: templates }, { data: presets }] = await Promise.all([
    supabase.from("templates").select("id, key, body").eq("shop_id", shop.id),
    supabase
      .from("price_presets")
      .select("id, label, amount_cents")
      .eq("shop_id", shop.id)
      .order("label"),
  ]);

  const templateMap = {} as Record<TemplateKey, { id: string; body: string } | null>;
  for (const key of TEMPLATE_KEYS) {
    const row = (templates ?? []).find((t) => t.key === key);
    templateMap[key] = row ? { id: row.id, body: row.body } : null;
  }

  const initialTab = TABS.includes(searchParams.tab as SettingsTab)
    ? (searchParams.tab as SettingsTab)
    : "shop";

  return (
    <SettingsClient
      initialTab={initialTab}
      email={email}
      shop={{
        id: shop.id,
        name: shop.name,
        logoUrl: shop.logo_url,
        phone: shop.phone,
        address: shop.address,
        plan: shop.plan === "shop" ? "shop" : "solo",
        subscriptionStatus: shop.subscription_status,
        trialDaysLeft: trialDaysLeft(shop),
        hasStripeCustomer: Boolean(shop.stripe_customer_id),
      }}
      templates={templateMap}
      presets={presets ?? []}
    />
  );
}
