import "server-only";
import Stripe from "stripe";

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeClient) {
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2025-02-24.acacia",
      typescript: true,
    });
  }
  return stripeClient;
}

export function priceIdForPlan(plan: "solo" | "shop"): string {
  return plan === "shop"
    ? process.env.STRIPE_SHOP_PRICE_ID!
    : process.env.STRIPE_SOLO_PRICE_ID!;
}

export function planForPriceId(priceId: string | undefined): "solo" | "shop" {
  return priceId === process.env.STRIPE_SHOP_PRICE_ID ? "shop" : "solo";
}
