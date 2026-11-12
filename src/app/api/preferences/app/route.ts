import { NextResponse } from "next/server";
import { resolveUser } from "@/lib/auth/current-user";
import { MAX_PREFERENCES_BYTES, mergePreferences, sanitizePreferences } from "@/lib/preferences/user-preferences";

export const dynamic = "force-dynamic";
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
/** Postgres "undefined column": the preferences migration is not applied yet; the client keeps its local copy. */
const MISSING_COLUMN = "42703";

/** GET → the signed-in user's settings, or `stored: false` while the column does not exist yet. */
export async function GET(request: Request) {
  const context = await resolveUser(request);
  if (context instanceof Response) return context;
  const { data, error } = await context.db.from("app_users").select("preferences").eq("id", context.ownerId).maybeSingle();
  if (error?.code === MISSING_COLUMN) return json({ preferences: null, stored: false });
  if (error || !data) return json({ error: "Could not load settings" }, 500);
  return json({ preferences: sanitizePreferences(data.preferences), stored: true });
}

/** PATCH { …partial settings } → merged and sanitized settings. Unknown keys are ignored. */
export async function PATCH(request: Request) {
  const context = await resolveUser(request);
  if (context instanceof Response) return context;
  const text = await request.text();
  if (text.length > MAX_PREFERENCES_BYTES) return json({ error: "Settings are too large" }, 413);
  let patch: unknown;
  try { patch = JSON.parse(text); } catch { return json({ error: "Invalid settings" }, 400); }
  const { data: current, error: readError } = await context.db.from("app_users").select("preferences").eq("id", context.ownerId).maybeSingle();
  if (readError?.code === MISSING_COLUMN) return json({ preferences: mergePreferences(sanitizePreferences({}), patch), stored: false });
  if (readError || !current) return json({ error: "Could not save settings" }, 500);
  const next = mergePreferences(sanitizePreferences(current.preferences), patch);
  const { error } = await context.db.from("app_users").update({ preferences: next, updated_at: new Date().toISOString() }).eq("id", context.ownerId);
  if (error) return json({ error: "Could not save settings" }, 500);
  return json({ preferences: next, stored: true });
}
