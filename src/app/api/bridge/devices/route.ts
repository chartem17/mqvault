import { resolveUser } from "@/lib/auth/current-user";
import { recordAudit } from "@/lib/auth/audit";
import { json } from "@/lib/bridge/server";

export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** GET → paired PCs and the MT5 accounts they report (owner's session). */
export async function GET(request: Request) {
  const context = await resolveUser(request);
  if (context instanceof Response) return context;
  const { db, ownerId } = context;
  const [devices, terminals] = await Promise.all([
    db.from("bridge_devices").select("id, name, os, key_storage, bridge_version, last_seen_at, last_sync_at, revoked_at, created_at").eq("user_id", ownerId).order("created_at"),
    db.from("bridge_terminal_accounts").select("id, device_id, server, login, company, trade_mode, account_id, matched_at, ignored_at, needs_review, detected_zone, balance, equity, last_seen_at, last_sync_at").eq("user_id", ownerId).order("created_at"),
  ]);
  if (devices.error || terminals.error) return json({ error: "Failed to load devices" }, 500);
  return json({ devices: devices.data ?? [], accounts: terminals.data ?? [] });
}

/** DELETE ?id=<device> → revokes the PC immediately: its signature stops being accepted. Synced trades stay. */
export async function DELETE(request: Request) {
  const context = await resolveUser(request);
  if (context instanceof Response) return context;
  const { db, ownerId } = context;
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!UUID.test(id)) return json({ error: "id is required" }, 400);
  const { data, error } = await db.from("bridge_devices").update({ revoked_at: new Date().toISOString() }).eq("id", id).eq("user_id", ownerId).is("revoked_at", null).select("id").maybeSingle();
  if (error) return json({ error: "Failed to revoke" }, 500);
  if (!data) return json({ error: "Unknown device" }, 404);
  await recordAudit(request, { userId: ownerId }, "bridge_device_revoked");
  return json({ revoked: data.id });
}
