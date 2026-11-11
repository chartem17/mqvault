import { NextResponse } from "next/server";
import { siteOrigin } from "@/lib/auth/auth-api";
import { safeNextPath } from "@/lib/auth/request-guard";
import { createSessionSupabase } from "@/lib/supabase/session";

export const dynamic = "force-dynamic";

/** OAuth return address: exchanges the one-time code for a session cookie, then goes to a local path only. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = siteOrigin(request);
  const code = url.searchParams.get("code");
  const headers = { "Cache-Control": "no-store" };
  if (!code || code.length > 512) return NextResponse.redirect(new URL("/login?error=oauth", origin), { headers });
  const db = await createSessionSupabase();
  const { error } = await db.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL("/login?error=oauth", origin), { headers });
  return NextResponse.redirect(new URL(safeNextPath(url.searchParams.get("next")), origin), { headers });
}
