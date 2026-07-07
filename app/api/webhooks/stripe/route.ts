import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { getStripe, planForPriceId } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";

/**
 * Stripe → BenchPass sync. Signature-verified; runs with the service role
 * because webhooks have no user session.
 */
export async function POST(request: NextRequest) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(
      await request.text(),
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const admin = createAdminClient();

  async function shopIdForCustomer(customerId: string): Promise<string | null> {
    const { data } = await admin
      .from("shops")
      .select("id")
      .eq("stripe_customer_id", customerId)
      .maybeSingle();
    return data?.id ?? null;
  }

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const sub = event.data.object;
      const shopId =
        sub.metadata?.shop_id ??
        (await shopIdForCustomer(
          typeof sub.customer === "string" ? sub.customer : sub.customer.id,
        ));
      if (!shopId) break;

      const priceId = sub.items.data[0]?.price.id;
      const status: string =
        sub.status === "active" || sub.status === "trialing"
          ? "active"
          : sub.status === "past_due" || sub.status === "unpaid"
            ? "past_due"
            : sub.status === "canceled"
              ? "canceled"
              : "active";

      await admin
        .from("shops")
        .update({
          plan: planForPriceId(priceId),
          subscription_status: status,
          stripe_subscription_id: sub.id,
        })
        .eq("id", shopId);
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object;
      const shopId =
        sub.metadata?.shop_id ??
        (await shopIdForCustomer(
          typeof sub.customer === "string" ? sub.customer : sub.customer.id,
        ));
      if (!shopId) break;

      // Read-only mode: history stays visible; new tickets/messages blocked.
      await admin
        .from("shops")
        .update({ subscription_status: "canceled" })
        .eq("id", shopId);
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object;
      const customerId =
        typeof invoice.customer === "string"
          ? invoice.customer
          : invoice.customer?.id;
      if (!customerId) break;
      const shopId = await shopIdForCustomer(customerId);
      if (!shopId) break;

      const { data: owner } = await admin
        .from("users")
        .select("email")
        .eq("shop_id", shopId)
        .eq("role", "owner")
        .maybeSingle();
      if (owner) {
        await sendEmail({
          to: owner.email,
          subject: "BenchPass — payment failed",
          text: "Your latest BenchPass payment didn't go through. Please update your card in Settings → Billing → Manage subscription to keep your account active.",
        });
      }
      break;
    }

    default:
      break;
  }

  return NextResponse.json({ received: true });
}
