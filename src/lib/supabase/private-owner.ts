import { NextResponse } from "next/server";
import { checkPrivateAccess } from "@/lib/private-access";
import { createServerSupabase } from "@/lib/supabase/server";

export async function resolvePrivateOwner(request: Request) {
  const denied = await checkPrivateAccess(request);
  if (denied) return denied;
  const db = createServerSupabase();
  const { data, error } = await db.from("app_users").select("id").eq("is_owner", true).limit(2);
  if (error || !data || data.length !== 1) {
    return NextResponse.json({ error: "Private workspace owner must be uniquely configured" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  return { db, ownerId: data[0].id as string };
}
