import { createServerSupabase } from "@/lib/supabase/server";

export type DeletionKind = "trade" | "account" | "strategy";
export type DeletionResult = { deleted: boolean; trades_deleted?: number; strategies_deleted?: number };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Server callers MUST resolve trustedOwnerId from verified identity, never request JSON.
// Do not expose this through the legacy is_owner lookup without an access-control gate.
export async function permanentlyDeleteOwnedEntity(trustedOwnerId: string, kind: DeletionKind, entityId: string): Promise<DeletionResult> {
  if (typeof window !== "undefined") throw new Error("Permanent deletion is server-only");
  if (!UUID.test(trustedOwnerId) || !UUID.test(entityId) || !["trade", "account", "strategy"].includes(kind)) throw new Error("Invalid deletion request");
  const db = createServerSupabase();
  const { data, error } = await db.rpc("vault_delete_entity", { p_owner_id: trustedOwnerId, p_kind: kind, p_entity_id: entityId });
  if (error) {
    console.error("Permanent entity deletion failed", { code: error.code });
    throw new Error("Не вдалося підтвердити остаточне видалення");
  }
  if (!data || typeof data.deleted !== "boolean") throw new Error("Invalid deletion response");
  return data as DeletionResult;
}
