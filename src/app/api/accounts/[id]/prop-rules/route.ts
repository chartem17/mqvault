import { NextResponse } from "next/server";
import { resolvePrivateOwner } from "@/lib/supabase/private-owner";
import { AccountSetupError } from "@/lib/account-setup";
import { PROP_RULE_SELECT, RuleRevisionConflict, preparePropRuleUpdate, ruleRecordFromColumns } from "@/lib/prop-rule-record";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function json(value: unknown, status = 200) { return NextResponse.json(value, { status, headers: { "Cache-Control": "no-store" } }); }
function databaseError(code: string) {
  if (code === "42703" || code === "42P01") return json({ error: "Редагування умов потребує застосування міграції prop rules v1.", code: "schema_pending" }, 503);
  console.error("Prop rules database operation failed", { code });
  return json({ error: "Не вдалося виконати операцію з умовами рахунку" }, 500);
}
function failure(error: unknown) {
  if (error instanceof RuleRevisionConflict) return json({ error: error.message }, 409);
  if (error instanceof AccountSetupError) return json({ error: error.message }, 400);
  console.error("Prop rules operation failed");
  return json({ error: "Не вдалося виконати операцію з умовами рахунку" }, 500);
}
export async function GET(request: Request, context: Context) {
  try {
    const owner = await resolvePrivateOwner(request);
    if (owner instanceof Response) return owner;
    const { id } = await context.params;
    if (!UUID.test(id)) return json({ error: "Invalid account id" }, 400);
    const { data, error } = await owner.db.from("accounts").select(PROP_RULE_SELECT).eq("id", id).eq("user_id", owner.ownerId).eq("is_active", true).maybeSingle();
    if (error) return databaseError(error.code);
    if (!data) return json({ error: "Account not found" }, 404);
    if (data.account_type !== "prop") return json({ error: "Умови доступні лише для проп-рахунку" }, 400);
    return json({ data: ruleRecordFromColumns(data), reference: { kind: "unavailable", reason: "no_finalized_eod_history" } });
  } catch (error) { return failure(error); }
}
export async function PATCH(request: Request, context: Context) {
  try {
    const owner = await resolvePrivateOwner(request);
    if (owner instanceof Response) return owner;
    const { id } = await context.params;
    if (!UUID.test(id)) return json({ error: "Invalid account id" }, 400);
    const text = await request.text();
    if (text.length > 16384) return json({ error: "Rule payload is too large" }, 413);
    let body: unknown;
    try { body = JSON.parse(text); } catch { return json({ error: "Invalid JSON body" }, 400); }
    const { data: current, error: readError } = await owner.db.from("accounts").select(PROP_RULE_SELECT).eq("id", id).eq("user_id", owner.ownerId).eq("is_active", true).maybeSingle();
    if (readError) return databaseError(readError.code);
    if (!current) return json({ error: "Account not found" }, 404);
    const { expectedRevision, payload } = preparePropRuleUpdate(body, current);
    const { data, error } = await owner.db.from("accounts").update(payload).eq("id", id).eq("user_id", owner.ownerId).eq("is_active", true).eq("account_type", "prop").eq("prop_rules_revision", expectedRevision).select(PROP_RULE_SELECT).maybeSingle();
    if (error) return databaseError(error.code);
    if (!data) return json({ error: "Рахунок або його умови змінилися. Перечитайте дані перед збереженням." }, 409);
    return json({ data: ruleRecordFromColumns(data), reference: { kind: "unavailable", reason: "no_finalized_eod_history" } });
  } catch (error) { return failure(error); }
}
