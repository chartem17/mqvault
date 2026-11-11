import { emailFrom, json, limitAuth, readJson, tooMany } from "@/lib/auth/auth-api";
import { passwordProblem } from "@/lib/auth/request-guard";
import { isValidTimeZone } from "@/lib/time/timezone";
import { isLocale } from "@/lib/i18n/core";
import { createSessionSupabase } from "@/lib/supabase/session";

export const dynamic = "force-dynamic";

/**
 * POST { email, password, timezone?, locale? } → { step: "verify" }: a code is e-mailed and checked by /api/auth/verify.
 * The answer is the same whether or not the address already has an account (Supabase sends nothing new to a
 * confirmed one), so this endpoint cannot be used to list registered e-mails.
 */
export async function POST(request: Request) {
  const body = await readJson(request);
  const email = emailFrom(body);
  if (!email) return json({ error: "Enter a valid email" }, 400);
  const problem = passwordProblem(body.password);
  if (problem) return json({ error: problem }, 400);
  const limit = await limitAuth(request, "signup", email, [3600, 5], [3600, 15]);
  if (limit.blocked) return tooMany();

  const data: Record<string, string> = {};
  if (typeof body.timezone === "string" && body.timezone.length <= 64 && isValidTimeZone(body.timezone)) data.timezone = body.timezone;
  if (isLocale(body.locale)) data.locale = body.locale;
  const db = await createSessionSupabase();
  const { data: result, error } = await db.auth.signUp({ email, password: body.password as string, options: { data } });
  if (error?.code === "weak_password") return json({ error: "Password is too weak" }, 400);
  if (error?.code === "over_email_send_rate_limit" || error?.status === 429) return tooMany();
  if (error) { console.error("Sign-up failed", { code: error.code }); return json({ error: "Could not sign up. Try again later." }, 500); }
  // Projects with e-mail confirmation switched off sign the user in at once.
  if (result.session) return json({ ok: true });
  return json({ step: "verify", flow: "signup" });
}
