import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const SOURCES = ["manual", "mt5", "exchange", "import"];
const TEXT_KEYS = [
  "market",
  "session",
  "setup",
  "htf_bias",
  "entry_reason",
  "exit_reason",
  "emotion",
  "mistake",
  "screenshot_url",
  "notes",
  "external_id",
] as const;
const NULLABLE_NUM_KEYS = [
  "entry_price",
  "exit_price",
  "stop_loss",
  "take_profit",
  "volume",
  "risk_percent",
  "risk_amount",
] as const;
const COST_KEYS = ["commission", "fee"] as const;

type Body = Record<string, unknown>;
type Db = ReturnType<typeof createServerSupabase>;

function fail(status: number, error: string, detail?: string) {
  return NextResponse.json(
    {
      error,
      ...(process.env.NODE_ENV !== "production" && detail ? { detail } : {}),
    },
    { status },
  );
}

function toNum(value: unknown): number | null {
  if (value === "" || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function round(value: number, digits: number) {
  const k = 10 ** digits;
  return Math.round(value * k) / k;
}

// net = gross - (commission + fee) + swap; commission/fee are positive costs, swap is signed.
function calcNet(gross: number, commission: number, swap: number, fee: number) {
  return round(gross - (commission + fee) + swap, 8);
}

// Realized R = result in price / initial risk distance (entry -> stop).
function calcR(
  direction: unknown,
  entry: number | null,
  exit: number | null,
  stop: number | null,
): number | null {
  if (entry === null || exit === null || stop === null) return null;
  if (direction !== "Long" && direction !== "Short") return null;

  const risk = direction === "Long" ? entry - stop : stop - entry;
  if (!(risk > 0)) return null;

  const move = direction === "Long" ? exit - entry : entry - exit;
  return round(move / risk, 4);
}

function normDirection(value: unknown): "Long" | "Short" | null {
  const v = String(value ?? "").toLowerCase();
  if (v === "long" || v === "buy") return "Long";
  if (v === "short" || v === "sell") return "Short";
  return null;
}

function validDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

async function getOwnerId(db: Db): Promise<string | null> {
  const { data, error } = await db
    .from("app_users")
    .select("id")
    .eq("is_owner", true)
    .limit(1)
    .maybeSingle();

  if (error) console.error("owner lookup error:", error);
  return data?.id ?? null;
}

async function accountBelongsToOwner(
  db: Db,
  accountId: string,
  ownerId: string,
) {
  const { data } = await db
    .from("accounts")
    .select("id")
    .eq("id", accountId)
    .eq("user_id", ownerId)
    .maybeSingle();
  return Boolean(data);
}

// net_pnl and result_r are never read from the client: always computed here.
function fieldsFrom(body: Body) {
  const f: Record<string, unknown> = {};

  if (body.account_id !== undefined) f.account_id = body.account_id;
  if (body.symbol !== undefined) f.symbol = String(body.symbol).trim();
  if (body.direction !== undefined) f.direction = normDirection(body.direction);
  if (body.opened_at !== undefined) f.opened_at = validDate(body.opened_at);
  if (body.closed_at !== undefined) {
    f.closed_at = body.closed_at === null ? null : validDate(body.closed_at);
  }
  if (body.source !== undefined) {
    f.source = SOURCES.includes(String(body.source)) ? body.source : "manual";
  }

  for (const key of TEXT_KEYS) {
    if (body[key] !== undefined) {
      const v = body[key];
      f[key] = v === "" || v === null ? null : String(v);
    }
  }
  for (const key of NULLABLE_NUM_KEYS) {
    if (body[key] !== undefined) f[key] = toNum(body[key]);
  }
  if (body.gross_pnl !== undefined) f.gross_pnl = toNum(body.gross_pnl) ?? 0;
  for (const key of COST_KEYS) {
    if (body[key] !== undefined) f[key] = Math.abs(toNum(body[key]) ?? 0);
  }
  if (body.gross_pnl !== undefined) f.gross_pnl = toNum(body.gross_pnl) ?? 0;
  if (body.swap !== undefined) f.swap = toNum(body.swap) ?? 0;
  for (const key of COST_KEYS) {
    if (body[key] !== undefined) f[key] = Math.abs(toNum(body[key]) ?? 0);
  }

  return f;
}

function mapRow(row: Record<string, unknown>) {
  const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));
  const num = (v: unknown) =>
    v === null || v === undefined ? null : Number(v);

  return {
    id: row.id,
    account_id: row.account_id,
    source: row.source,
    external_id: row.external_id,
    opened_at: row.opened_at,
    closed_at: row.closed_at,
    symbol: row.symbol,
    market: row.market,
    direction: row.direction,
    entry_price: str(row.entry_price),
    exit_price: str(row.exit_price),
    stop_loss: str(row.stop_loss),
    take_profit: str(row.take_profit),
    volume: num(row.volume),
    risk_percent: num(row.risk_percent),
    risk_amount: num(row.risk_amount),
    gross_pnl: num(row.gross_pnl),
    commission: num(row.commission),
    swap: num(row.swap),
    fee: num(row.fee),
    net_pnl: num(row.net_pnl),
    result_r: num(row.result_r),
    session: row.session,
    setup: row.setup,
    htf_bias: row.htf_bias,
    entry_reason: row.entry_reason,
    exit_reason: row.exit_reason,
    emotion: row.emotion,
    mistake: row.mistake,
    screenshot_url: row.screenshot_url,
    notes: row.notes,
  };
}

