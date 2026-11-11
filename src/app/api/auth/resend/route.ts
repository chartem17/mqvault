import { emailFrom, json, limitAuth, readJson, tooMany } from "@/lib/auth/auth-api";
import { createSessionSupabase } from "@/lib/supabase/session";

export const dynamic = "force-dynamic";
/** Seconds the page waits before offering "Resend" again (Supabase enforces its own minimum too). */
const RESEND_WAIT_SECONDS = 60;

/** POST { email, flow } → { ok, wait }. Always the same answer, whatever the address is. */
export async function POST(request: Request) {
  const body = await readJson(request);
  const email = emailFrom(body);
  if (!email) return json({ ok: true, wait: RESEND_WAIT_SECONDS });
  const limit = await limitAuth(request, "resend", email, [RESEND_WAIT_SECONDS - 5, 1], [3600, 12]);
  if (limit.blocked) return tooMany();
  const db = await createSessionSupabase();
  if (body.flow === "recovery") await db.auth.resetPasswordForEmail(email);
  else await db.auth.resend({ type: "signup", email });
  return json({ ok: true, wait: RESEND_WAIT_SECONDS });
}
