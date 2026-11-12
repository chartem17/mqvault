import { NextResponse } from "next/server";
import { recordAudit } from "@/lib/auth/audit";
import { resolveUser } from "@/lib/auth/current-user";
import { permanentlyDeleteOwnedEntity } from "@/lib/supabase/permanent-delete";
import { AccountSetupError } from "./account-setup";
import { buildAccountPayload, type AccountRecord } from "./account-payload";
import { linkError } from "./account-chain";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FIELDS = "id,name,broker,platform,account_type,currency,mt5_login,mt5_server,initial_balance,phase,target_percent,max_loss_percent,daily_loss_percent,min_trading_days,is_active,status,color,parent_account_id,broker_timezone,prop_target_state";
type OwnerContext = Exclude<Awaited<ReturnType<typeof resolveUser>>, Response>;
/** Checks a prop-branch link against the owner's accounts only (existence, prop type, no loops, one next stage per parent). */
async function parentError(context: OwnerContext, accountId: string | null, parentId: string): Promise<string | null> {
  const { data, error } = await context.db.from("accounts").select("id,account_type,parent_account_id").eq("user_id", context.ownerId).eq("is_active", true);
  if (error) throw new Error(error.code);
  const rows = (data ?? []).map(row => ({ id: row.id as string, accountType: row.account_type as string, parentAccountId: row.parent_account_id as string | null }));
  if (!rows.some(row => row.id === parentId)) return "Previous stage not found";
  if (accountId === null) {
    if (rows.find(row => row.id === parentId)?.accountType !== "prop") return "Only prop accounts can be linked";
    return rows.some(row => row.parentAccountId === parentId) ? "This stage already has a next account" : null;
  }
  return linkError(accountId, parentId, rows);
}
function json(body: AccountRecord, status = 200) { return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } }); }
async function readBody(request: Request): Promise<AccountRecord> {
  const text = await request.text();
  if (text.length > 65536) throw new AccountSetupError("Account payload is too large");
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new AccountSetupError("Invalid JSON body"); }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new AccountSetupError("Invalid account payload");
  return value as AccountRecord;
}
function failure(error: unknown) {
  if (error instanceof AccountSetupError) return json({ error: error.message }, 400);
  console.error("Account API failed", error instanceof Error ? error.message : "Unknown error");
  return json({ error: "Account operation failed" }, 500);
}
export async function GET(request: Request) {
  try {
    const context = await resolveUser(request);
    if (context instanceof Response) return context;
    const { data, error } = await context.db.from("accounts").select(FIELDS).eq("user_id", context.ownerId).eq("is_active", true).order("created_at", { ascending: true });
    if (error) throw new Error(error.code);
    return json({ data: data ?? [] });
  } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  try {
    const context = await resolveUser(request);
    if (context instanceof Response) return context;
    const body = await readBody(request);
    const payload = buildAccountPayload(body);
    if (payload.parent_account_id) {
      if (payload.account_type !== "prop") throw new AccountSetupError("Only prop accounts can be linked");
      const message = await parentError(context, null, String(payload.parent_account_id));
      if (message) return json({ error: message }, 400);
    }
    const { data, error } = await context.db.from("accounts").insert({ ...payload, user_id: context.ownerId, is_active: true }).select(FIELDS).single();
    if (error) { if (error.code === "23505") return json({ error: "This account already exists" }, 409); throw new Error(error.code); }
    return json({ data }, 201);
  } catch (error) { return failure(error); }
}
export async function PATCH(request: Request) {
  try {
    const context = await resolveUser(request);
    if (context instanceof Response) return context;
    const body = await readBody(request);
    if (typeof body.id !== "string" || !UUID.test(body.id)) throw new AccountSetupError("Invalid account id");
    const { data: current, error: readError } = await context.db.from("accounts").select(FIELDS).eq("id", body.id).eq("user_id", context.ownerId).maybeSingle();
    if (readError) throw new Error(readError.code);
    if (!current) return json({ error: "Account not found" }, 404);
    const payload = buildAccountPayload(body, current);
    if (Object.keys(payload).length === 0) throw new AccountSetupError("No editable fields supplied");
    if (payload.parent_account_id !== undefined || (payload.account_type !== undefined && payload.account_type !== "prop" && current.parent_account_id)) {
      if (payload.account_type !== undefined && payload.account_type !== "prop") payload.parent_account_id = null;
      else if (payload.parent_account_id) {
        const message = await parentError(context, body.id, String(payload.parent_account_id));
        if (message) return json({ error: message }, 400);
      }
    }
    const { data, error } = await context.db.from("accounts").update(payload).eq("id", body.id).eq("user_id", context.ownerId).select(FIELDS).maybeSingle();
    if (error) throw new Error(error.code);
    if (!data) return json({ error: "Account not found" }, 404);
    return json({ data });
  } catch (error) { return failure(error); }
}
export async function DELETE(request: Request) {
  try {
    const context = await resolveUser(request);
    if (context instanceof Response) return context;
    const body = await readBody(request);
    if (typeof body.id !== "string" || !UUID.test(body.id)) throw new AccountSetupError("Invalid account id");
    const result = await permanentlyDeleteOwnedEntity(context.db, context.ownerId, "account", body.id);
    if (result.deleted) await recordAudit(request, { userId: context.ownerId }, "account_deleted", { detail: { trades: Number(result.trades_deleted ?? 0) } });
    return json({ success: true, ...result });
  } catch (error) { return failure(error); }
}
