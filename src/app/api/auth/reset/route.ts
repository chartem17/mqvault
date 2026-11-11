import { emailFrom, json, limitAuth, readJson, tooMany } from "@/lib/auth/auth-api";
import { createSessionSupabase } from "@/lib/supabase/session";

export const dynamic = "force-dynamic";

/**
 * POST { email } → { step: "verify", flow: "recovery" }. A reset code is e-mailed if the account exists; the answer
 * never says whether it does. The code is checked by /api/auth/verify, then /api/auth/password sets the new one.
 */
export async function POST(request: Request) {
  const body = await readJson(request);
  const email = emailFrom(body);
  if (!email) return json({ error: "Enter a valid email" }, 400);
  const limit = await limitAuth(request, "reset", email, [3600, 4], [3600, 12]);
  if (limit.blocked) return tooMany();
  const db = await createSessionSupabase();
  const { error } = await db.auth.resetPasswordForEmail(email);
  if (error && error.status !== 429) console.error("Password reset request failed", { code: error.code });
  return json({ step: "verify", flow: "recovery" });
}
