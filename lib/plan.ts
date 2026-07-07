import type { Tables } from "@/types/supabase";

export const PLANS = {
  solo: { name: "Solo", priceLabel: "$29/mo" },
  shop: { name: "Shop", priceLabel: "$49/mo" },
} as const;

export type PlanId = keyof typeof PLANS;

export function isPlanId(value: string): value is PlanId {
  return value in PLANS;
}

export function trialDaysLeft(shop: Tables<"shops">): number {
  if (!shop.trial_ends_at) return 0;
  const ms = new Date(shop.trial_ends_at).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

/**
 * Writable = active subscription, or still inside the free trial.
 * Canceled/expired shops drop to read-only: history stays visible, but
 * new tickets and outbound messages are blocked.
 */
export function shopIsWritable(shop: Tables<"shops">): boolean {
  if (shop.subscription_status === "active") return true;
  if (shop.subscription_status === "past_due") return true; // grace period; Stripe retries
  if (shop.subscription_status === "trialing") return trialDaysLeft(shop) > 0;
  return false;
}

export function readOnlyReason(shop: Tables<"shops">): string {
  if (shop.subscription_status === "canceled")
    return "Your subscription has ended. Reactivate in Settings → Billing to keep creating tickets.";
  return "Your free trial has ended. Activate your subscription in Settings → Billing to continue.";
}
