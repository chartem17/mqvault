import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/session";

export const dynamic = "force-dynamic";

/** GET → the caller's active sign-in sessions (Settings → Security). Only own rows, enforced in the function. */
export async function GET(request: Request) {
  const context = await requireUser(request);
  if (context instanceof Response) return context;
  const { data, error } = await context.db.rpc("list_my_sessions");
  if (error) return NextResponse.json({ error: "Could not load sessions" }, { status: 500, headers: { "Cache-Control": "no-store" } });
  return NextResponse.json({ sessions: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
}
