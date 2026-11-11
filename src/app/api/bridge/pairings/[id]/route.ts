import { createServiceSupabase } from "@/lib/supabase/server";
import { json, verifySignedRequest } from "@/lib/bridge/server";
import { pairingStatus } from "@/lib/bridge/pairing";

export const dynamic = "force-dynamic";

/**
 * GET → { status: "pending" | "approved" | "expired", device_id? }
 * Signed with the key from the pairing request (X-MQV-Device = pairing id), so only the PC that asked for the
 * code can learn its device id. Read-only, hence no replay counter.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = createServiceSupabase();
  type Pairing = { public_key: string; expires_at: string; approved_at: string | null; device_id: string | null; consumed_at: string | null };
  const found: { row: Pairing | null } = { row: null };
  const verified = await verifySignedRequest(request, async signedId => {
    if (signedId !== id.toLowerCase()) return null;
    const { data } = await db.from("bridge_pairings").select("public_key, expires_at, approved_at, device_id, consumed_at").eq("id", signedId).maybeSingle();
    found.row = data as Pairing | null;
    return found.row?.public_key ?? null;
  });
  if (verified instanceof Response) return verified;
  const pairing = found.row;
  if (!pairing) return json({ error: "unauthorized" }, 401);
  const status = pairingStatus(pairing, Date.now());
  if (status === "approved" || status === "consumed") {
    if (status === "approved") await db.from("bridge_pairings").update({ consumed_at: new Date().toISOString() }).eq("id", id).is("consumed_at", null);
    return json({ status: "approved", device_id: pairing.device_id });
  }
  return json({ status });
}
