import { LOGIN_PER_EMAIL, LOGIN_PER_IP, authJson, captchaToken, clientIp, rateLimited, readAuthBody } from "@/lib/auth/auth-api";
import { recordAudit } from "@/lib/auth/audit";
import { normalizeEmail, PASSWORD_MAX_LENGTH } from "@/lib/auth/request-guard";
import { admitSession } from "@/lib/auth/sign-in";
import { createRouteAuthClient } from "@/lib/supabase/auth-server";
import { WORKSPACE_DENIAL } from "@/lib/auth/current-user";

export const dynamic = "force-dynamic";

/** POST { email, password } → session cookies. The same answer for an unknown e-mail and a wrong password. */
export async function POST(request: Request) {
  const body = await readAuthBody(request);
  const email = normalizeEmail(body?.email);
  const password = typeof body?.password === "string" && body.password.length <= PASSWORD_MAX_LENGTH ? body.password : "";
  const limited = await rateLimited(LOGIN_PER_IP, clientIp(request)) ?? (email ? await rateLimited(LOGIN_PER_EMAIL, email) : null);
  if (limited) return limited;
  if (!email || !password) return authJson({ error: "Wrong e-mail or password" }, 401);

  const client = await createRouteAuthClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password, options: { captchaToken: captchaToken(body) } });
  if (error?.code === "captcha_failed") return authJson({ error: "The human check failed. Try again.", code: "captcha_failed" }, 400);
  if (error || !data.user) {
    if (error?.code === "email_not_confirmed") return authJson({ error: "Confirm your e-mail address to continue", code: "email_unconfirmed" }, 403);
    if (error && (error.status ?? 500) >= 500) return authJson({ error: "Service is temporarily unavailable" }, 503);
    return authJson({ error: "Wrong e-mail or password" }, 401);
  }
  const admitted = await admitSession(client, data.user.id);
  if (!admitted.ok) return authJson({ error: WORKSPACE_DENIAL[admitted.reason].error, code: admitted.reason }, WORKSPACE_DENIAL[admitted.reason].status);
  await recordAudit(request, { authUserId: data.user.id }, "sign_in", { method: "password" });
  return authJson({ ok: true });
}
