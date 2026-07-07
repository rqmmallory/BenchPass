import { NextResponse, type NextRequest } from "next/server";
import { requireShopApi } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe, priceIdForPlan } from "@/lib/stripe";
import { isPlanId } from "@/lib/plan";

/** Starts Stripe Checkout for a subscription (trial activation or plan change). */
export async function POST(request: NextRequest) {
  const ctx = await requireShopApi();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { plan?: unknown } | null;
  const plan =
    typeof body?.plan === "string" && isPlanId(body.plan) ? body.plan : "solo";

  const stripe = getStripe();
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL!;

  try {
    // Reuse the Stripe customer if one exists; create it lazily otherwise.
    let customerId = ctx.shop.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: ctx.email,
        name: ctx.shop.name,
        metadata: { shop_id: ctx.shop.id },
      });
      customerId = customer.id;
      // Admin client: shops.stripe_customer_id must be set even though this
      // request's RLS user could also do it — keeps webhook lookups reliable.
      await createAdminClient()
        .from("shops")
        .update({ stripe_customer_id: customerId })
        .eq("id", ctx.shop.id);
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: priceIdForPlan(plan), quantity: 1 }],
      subscription_data: { metadata: { shop_id: ctx.shop.id } },
      success_url: `${baseUrl}/settings?tab=billing&checkout=success`,
      cancel_url: `${baseUrl}/settings?tab=billing&checkout=canceled`,
      allow_promotion_codes: true,
    });

    return NextResponse.json({ url: session.url });
  } catch {
    return NextResponse.json(
      { error: "Could not start checkout" },
      { status: 502 },
    );
  }
}
