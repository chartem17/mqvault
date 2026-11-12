import { RESET_PER_EMAIL, RESET_PER_IP, authJson, captchaToken, clientIp, rateLimited, readAuthBody, siteOrigin } from "@/lib/auth/auth-api";
import { normalizeEmail } from "@/lib/auth/request-guard";
import { createRouteAuthClient } from "@/lib/supabase/auth-server";

export const dynamic = "force-dynamic";

/** POST { email } → a password reset e-mail, if such an account exists. The answer never says whether it does. */
export async function POST(request: Request) {
  const limited = await rateLimited(RESET_PER_IP, clientIp(request));
  if (limited) return limited;
  const body = await readAuthBody(request);
  const email = normalizeEmail(body?.email);
  if (!email) return authJson({ error: "Enter a valid e-mail address" }, 400);
  // Past the per-address limit we still answer "sent": the limit protects the mailbox, not the caller.
  if (!(await rateLimited(RESET_PER_EMAIL, email))) {
    const client = await createRouteAuthClient();
    const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: `${siteOrigin(request)}/auth/callback?next=/reset-password`, captchaToken: captchaToken(body) });
    if (error?.code === "captcha_failed") return authJson({ error: "The human check failed. Try again.", code: "captcha_failed" }, 400);
    if (error) console.error("Password reset e-mail failed", error.code ?? error.status);
  }
  return authJson({ ok: true });
}
