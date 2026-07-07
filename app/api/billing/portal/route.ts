import { NextResponse } from "next/server";
import { requireShopApi } from "@/lib/auth";
import { getStripe } from "@/lib/stripe";

/** Opens the Stripe Customer Portal for subscription management. */
export async function POST() {
  const ctx = await requireShopApi();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!ctx.shop.stripe_customer_id) {
    return NextResponse.json(
      { error: "No billing account yet — activate your subscription first" },
      { status: 400 },
    );
  }

  try {
    const session = await getStripe().billingPortal.sessions.create({
      customer: ctx.shop.stripe_customer_id,
      return_url:
        process.env.STRIPE_PORTAL_RETURN_URL ??
        `${process.env.NEXT_PUBLIC_BASE_URL}/settings?tab=billing`,
    });
    return NextResponse.json({ url: session.url });
  } catch {
    return NextResponse.json(
      { error: "Could not open the billing portal" },
      { status: 502 },
    );
  }
}
