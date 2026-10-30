import { NextRequest, NextResponse } from "next/server";
import { checkPrivateAccess } from "@/lib/private-access";
import { createServerSupabase } from "@/lib/supabase/server";
import { permanentlyDeleteOwnedEntity, type DeletionKind } from "@/lib/supabase/permanent-delete";

export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(request: NextRequest) {
  const denied = await checkPrivateAccess(request);
  if (denied) return denied;
  const kind = request.nextUrl.searchParams.get("kind");
  if (!kind || !["trade", "account", "strategy"].includes(kind)) return json({ error: "Invalid deletion kind" }, 400);
  let body: unknown;
  try { body = await request.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }
  if (!body || typeof body !== "object" || Array.isArray(body) || !("id" in body) || typeof body.id !== "string" || !UUID.test(body.id)) return json({ error: "A valid id is required" }, 400);
  try {
    // Private workspace login represents one owner, resolved only on the server.
    // Never read user_id or owner_id from client input.
    const db = createServerSupabase();
    const { data: owners, error } = await db.from("app_users").select("id").eq("is_owner", true).limit(2);
    if (error || !owners || owners.length !== 1) return json({ error: "Private workspace owner must be uniquely configured" }, 503);
    const result = await permanentlyDeleteOwnedEntity(owners[0].id, kind as DeletionKind, body.id);
    return json({ success: true, ...result });
  } catch (error) {
    console.error("DELETE /api/deletions failed", error instanceof Error ? error.message : "Unknown error");
    return json({ error: "Не вдалося підтвердити остаточне видалення. Оновіть дані для перевірки стану." }, 500);
  }
}
