import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";

/**
 * Daily Vercel cron (see vercel.json): emails shops whose 14-day trial ends
 * in 2 days ("day 12" reminder). Guarded by CRON_SECRET.
 */
export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Shops whose trial ends within the [2, 3) days-from-now window. The cron
  // runs once a day, so each shop lands in this window exactly once.
  const from = new Date(Date.now() + 2 * 86_400_000).toISOString();
  const to = new Date(Date.now() + 3 * 86_400_000).toISOString();

  const { data: shops } = await admin
    .from("shops")
    .select("id, name, users(email, role)")
    .eq("subscription_status", "trialing")
    .gte("trial_ends_at", from)
    .lt("trial_ends_at", to);

  let sent = 0;
  for (const shop of shops ?? []) {
    const owner = shop.users.find((u) => u.role === "owner") ?? shop.users[0];
    if (!owner) continue;
    const result = await sendEmail({
      to: owner.email,
      subject: "Your BenchPass trial ends in 2 days",
      text: `Hi — your free BenchPass trial for ${shop.name} ends in 2 days. Activate your subscription in Settings → Billing to keep your board, tickets, and customer texts running without interruption.\n\n${process.env.NEXT_PUBLIC_BASE_URL}/settings?tab=billing`,
    });
    if (result.ok) sent += 1;
  }

  return NextResponse.json({ sent });
}
