import { createClient } from "@supabase/supabase-js";

/**
 * SERVICE-KEY client: bypasses row-level security. Server only.
 *
 * Allowed uses (ADR 0017) — anything else goes through the user's session client (`requireUser`):
 *  - MQVault Bridge device endpoints and pairing (a PC has no user session; it proves itself with a signature);
 *  - economic-calendar import/sync (shared `news_events`, written with a machine token);
 *  - rate limiting of sign-in, code checks and pairing (`bridge_rate_limit_*`);
 *  - deleting a user account (Supabase Auth admin API).
 */
export function createServiceSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
