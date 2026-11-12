/**
 * Security log writer (package 3). Server only; written with the service key so a user cannot forge or erase
 * entries. Best effort: a failed log write never fails the action it describes.
 */
import { createServerSupabase } from "@/lib/supabase/server";
import { sha256Hex } from "@/lib/bridge/signature";

export type AuditAction =
  | "sign_in" | "password_changed" | "sign_out_everywhere" | "data_exported"
  | "account_deleted" | "strategy_deleted" | "bridge_device_connected" | "bridge_device_revoked";

type Target = { userId: string } | { authUserId: string };

export async function recordAudit(request: Request, target: Target, action: AuditAction, extra: { method?: string; detail?: Record<string, string | number | boolean> } = {}): Promise<void> {
  try {
    const db = createServerSupabase();
    let userId = "userId" in target ? target.userId : null;
    if (!userId && "authUserId" in target) {
      const { data } = await db.from("app_users").select("id").eq("auth_user_id", target.authUserId).maybeSingle();
      userId = (data?.id as string | undefined) ?? null;
    }
    if (!userId) return;
    const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
    await db.from("audit_events").insert({
      user_id: userId, action, method: extra.method ?? null, detail: extra.detail ?? {},
      // The address is stored hashed: enough to tell "same place or not", not to locate anyone.
      ip_hash: ip ? (await sha256Hex(`audit:${ip}`)).slice(0, 32) : null,
      user_agent: (request.headers.get("user-agent") ?? "").slice(0, 300) || null,
    });
  } catch { /* the log never blocks the action */ }
}
