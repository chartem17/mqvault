import { NextResponse } from "next/server";
import { resolvePrivateOwner } from "@/lib/supabase/private-owner";
import { permanentlyDeleteOwnedEntity } from "@/lib/supabase/permanent-delete";
import { AccountSetupError } from "./account-setup";
import { buildAccountPayload, type AccountRecord } from "./account-payload";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FIELDS = "id,name,broker,platform,account_type,currency,mt5_login,mt5_server,initial_balance,phase,target_percent,max_loss_percent,daily_loss_percent,min_trading_days,is_active,status,color,parent_account_id";
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
  return json({ error: "Не вдалося виконати операцію з рахунком" }, 500);
}
export async function GET(request: Request) {
  try {
    const context = await resolvePrivateOwner(request);
    if (context instanceof Response) return context;
    const { data, error } = await context.db.from("accounts").select(FIELDS).eq("user_id", context.ownerId).eq("is_active", true).order("created_at", { ascending: true });
    if (error) throw new Error(error.code);
    return json({ data: data ?? [] });
  } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  try {
    const context = await resolvePrivateOwner(request);
    if (context instanceof Response) return context;
    const body = await readBody(request);
    const payload = buildAccountPayload(body);
    if (payload.parent_account_id) {
      const { data: parent, error } = await context.db.from("accounts").select("id").eq("id", payload.parent_account_id).eq("user_id", context.ownerId).maybeSingle();
      if (error) throw new Error(error.code);
      if (!parent) return json({ error: "Parent account not found" }, 404);
    }
    const { data, error } = await context.db.from("accounts").insert({ ...payload, user_id: context.ownerId, is_active: true }).select(FIELDS).single();
    if (error) { if (error.code === "23505") return json({ error: "Такий рахунок уже існує" }, 409); throw new Error(error.code); }
    return json({ data }, 201);
  } catch (error) { return failure(error); }
}
export async function PATCH(request: Request) {
  try {
    const context = await resolvePrivateOwner(request);
    if (context instanceof Response) return context;
    const body = await readBody(request);
    if (typeof body.id !== "string" || !UUID.test(body.id)) throw new AccountSetupError("Invalid account id");
    const { data: current, error: readError } = await context.db.from("accounts").select(FIELDS).eq("id", body.id).eq("user_id", context.ownerId).maybeSingle();
    if (readError) throw new Error(readError.code);
    if (!current) return json({ error: "Account not found" }, 404);
    const payload = buildAccountPayload(body, current);
    if (Object.keys(payload).length === 0) throw new AccountSetupError("No editable fields supplied");
    if (payload.parent_account_id) {
      if (payload.parent_account_id === body.id) throw new AccountSetupError("Account cannot be its own parent");
      const { data: parent, error } = await context.db.from("accounts").select("id").eq("id", payload.parent_account_id).eq("user_id", context.ownerId).maybeSingle();
      if (error) throw new Error(error.code);
      if (!parent) return json({ error: "Parent account not found" }, 404);
    }
    const { data, error } = await context.db.from("accounts").update(payload).eq("id", body.id).eq("user_id", context.ownerId).select(FIELDS).maybeSingle();
    if (error) throw new Error(error.code);
    if (!data) return json({ error: "Account not found" }, 404);
    return json({ data });
  } catch (error) { return failure(error); }
}
export async function DELETE(request: Request) {
  try {
    const context = await resolvePrivateOwner(request);
    if (context instanceof Response) return context;
    const body = await readBody(request);
    if (typeof body.id !== "string" || !UUID.test(body.id)) throw new AccountSetupError("Invalid account id");
    const result = await permanentlyDeleteOwnedEntity(context.ownerId, "account", body.id);
    return json({ success: true, ...result });
  } catch (error) { return failure(error); }
}
