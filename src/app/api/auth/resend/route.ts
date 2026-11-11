import { authJson, clientIp, rateLimited, readAuthBody, siteOrigin, type RateLimit } from "@/lib/auth/auth-api";
import { normalizeEmail } from "@/lib/auth/request-guard";
import { createRouteAuthClient } from "@/lib/supabase/auth-server";

export const dynamic = "force-dynamic";
/** Seconds the form waits before offering "Resend" again; Supabase enforces its own minimum as well. */
const RESEND_WAIT_SECONDS = 60;
const RESEND_PER_EMAIL: RateLimit = { name: "resend-email", windowSeconds: 3600, max: 4 };
const RESEND_PER_IP: RateLimit = { name: "resend-ip", windowSeconds: 3600, max: 10 };

/** POST { email } → sends the confirmation letter (code + link) again. The same answer whatever the address is. */
export async function POST(request: Request) {
  const body = await readAuthBody(request);
  const email = normalizeEmail(body?.email);
  const limited = await rateLimited(RESEND_PER_IP, clientIp(request)) ?? (email ? await rateLimited(RESEND_PER_EMAIL, email) : null);
  if (limited) return limited;
  if (email) {
    const client = await createRouteAuthClient();
    await client.auth.resend({ type: "signup", email, options: { emailRedirectTo: `${siteOrigin(request)}/auth/callback` } }).catch(() => undefined);
  }
  return authJson({ ok: true, wait: RESEND_WAIT_SECONDS });
}
