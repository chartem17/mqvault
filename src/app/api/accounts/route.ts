import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Body = Record<string, unknown>;

function fail(status: number, error: string, detail?: string) {
  return NextResponse.json(
    {
      error,
      ...(process.env.NODE_ENV !== "production" && detail ? { detail } : {}),
    },
    { status },
  );
}

function toText(value: unknown) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length ? text : null;
}

function toNum(value: unknown) {
  if (value === "" || value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

async function getOwnerId() {
  const supabase = createServerSupabase();

  const { data, error } = await supabase
    .from("app_users")
    .select("id")
    .eq("is_owner", true)
    .limit(1)
    .maybeSingle();

  if (error || !data?.id) {
    console.error("API /accounts owner error:", error);
    return null;
  }

  return data.id;
}

async function readJson(request: NextRequest): Promise<Body | null> {
  try {
    const body = await request.json();
    if (!body || typeof body !== "object") return null;
    return body as Body;
  } catch {
    return null;
  }
}

function mapDbRow(row: {
  id: string;
  name: string;
  broker: string | null;
  platform: string;
  account_type: string;
  currency: string;
  mt5_login: string | null;
  mt5_server: string | null;
  initial_balance: number | null;
  phase: string | null;
  target_percent: number | null;
  max_loss_percent: number | null;
  daily_loss_percent: number | null;
  is_active: boolean;
  status: string;
  color: string | null;
  parent_account_id: string | null;
}) {
  return row;
}

function buildInsertPayload(body: Body, userId: string) {
  const platform = body.platform === "mt5" ? "mt5" : "manual";
  const accountType =
    toText(body.account_type) ?? (platform === "mt5" ? "prop" : "personal");

  return {
    user_id: userId,
    name: toText(body.name),
    broker: toText(body.broker),
    platform,
    account_type: accountType,
    currency: body.currency === "USDT" ? "USDT" : "USD",
    mt5_login: toText(body.mt5Login ?? body.mt5_login),
    mt5_server: toText(body.mt5Server ?? body.mt5_server),
    initial_balance: toNum(body.initialBalance ?? body.initial_balance),
    phase: toText(body.phase),
    target_percent: toNum(body.targetPercent ?? body.target_percent),
    max_loss_percent: toNum(body.maxLossPercent ?? body.max_loss_percent),
    daily_loss_percent: toNum(body.dailyLossPercent ?? body.daily_loss_percent),
    is_active: body.is_active === false ? false : true,
    status: toText(body.status) ?? "active",
    color: toText(body.color),
    parent_account_id: toText(body.parentAccountId ?? body.parent_account_id),
  };
}

function buildUpdatePayload(body: Body) {
  return {
    name: toText(body.name),
    broker: toText(body.broker),
    platform: body.platform === "mt5" ? "mt5" : "manual",
    account_type: toText(body.account_type),
    currency: body.currency === "USDT" ? "USDT" : "USD",
    mt5_login: toText(body.mt5Login ?? body.mt5_login),
    mt5_server: toText(body.mt5Server ?? body.mt5_server),
    initial_balance: toNum(body.initialBalance ?? body.initial_balance),
    phase: toText(body.phase),
    target_percent: toNum(body.targetPercent ?? body.target_percent),
    max_loss_percent: toNum(body.maxLossPercent ?? body.max_loss_percent),
    daily_loss_percent: toNum(body.dailyLossPercent ?? body.daily_loss_percent),
    status: toText(body.status),
    color: toText(body.color),
    parent_account_id: toText(body.parentAccountId ?? body.parent_account_id),
  };
}

const SELECT_FIELDS =
  "id, name, broker, platform, account_type, currency, mt5_login, mt5_server, initial_balance, phase, target_percent, max_loss_percent, daily_loss_percent, is_active, status, color, parent_account_id";

export async function GET() {
  try {
    const supabase = createServerSupabase();
    const ownerId = await getOwnerId();
    if (!ownerId) return fail(500, "Owner not found");

    const { data, error } = await supabase
      .from("accounts")
      .select(SELECT_FIELDS)
      .eq("user_id", ownerId)
      .eq("is_active", true)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("GET /accounts error:", error);
      return fail(500, "Failed to fetch accounts", error.message);
    }

    return NextResponse.json({ data: (data ?? []).map(mapDbRow) });
  } catch (error) {
    console.error("GET /accounts unexpected error:", error);
    return fail(500, "Unexpected server error");
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await readJson(request);
    if (!body) return fail(400, "Invalid JSON body");

    const supabase = createServerSupabase();
    const ownerId = await getOwnerId();
    if (!ownerId) return fail(500, "Owner not found");

    const payload = buildInsertPayload(body, ownerId);

    if (!payload.name) return fail(400, "name is required");
    if (payload.platform === "mt5" && !payload.mt5_login) {
      return fail(400, "mt5 login is required");
    }

    const { data, error } = await supabase
      .from("accounts")
      .insert(payload)
      .select(SELECT_FIELDS)
      .single();

    if (error) {
      console.error("POST /accounts error:", error);
      return fail(500, "Failed to create account", error.message);
    }

    return NextResponse.json({ data: mapDbRow(data) }, { status: 201 });
  } catch (error) {
    console.error("POST /accounts unexpected error:", error);
    return fail(500, "Unexpected server error");
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await readJson(request);
    if (!body) return fail(400, "Invalid JSON body");

    const id = toText(body.id);
    if (!id) return fail(400, "id is required");

    const supabase = createServerSupabase();
    const ownerId = await getOwnerId();
    if (!ownerId) return fail(500, "Owner not found");

    const payload = buildUpdatePayload(body);

    const { data, error } = await supabase
      .from("accounts")
      .update(payload)
      .eq("user_id", ownerId)
      .eq("id", id)
      .select(SELECT_FIELDS)
      .maybeSingle();

    if (error) {
      console.error("PATCH /accounts error:", error);
      return fail(500, "Failed to update account", error.message);
    }
    if (!data) return fail(404, "Account not found");

    return NextResponse.json({ data: mapDbRow(data) });
  } catch (error) {
    console.error("PATCH /accounts unexpected error:", error);
    return fail(500, "Unexpected server error");
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await readJson(request);
    if (!body) return fail(400, "Invalid JSON body");

    const id = toText(body.id);
    if (!id) return fail(400, "id is required");

    const supabase = createServerSupabase();
    const ownerId = await getOwnerId();
    if (!ownerId) return fail(500, "Owner not found");

    const { error } = await supabase
      .from("accounts")
      .update({ is_active: false })
      .eq("user_id", ownerId)
      .eq("id", id);

    if (error) {
      console.error("DELETE /accounts error:", error);
      return fail(500, "Failed to delete account", error.message);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /accounts unexpected error:", error);
    return fail(500, "Unexpected server error");
  }
}
