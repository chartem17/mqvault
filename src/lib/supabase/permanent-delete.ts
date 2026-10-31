import { createServerSupabase } from "@/lib/supabase/server";
import { parseDeletionResult, type DeletionResult } from "./deletion-result";

export type { DeletionResult } from "./deletion-result";
export type DeletionKind = "trade" | "account" | "strategy";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The owner must come from verified server identity, never request JSON.
export async function permanentlyDeleteOwnedEntity(trustedOwnerId: string, kind: DeletionKind, entityId: string): Promise<DeletionResult> {
  if (typeof window !== "undefined") throw new Error("Permanent deletion is server-only");
  if (!UUID.test(trustedOwnerId) || !UUID.test(entityId) || !["trade", "account", "strategy"].includes(kind)) throw new Error("Invalid deletion request");
  const db = createServerSupabase();
  const { data, error } = await db.rpc("vault_delete_entity", { p_owner_id: trustedOwnerId, p_kind: kind, p_entity_id: entityId });
  if (error) {
    console.error("Permanent entity deletion failed", { code: error.code });
    throw new Error("Не вдалося підтвердити остаточне видалення");
  }
  return parseDeletionResult(data);
}
