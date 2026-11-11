/** Fixed-window rate limits stored in Postgres (`bridge_rate_limits`, service key). Server only. */
import { createServiceSupabase } from "@/lib/supabase/server";
import { sha256Hex } from "@/lib/bridge/signature";

/** Hashed caller address: enough to count attempts, nothing readable is stored. */
export async function clientIp(request: Request): Promise<string> {
  const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  return (await sha256Hex(ip)).slice(0, 32);
}

export async function hashKey(value: string): Promise<string> {
  return (await sha256Hex(value.trim().toLowerCase())).slice(0, 32);
}

/** Counts one attempt; true when the caller is over the limit. Fails closed if the counter is unavailable. */
export async function rateLimited(key: string, windowSeconds: number, max: number): Promise<boolean> {
  const { data, error } = await createServiceSupabase().rpc("bridge_rate_limit_hit", { p_key: key, p_window_seconds: windowSeconds, p_max: max });
  return Boolean(error) || data !== true;
}

export async function resetRateLimit(key: string): Promise<void> {
  await createServiceSupabase().rpc("bridge_rate_limit_reset", { p_key: key });
}
