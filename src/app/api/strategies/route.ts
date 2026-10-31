import { NextResponse } from "next/server";
import { resolvePrivateOwner } from "@/lib/supabase/private-owner";
import { permanentlyDeleteOwnedEntity } from "@/lib/supabase/permanent-delete";
import { isRecord, parseStrategyRules, StrategyInputError, STRATEGY_UUID, toStrategyProfile } from "@/lib/strategy-control/strategy-storage";

export const dynamic = "force-dynamic";
function json(body: Record<string, unknown>, status = 200) { return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } }); }
async function readBody(request: Request) {
  const text = await request.text();
  if (text.length > 131072) throw new StrategyInputError("Strategy payload is too large");
  let body: unknown;
  try { body = JSON.parse(text); } catch { throw new StrategyInputError("Invalid JSON body"); }
  if (!isRecord(body)) throw new StrategyInputError("Invalid strategy payload");
  return body;
}
function nameOf(value: unknown) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > 200) throw new StrategyInputError("Strategy name is required (up to 200 characters)");
  return value.trim();
}
function descriptionOf(value: unknown) {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string" || value.length > 10000) throw new StrategyInputError("Invalid description");
  return value.trim() || null;
}
function definitionOf(body: Record<string, unknown>) {
  if (body.definition !== undefined && !isRecord(body.definition)) throw new StrategyInputError("Invalid definition");
  const definition = isRecord(body.definition) ? body.definition : body;
  return { rules: parseStrategyRules(definition.rules) };
}
function failure(error: unknown) {
  if (error instanceof StrategyInputError) return json({ error: error.message }, 400);
  console.error("Strategy API failed", error instanceof Error ? error.message : "Unknown error");
  return json({ error: "Не вдалося виконати операцію зі стратегією" }, 500);
}

export async function GET(request: Request) {
  try {
    const context = await resolvePrivateOwner(request);
    if (context instanceof Response) return context;
    const accountId = new URL(request.url).searchParams.get("accountId");
    if (accountId && accountId !== "all" && !STRATEGY_UUID.test(accountId)) return json({ error: "Invalid accountId" }, 400);
    let query = context.db.from("strategy_rules").select("*").eq("user_id", context.ownerId).order("created_at", { ascending: false }).limit(1000);
    if (accountId && accountId !== "all") query = query.eq("account_id", accountId);
    const { data, error } = await query;
    if (error) return json({ error: "Не вдалося завантажити стратегії" }, 500);
    try { return json({ strategies: data ?? [], profiles: (data ?? []).map(toStrategyProfile) }); }
    catch { return json({ error: "Збережена стратегія має некоректний формат правил" }, 500); }
  } catch (error) { return failure(error); }
}

export async function POST(request: Request) {
  try {
    const context = await resolvePrivateOwner(request);
    if (context instanceof Response) return context;
    const body = await readBody(request);
    if (typeof body.account_id !== "string" || !STRATEGY_UUID.test(body.account_id)) return json({ error: "Choose a specific account before saving a strategy" }, 400);
    const name = nameOf(body.name);
    const description = descriptionOf(body.description);
    const definition = definitionOf(body);
    const source = body.source_strategy_id ?? null;
    if (source !== null && (typeof source !== "string" || !STRATEGY_UUID.test(source))) return json({ error: "Invalid source strategy" }, 400);
    const { data: account, error: accountError } = await context.db.from("accounts").select("id").eq("id", body.account_id).eq("user_id", context.ownerId).eq("is_active", true).maybeSingle();
    if (accountError) return json({ error: "Failed to verify account" }, 500);
    if (!account) return json({ error: "Account not found" }, 404);
    if (source) {
      const { data: original, error: sourceError } = await context.db.from("strategy_rules").select("id").eq("id", source).eq("user_id", context.ownerId).maybeSingle();
      if (sourceError) return json({ error: "Failed to verify source strategy" }, 500);
      if (!original) return json({ error: "Source strategy not found" }, 404);
    }
    const { data, error } = await context.db.from("strategy_rules").insert({ user_id: context.ownerId, account_id: body.account_id, name, description, definition, source_strategy_id: source }).select("*").single();
    if (error) return json({ error: "Не вдалося зберегти стратегію" }, error.code === "23505" ? 409 : 500);
    return json({ strategy: data, profile: toStrategyProfile(data) }, 201);
  } catch (error) { return failure(error); }
}

export async function PATCH(request: Request) {
  try {
    const context = await resolvePrivateOwner(request);
    if (context instanceof Response) return context;
    const body = await readBody(request);
    if (typeof body.id !== "string" || !STRATEGY_UUID.test(body.id)) return json({ error: "Invalid strategy id" }, 400);
    const fields: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.name !== undefined) fields.name = nameOf(body.name);
    if (body.description !== undefined) fields.description = descriptionOf(body.description);
    if (body.definition !== undefined || body.rules !== undefined) fields.definition = definitionOf(body);
    if (Object.keys(fields).length === 1) return json({ error: "No editable fields supplied" }, 400);
    const { data, error } = await context.db.from("strategy_rules").update(fields).eq("id", body.id).eq("user_id", context.ownerId).select("*").maybeSingle();
    if (error) return json({ error: "Не вдалося оновити стратегію" }, 500);
    if (!data) return json({ error: "Strategy not found" }, 404);
    return json({ strategy: data, profile: toStrategyProfile(data) });
  } catch (error) { return failure(error); }
}

export async function DELETE(request: Request) {
  try {
    const context = await resolvePrivateOwner(request);
    if (context instanceof Response) return context;
    const body = await readBody(request);
    if (typeof body.id !== "string" || !STRATEGY_UUID.test(body.id)) return json({ error: "Invalid strategy id" }, 400);
    const result = await permanentlyDeleteOwnedEntity(context.ownerId, "strategy", body.id);
    return json({ success: true, ...result });
  } catch (error) { return failure(error); }
}
