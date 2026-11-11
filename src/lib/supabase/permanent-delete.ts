import type { SupabaseClient } from "@supabase/supabase-js";
import { parseDeletionResult, type DeletionResult } from "./deletion-result";

export type { DeletionResult } from "./deletion-result";
export type DeletionKind = "trade" | "account" | "strategy";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The owner must come from the verified session, never request JSON. `db` is that user's own client, so the RPC
// runs as the user: it refuses any other owner id and row-level security applies inside it (ADR 0017).
export async function permanentlyDeleteOwnedEntity(db: SupabaseClient, trustedOwnerId: string, kind: DeletionKind, entityId: string): Promise<DeletionResult> {
  if (typeof window !== "undefined") throw new Error("Permanent deletion is server-only");
  if (!UUID.test(trustedOwnerId) || !UUID.test(entityId) || !["trade", "account", "strategy"].includes(kind)) throw new Error("Invalid deletion request");
  const { data, error } = await db.rpc("vault_delete_entity", { p_owner_id: trustedOwnerId, p_kind: kind, p_entity_id: entityId });
  if (error) {
    console.error("Permanent entity deletion failed", { code: error.code });
    throw new Error("Could not confirm the permanent deletion");
  }
  return parseDeletionResult(data);
}
