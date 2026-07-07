import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

/**
 * Service-role client — bypasses RLS. Server-only. Used exclusively for:
 *  - onboarding (creating shops/users before the user row exists)
 *  - the public customer page (lookup by unguessable public_token)
 *  - Stripe webhooks and the trial-reminder cron (no user session)
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
