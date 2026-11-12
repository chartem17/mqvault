import { resolveUser } from "@/lib/auth/current-user";
import { json } from "@/lib/bridge/server";
import { sha256Hex } from "@/lib/bridge/signature";
import { APPROVE_LOCK_MS, MAX_FAILED_APPROVALS, normalizeUserCode, pairingStatus } from "@/lib/bridge/pairing";

export const dynamic = "force-dynamic";

/**
 * POST { user_code, confirm } — owner's session, same-origin (middleware).
 * confirm=false: shows which PC asks for access (name, OS, Bridge version). confirm=true: creates the device.
 * At most MAX_FAILED_APPROVALS attempts per APPROVE_LOCK_MS; a successful confirmation resets the counter.
 */
export async function POST(request: Request) {
  const context = await resolveUser(request);
  if (context instanceof Response) return context;
  const { db, ownerId } = context;
  const body = await request.json().catch(() => null) as { user_code?: unknown; confirm?: unknown } | null;
  const limitKey = `approve:${ownerId}`;
  const { data: allowed, error: limitError } = await db.rpc("bridge_rate_limit_hit", { p_key: limitKey, p_window_seconds: APPROVE_LOCK_MS / 1000, p_max: MAX_FAILED_APPROVALS });
  if (limitError) return json({ error: "unavailable" }, 503);
  if (allowed !== true) return json({ error: "rate_limited" }, 429);

  const code = normalizeUserCode(body?.user_code);
  if (!code) return json({ error: "invalid_code" }, 400);
  const { data: pairing } = await db.from("bridge_pairings")
    .select("id, public_key, key_fingerprint, key_storage, device_name, os, bridge_version, expires_at, approved_at, device_id, consumed_at")
    .eq("user_code_hash", await sha256Hex(code)).maybeSingle();
  if (!pairing || pairingStatus(pairing, Date.now()) !== "pending") return json({ error: "invalid_code" }, 404);
  const device = { name: pairing.device_name, os: pairing.os, bridge_version: pairing.bridge_version, key_storage: pairing.key_storage };
  if (body?.confirm !== true) return json({ device });

  const { data: created, error } = await db.from("bridge_devices").insert({
    user_id: ownerId, name: pairing.device_name, os: pairing.os, public_key: pairing.public_key, key_fingerprint: pairing.key_fingerprint,
    key_storage: pairing.key_storage, bridge_version: pairing.bridge_version,
  }).select("id").single();
  if (error || !created) return json({ error: error?.code === "23505" ? "key_already_paired" : "unavailable" }, error?.code === "23505" ? 409 : 503);
  const { data: approved } = await db.from("bridge_pairings")
    .update({ approved_at: new Date().toISOString(), approved_by: ownerId, device_id: created.id })
    .eq("id", pairing.id).is("approved_at", null).select("id").maybeSingle();
  if (!approved) {
    await db.from("bridge_devices").delete().eq("id", created.id);
    return json({ error: "invalid_code" }, 404);
  }
  await db.rpc("bridge_rate_limit_reset", { p_key: limitKey });
  return json({ device: { id: created.id, ...device } }, 201);
}
