import { NextRequest, NextResponse } from "next/server";
import { resolveUser } from "@/lib/auth/current-user";
import { permanentlyDeleteOwnedEntity, type DeletionKind } from "@/lib/supabase/permanent-delete";

export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(request: NextRequest) {
  const context = await resolveUser(request);
  if (context instanceof Response) return context;
  const kind = request.nextUrl.searchParams.get("kind");
  if (!kind || !["trade", "account", "strategy"].includes(kind)) return json({ error: "Invalid deletion kind" }, 400);
  let body: unknown;
  try { body = await request.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }
  if (!body || typeof body !== "object" || Array.isArray(body) || !("id" in body) || typeof body.id !== "string" || !UUID.test(body.id)) return json({ error: "A valid id is required" }, 400);
  try {
    // The owner of the entity is the signed-in user, resolved on the server. Never read user_id from client input.
    const result = await permanentlyDeleteOwnedEntity(context.ownerId, kind as DeletionKind, body.id);
    return json({ success: true, ...result });
  } catch (error) {
    console.error("DELETE /api/deletions failed", error instanceof Error ? error.message : "Unknown error");
    return json({ error: "Could not confirm the permanent deletion. Reload to check the state." }, 500);
  }
}
