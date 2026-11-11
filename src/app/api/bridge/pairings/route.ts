import { createServiceSupabase } from "@/lib/supabase/server";
import { json, parseJson, readBody } from "@/lib/bridge/server";
import { importPublicKey, keyFingerprint, sha256Hex } from "@/lib/bridge/signature";
import { generateUserCode, MAX_PAIRINGS_PER_IP_HOUR, PAIRING_TTL_MS, parsePairingRequest } from "@/lib/bridge/pairing";

export const dynamic = "force-dynamic";

/**
 * POST { public_key, device_name, os, bridge_version, key_storage } → { pairing_id, user_code, expires_at, verification_path }
 * Public (no session): the Bridge calls it once on first start. Limited per IP. The code is shown on the PC and
 * confirmed by the owner on /bridge/connect; only its hash is stored.
 */
export async function POST(request: Request) {
  const db = createServiceSupabase();
  const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  const { data: allowed, error: limitError } = await db.rpc("bridge_rate_limit_hit", { p_key: `pair:${await sha256Hex(ip)}`, p_window_seconds: 3600, p_max: MAX_PAIRINGS_PER_IP_HOUR });
  if (limitError) return json({ error: "unavailable" }, 503);
  if (allowed !== true) return json({ error: "rate_limited" }, 429);

  const bytes = await readBody(request);
  if (!bytes) return json({ error: "too_large" }, 413);
  const body = parsePairingRequest(parseJson(bytes));
  if (!body || !(await importPublicKey(body.public_key))) return json({ error: "invalid_request" }, 400);
  const fingerprint = await keyFingerprint(body.public_key);
  if (!fingerprint) return json({ error: "invalid_request" }, 400);
  const { data: known } = await db.from("bridge_devices").select("id").eq("key_fingerprint", fingerprint).maybeSingle();
  if (known) return json({ error: "key_already_paired" }, 409);

  const expiresAt = new Date(Date.now() + PAIRING_TTL_MS).toISOString();
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = generateUserCode();
    const { data, error } = await db.from("bridge_pairings").insert({
      user_code_hash: await sha256Hex(code.replace("-", "")), public_key: body.public_key, key_fingerprint: fingerprint, key_storage: body.key_storage,
      device_name: body.device_name, os: body.os, bridge_version: body.bridge_version, expires_at: expiresAt,
    }).select("id").single();
    if (!error && data) return json({ pairing_id: data.id, user_code: code, expires_at: expiresAt, verification_path: `/bridge/connect?code=${code}` }, 201);
    if (error?.code !== "23505") return json({ error: "unavailable" }, 503);
  }
  return json({ error: "unavailable" }, 503);
}
