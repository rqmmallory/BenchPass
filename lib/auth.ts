import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/supabase";

export type SessionContext = {
  userId: string;
  email: string;
  shop: Tables<"shops">;
};

/**
 * Resolve the signed-in user's shop, cached per request.
 * Returns null when there is no session or no users row yet.
 */
export const getSessionContext = cache(
  async (): Promise<SessionContext | null> => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: profile } = await supabase
      .from("users")
      .select("shop_id, email")
      .eq("id", user.id)
      .maybeSingle();
    if (!profile) return null;

    const { data: shop } = await supabase
      .from("shops")
      .select("*")
      .eq("id", profile.shop_id)
      .maybeSingle();
    if (!shop) return null;

    return { userId: user.id, email: profile.email, shop };
  },
);

/** For pages: redirect to /login (no session) or /onboarding (no shop yet). */
export async function requireShop(): Promise<SessionContext> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const ctx = await getSessionContext();
  if (!ctx) redirect("/onboarding");
  return ctx;
}

/** For API routes: returns context or null; caller responds 401. */
export async function requireShopApi(): Promise<SessionContext | null> {
  return getSessionContext();
}
