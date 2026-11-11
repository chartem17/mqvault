import { emailFrom, json, limitAuth, readJson, tooMany } from "@/lib/auth/auth-api";
import { normalizeOtp } from "@/lib/auth/request-guard";
import { resetRateLimit } from "@/lib/auth/rate-limit";
import { createSessionSupabase } from "@/lib/supabase/session";

export const dynamic = "force-dynamic";

/**
 * POST { email, code, flow: "signup" | "recovery" } → { ok } and a session cookie. The code comes from the e-mail
 * Supabase sent (sign-up confirmation or password reset). A few wrong codes lock this address + caller for a while.
 */
export async function POST(request: Request) {
  const body = await readJson(request);
  const email = emailFrom(body);
  const code = normalizeOtp(body.code);
  const flow = body.flow === "recovery" ? "recovery" : "signup";
  if (!email || !code) return json({ error: "Invalid or expired code" }, 400);
  const limit = await limitAuth(request, "verify", email, [900, 6], [900, 30]);
  if (limit.blocked) return tooMany();

  const db = await createSessionSupabase();
  const { data, error } = await db.auth.verifyOtp({ email, token: code, type: flow === "recovery" ? "recovery" : "email" });
  if (error || !data.session) return json({ error: "Invalid or expired code" }, 400);
  await resetRateLimit(limit.pairKey);
  return json({ ok: true, flow });
}