function derived(source: Record<string, unknown>) {
  const gross = toNum(source.gross_pnl) ?? 0;
  const swap = toNum(source.swap) ?? 0;
  const commission = Math.abs(toNum(source.commission) ?? 0);
  const fee = Math.abs(toNum(source.fee) ?? 0);

  return {
    net_pnl: calcNet(gross, commission, swap, fee),
    result_r: calcR(
      source.direction,
      toNum(source.entry_price),
      toNum(source.exit_price),
      toNum(source.stop_loss),
    ),
  };
}

async function readBody(request: NextRequest): Promise<Body | null> {
  try {
    const body = await request.json();
    return body && typeof body === "object" ? (body as Body) : null;
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const db = createServerSupabase();
    const ownerId = await getOwnerId(db);
    if (!ownerId) return fail(500, "Owner not found");

    const { data, error } = await db
      .from("journal_trades")
      .select("*")
      .eq("user_id", ownerId)
      .order("opened_at", { ascending: false })
      .limit(1000);

    if (error) {
      console.error("GET /journal/trades error:", error);
      return fail(500, "Failed to fetch journal trades", error.message);
    }

    return NextResponse.json({ data: (data ?? []).map(mapRow) });
  } catch (error) {
    console.error("GET /journal/trades unexpected:", error);
    return fail(500, "Unexpected server error");
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await readBody(request);
    if (!body) return fail(400, "Invalid JSON body");

    const db = createServerSupabase();
    const ownerId = await getOwnerId(db);
    if (!ownerId) return fail(500, "Owner not found");

    const fields = fieldsFrom(body);

    if (typeof fields.account_id !== "string" || !fields.account_id) {
      return fail(400, "account_id is required");
    }
    if (!fields.symbol) return fail(400, "symbol is required");
    if (!fields.direction) return fail(400, "direction must be Long or Short");
    if (!fields.opened_at) return fail(400, "opened_at is invalid");

    if (!(await accountBelongsToOwner(db, fields.account_id, ownerId))) {
      return fail(400, "Unknown account_id");
    }

    const payload = {
      source: "manual",
      gross_pnl: 0,
      commission: 0,
      swap: 0,
      fee: 0,
      ...fields,
      user_id: ownerId,
      ...derived(fields),
    };

    const { data, error } = await db
      .from("journal_trades")
      .insert(payload)
      .select("*")
      .single();

    if (error) {
      console.error("POST /journal/trades error:", error);
      if (error.code === "23505") {
        return fail(409, "Trade already exists", error.message);
      }
      return fail(
        500,
        "Failed to create trade",
        `${error.code}: ${error.message}`,
      );
    }

    return NextResponse.json({ data: mapRow(data) }, { status: 201 });
  } catch (error) {
    console.error("POST /journal/trades unexpected:", error);
    return fail(500, "Unexpected server error");
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await readBody(request);
    if (!body || typeof body.id !== "string") {
      return fail(400, "id is required");
    }

    const db = createServerSupabase();
    const ownerId = await getOwnerId(db);
    if (!ownerId) return fail(500, "Owner not found");

    const fields = fieldsFrom(body);

    if ("symbol" in fields && !fields.symbol) {
      return fail(400, "symbol is empty");
    }
    if ("direction" in fields && !fields.direction) {
      return fail(400, "direction must be Long or Short");
    }
    if ("opened_at" in fields && !fields.opened_at) {
      return fail(400, "opened_at is invalid");
    }

    if (typeof fields.account_id === "string") {
      if (!(await accountBelongsToOwner(db, fields.account_id, ownerId))) {
        return fail(400, "Unknown account_id");
      }
    }

    const { data: current, error: currentError } = await db
      .from("journal_trades")
      .select("*")
      .eq("id", body.id)
      .eq("user_id", ownerId)
      .maybeSingle();

    if (currentError) {
      console.error("PATCH /journal/trades read error:", currentError);
      return fail(500, "Failed to read trade", currentError.message);
    }
    if (!current) return fail(404, "Trade not found");

    const merged = { ...current, ...fields };

    const { data, error } = await db
      .from("journal_trades")
      .update({
        ...fields,
        ...derived(merged),
        updated_at: new Date().toISOString(),
      })
      .eq("id", body.id)
      .eq("user_id", ownerId)
      .select("*")
      .maybeSingle();

    if (error) {
      console.error("PATCH /journal/trades error:", error);
      if (error.code === "23505") {
        return fail(409, "Trade already exists", error.message);
      }
      return fail(
        500,
        "Failed to update trade",
        `${error.code}: ${error.message}`,
      );
    }
    if (!data) return fail(404, "Trade not found");

    return NextResponse.json({ data: mapRow(data) });
  } catch (error) {
    console.error("PATCH /journal/trades unexpected:", error);
    return fail(500, "Unexpected server error");
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await readBody(request);
    if (!body || typeof body.id !== "string") {
      return fail(400, "id is required");
    }

    const db = createServerSupabase();
    const ownerId = await getOwnerId(db);
    if (!ownerId) return fail(500, "Owner not found");

    const { error } = await db
      .from("journal_trades")
      .delete()
      .eq("id", body.id)
      .eq("user_id", ownerId);

    if (error) {
      console.error("DELETE /journal/trades error:", error);
      return fail(500, "Failed to delete trade", error.message);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /journal/trades unexpected:", error);
    return fail(500, "Unexpected server error");
  }
}
