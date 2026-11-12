import { authJson, clientIp, rateLimited, readAuthBody, type RateLimit } from "@/lib/auth/auth-api";
import { recordAudit } from "@/lib/auth/audit";
import { normalizeEmail } from "@/lib/auth/request-guard";
import { normalizeOtp } from "@/lib/auth/password-strength";
import { admitSession } from "@/lib/auth/sign-in";
import { WORKSPACE_DENIAL } from "@/lib/auth/current-user";
import { createRouteAuthClient } from "@/lib/supabase/auth-server";

export const dynamic = "force-dynamic";
/** A 6-digit code has a million values: a handful of guesses per address, then a pause. */
const VERIFY_PER_EMAIL: RateLimit = { name: "verify-email", windowSeconds: 900, max: 6 };
const VERIFY_PER_IP: RateLimit = { name: "verify-ip", windowSeconds: 900, max: 30 };

/**
 * POST { email, code } — confirms the e-mail with the code from the confirmation letter (an alternative to the
 * link in the same letter, see the runbook), then admits the session under the closed-beta rules like every
 * other sign-in path.
 */
export async function POST(request: Request) {
  const body = await readAuthBody(request);
  const email = normalizeEmail(body?.email);
  const code = normalizeOtp(body?.code);
  const limited = await rateLimited(VERIFY_PER_IP, clientIp(request)) ?? (email ? await rateLimited(VERIFY_PER_EMAIL, email) : null);
  if (limited) return limited;
  if (!email || !code) return authJson({ error: "Invalid or expired code" }, 400);

  const client = await createRouteAuthClient();
  const { data, error } = await client.auth.verifyOtp({ email, token: code, type: "email" });
  if (error || !data.user) return authJson({ error: "Invalid or expired code" }, 400);
  const admitted = await admitSession(client, data.user.id);
  if (!admitted.ok) return authJson({ error: WORKSPACE_DENIAL[admitted.reason].error, code: admitted.reason }, WORKSPACE_DENIAL[admitted.reason].status);
  await recordAudit(request, { authUserId: data.user.id }, "sign_in", { method: "code" });
  return authJson({ ok: true });
}
