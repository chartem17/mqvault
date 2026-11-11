import { json, readJson } from "@/lib/auth/auth-api";
import { createSessionSupabase } from "@/lib/supabase/session";

export const dynamic = "force-dynamic";

/** POST { scope?: "local" | "others" | "global" } — this device (default), every other device, or everywhere. */
export async function POST(request: Request) {
  const body = await readJson(request, 256);
  const scope = body.scope === "global" || body.scope === "others" ? body.scope : "local";
  const db = await createSessionSupabase();
  const { error } = await db.auth.signOut({ scope });
  if (error && scope !== "local") return json({ error: "Could not sign out" }, 500);
  return json({ ok: true });
}
