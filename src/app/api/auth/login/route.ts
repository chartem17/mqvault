import { emailFrom, json, limitAuth, readJson, refusalDelay, tooMany } from "@/lib/auth/auth-api";
import { resetRateLimit } from "@/lib/auth/rate-limit";
import { createSessionSupabase } from "@/lib/supabase/session";

export const dynamic = "force-dynamic";

/**
 * POST { email, password } → { ok } with the session in httpOnly cookies, or { step: "verify" } when the address
 * still has to be confirmed with the e-mailed code. Unknown e-mail and wrong password are indistinguishable.
 */
export async function POST(request: Request) {
  const body = await readJson(request);
  const email = emailFrom(body);
  const password = typeof body.password === "string" && body.password.length <= 512 ? body.password : "";
  if (!email || !password) { await refusalDelay(); return json({ error: "Wrong email or password" }, 401); }
  const limit = await limitAuth(request, "login", email, [600, 8], [600, 40]);
  if (limit.blocked) return tooMany();

  const db = await createSessionSupabase();
  const { data, error } = await db.auth.signInWithPassword({ email, password });
  if (error?.code === "email_not_confirmed") {
    // Only reachable with the right password. Send a fresh code and continue in the same card.
    await db.auth.resend({ type: "signup", email });
    return json({ step: "verify", flow: "signup" });
  }
  if (error || !data.session) { await refusalDelay(); return json({ error: "Wrong email or password" }, 401); }
  await resetRateLimit(limit.pairKey);
  return json({ ok: true });
}
