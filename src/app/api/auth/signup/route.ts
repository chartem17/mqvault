import { SIGNUP_PER_IP, authJson, captchaToken, clientIp, rateLimited, readAuthBody, siteOrigin } from "@/lib/auth/auth-api";
import { signupMode } from "@/lib/auth/provision";
import { normalizeEmail, passwordProblem } from "@/lib/auth/request-guard";
import { admitSession } from "@/lib/auth/sign-in";
import { isValidTimeZone } from "@/lib/time/timezone";
import { createRouteAuthClient } from "@/lib/supabase/auth-server";
import { WORKSPACE_DENIAL } from "@/lib/auth/current-user";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * POST { email, password, locale?, timezone? } → a confirmation e-mail.
 * Closed beta: only invited e-mails (or the pre-existing owner) may register. The invitation is checked again
 * when the confirmed session asks for a workspace, so calling Supabase Auth directly does not get around it.
 */
export async function POST(request: Request) {
  const limited = await rateLimited(SIGNUP_PER_IP, clientIp(request));
  if (limited) return limited;
  const body = await readAuthBody(request);
  const email = normalizeEmail(body?.email);
  if (!email) return authJson({ error: "Enter a valid e-mail address" }, 400);
  const problem = passwordProblem(body?.password);
  if (problem) return authJson({ error: problem }, 400);

  if (signupMode(process.env.AUTH_SIGNUP_MODE) !== "open") {
    const db = createServerSupabase();
    const [invite, unclaimed] = await Promise.all([
      db.from("beta_invites").select("email").eq("email", email).maybeSingle(),
      db.from("app_users").select("id").eq("email", email).is("auth_user_id", null).maybeSingle(),
    ]);
    if (invite.error || unclaimed.error) return authJson({ error: "Service is temporarily unavailable" }, 503);
    if (!invite.data && !unclaimed.data) return authJson({ error: "Sign-up is by invitation during the closed beta", code: "not_invited" }, 403);
  }

  const locale = body?.locale === "uk" || body?.locale === "en" ? body.locale : "en";
  const timezone = typeof body?.timezone === "string" && body.timezone.length <= 64 && isValidTimeZone(body.timezone) ? body.timezone : undefined;
  const client = await createRouteAuthClient();
  const { data, error } = await client.auth.signUp({
    email, password: body?.password as string,
    options: { captchaToken: captchaToken(body), emailRedirectTo: `${siteOrigin(request)}/auth/callback`, data: { locale, ...(timezone ? { timezone } : {}) } },
  });
  if (error) {
    if (error.code === "captcha_failed") return authJson({ error: "The human check failed. Try again.", code: "captcha_failed" }, 400);
    if (error.code === "weak_password") return authJson({ error: "Choose a stronger password" }, 400);
    if (error.code === "over_email_send_rate_limit" || error.status === 429) return authJson({ error: "Too many attempts. Try again later." }, 429);
    if (error.code === "user_already_exists" || error.code === "email_exists") return authJson({ ok: true, confirm: true });
    console.error("Sign-up failed", error.code ?? error.status);
    return authJson({ error: "Could not create the account. Try again later." }, 502);
  }
  // With e-mail confirmation on (required, see the runbook) there is no session yet: the person must open the link.
  if (data.session && data.user) {
    const admitted = await admitSession(client, data.user.id);
    if (!admitted.ok) return authJson({ error: WORKSPACE_DENIAL[admitted.reason].error, code: admitted.reason }, WORKSPACE_DENIAL[admitted.reason].status);
    return authJson({ ok: true, confirm: false });
  }
  return authJson({ ok: true, confirm: true });
}
