import { NextResponse } from "next/server";
import { resolveUser } from "@/lib/auth/current-user";

export const dynamic = "force-dynamic";
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
/** Postgres "undefined table": the audit migration is not applied yet. */
const MISSING_TABLE = "42P01";

/** GET → the signed-in user's last 30 security events (Settings → Security). Own rows only: filter + RLS. */
export async function GET(request: Request) {
  const context = await resolveUser(request);
  if (context instanceof Response) return context;
  const { data, error } = await context.db.from("audit_events")
    .select("id, action, method, detail, ip_hash, user_agent, created_at")
    .eq("user_id", context.ownerId).order("created_at", { ascending: false }).limit(30);
  if (error?.code === MISSING_TABLE) return json({ events: [], available: false });
  if (error) return json({ error: "Could not load activity" }, 500);
  return json({ events: data ?? [], available: true });
}
