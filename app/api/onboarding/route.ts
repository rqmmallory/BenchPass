import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizePhone } from "@/lib/format";

type OnboardingBody = {
  shop_name?: unknown;
  phone?: unknown;
  preset?: { label?: unknown; amount_cents?: unknown } | null;
  received_template?: unknown;
};

const TRIAL_DAYS = 14;

/**
 * Creates the shop + user profile for a freshly authenticated account.
 * Runs with the service role because RLS (correctly) prevents a user with no
 * `users` row from inserting into `shops`/`users`.
 */
export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as OnboardingBody | null;
  const shopName = typeof body?.shop_name === "string" ? body.shop_name.trim() : "";
  if (!shopName || shopName.length > 120) {
    return NextResponse.json({ error: "Shop name is required" }, { status: 400 });
  }
  const phone = typeof body?.phone === "string" && body.phone.trim()
    ? normalizePhone(body.phone.trim())
    : null;

  const admin = createAdminClient();

  // Idempotency: if this user already onboarded, just return their shop.
  const { data: existing } = await admin
    .from("users")
    .select("shop_id")
    .eq("id", user.id)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ shop_id: existing.shop_id });
  }

  const trialEndsAt = new Date(
    Date.now() + TRIAL_DAYS * 86_400_000,
  ).toISOString();

  const { data: shop, error: shopError } = await admin
    .from("shops")
    .insert({
      name: shopName,
      phone,
      plan: "solo",
      subscription_status: "trialing",
      trial_ends_at: trialEndsAt,
    })
    .select("id")
    .single();
  if (shopError || !shop) {
    return NextResponse.json({ error: "Could not create shop" }, { status: 500 });
  }

  const { error: userError } = await admin.from("users").insert({
    id: user.id,
    shop_id: shop.id,
    email: user.email,
    role: "owner",
  });
  if (userError) {
    return NextResponse.json({ error: "Could not create profile" }, { status: 500 });
  }

  const presetLabel =
    typeof body?.preset?.label === "string" ? body.preset.label.trim() : "";
  const presetAmount =
    typeof body?.preset?.amount_cents === "number" &&
    Number.isInteger(body.preset.amount_cents) &&
    body.preset.amount_cents > 0
      ? body.preset.amount_cents
      : null;
  if (presetLabel && presetAmount) {
    await admin.from("price_presets").insert({
      shop_id: shop.id,
      label: presetLabel.slice(0, 80),
      amount_cents: presetAmount,
    });
  }

  const receivedTemplate =
    typeof body?.received_template === "string"
      ? body.received_template.trim()
      : "";
  if (receivedTemplate) {
    await admin
      .from("templates")
      .update({ body: receivedTemplate.slice(0, 640) })
      .eq("shop_id", shop.id)
      .eq("key", "received");
  }

  return NextResponse.json({ shop_id: shop.id });
}
