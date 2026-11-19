import { NextRequest, NextResponse } from "next/server";
import { resolveUser, type UserContext } from "@/lib/auth/current-user";
import { parseTradeReview, reviewFromInput } from "@/lib/journal/trade-review";
import { calibrateValuePerLot, derivedFinancials, financialsChanged, type FinancialContext } from "@/lib/journal/trade-financials";
import { disciplineFromInput, parseDiscipline } from "@/lib/playbook/discipline";

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
  "initial_stop_loss",
  "take_profit",
  "volume",
  "risk_percent",
  "risk_amount",
] as const;
const COST_KEYS = ["commission", "fee"] as const;

type Body = Record<string, unknown>;
type Db = UserContext["db"];

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

// net_pnl, result_r and risk_basis are never read from the client: always computed here (ADR 0003, ADR 0020).
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
  if (body.swap !== undefined) f.swap = toNum(body.swap) ?? 0;

  return f;
}

/** MT5 Bridge records why a position closed (sl / tp / manual …) in meta.bridge. */
function closeReason(meta: unknown): string | null {
  const bridge = meta && typeof meta === "object" ? (meta as { bridge?: { close_reason?: unknown } }).bridge : undefined;
  return typeof bridge?.close_reason === "string" ? bridge.close_reason : null;
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
    initial_stop_loss: str(row.initial_stop_loss),
    take_profit: str(row.take_profit),
    volume: num(row.volume),
    risk_percent: num(row.risk_percent),
    risk_amount: num(row.risk_amount),
    risk_basis: row.risk_basis ?? null,
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
    review: parseTradeReview(row.meta),
    discipline: parseDiscipline(row.meta),
    close_reason: closeReason(row.meta),
  };
}

/**
 * What the R/risk formulas need beyond the row: the account's starting balance and, for trades that barely moved,
 * the value of a price move per lot calibrated on the account's other closed trades of the same symbol.
 */
async function financialContext(db: Db, ownerId: string, accountId: unknown, symbol: unknown): Promise<FinancialContext> {
  if (typeof accountId !== "string" || !accountId) return {};
  const { data: account } = await db.from("accounts").select("initial_balance").eq("id", accountId).eq("user_id", ownerId).maybeSingle();
  let valuePerLot: number | null = null;
  if (typeof symbol === "string" && symbol) {
    const { data: peers } = await db
      .from("journal_trades")
      .select("direction, entry_price, exit_price, volume, gross_pnl, closed_at")
      .eq("user_id", ownerId)
      .eq("account_id", accountId)
      .eq("symbol", symbol)
      .not("closed_at", "is", null)
      .order("closed_at", { ascending: false })
      .limit(200);
    valuePerLot = calibrateValuePerLot(peers ?? []);
  }
  return { initialBalance: toNum(account?.initial_balance), valuePerLot };
}

async function readBody(request: NextRequest): Promise<Body | null> {
  try {
    const body = await request.json();
    return body && typeof body === "object" ? (body as Body) : null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const context = await resolveUser(request);
    if (context instanceof Response) return context;
    const { db, ownerId } = context;

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
    const context = await resolveUser(request);
    if (context instanceof Response) return context;
    const body = await readBody(request);
    if (!body) return fail(400, "Invalid JSON body");

    const { db, ownerId } = context;

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

    // A trade typed in the form is logged with the stop it was opened with: that stop is the initial one,
    // unless the form sends a separate initial stop.
    if ((fields.initial_stop_loss ?? null) === null && (fields.stop_loss ?? null) !== null) {
      fields.initial_stop_loss = fields.stop_loss;
    }
    const base = { source: "manual", gross_pnl: 0, commission: 0, swap: 0, fee: 0, ...fields };
    const payload = {
      ...base,
      user_id: ownerId,
      ...derivedFinancials(base, await financialContext(db, ownerId, fields.account_id, fields.symbol)),
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
    const context = await resolveUser(request);
    if (context instanceof Response) return context;
    const body = await readBody(request);
    if (!body || typeof body.id !== "string") {
      return fail(400, "id is required");
    }

    const { db, ownerId } = context;

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

    let meta: Record<string, unknown> | undefined;
    const metaBase = () =>
      meta ??
      (current.meta && typeof current.meta === "object" && !Array.isArray(current.meta)
        ? { ...(current.meta as Record<string, unknown>) }
        : {});
    if (body.review !== undefined) {
      const review = reviewFromInput(body.review);
      if (review === undefined) return fail(400, "review is invalid");
      const base = metaBase();
      if (review === null) delete base.review;
      else base.review = review;
      meta = base;
    }
    // Playbook discipline marks (manual violations, "stagnation", risk exception) live in meta.discipline.
    if (body.discipline !== undefined) {
      const discipline = disciplineFromInput(body.discipline);
      if (discipline === undefined) return fail(400, "discipline is invalid");
      const base = metaBase();
      if (discipline === null) delete base.discipline;
      else base.discipline = discipline;
      meta = base;
    }

    const recompute = financialsChanged(fields, current);
    const merged: Record<string, unknown> = { ...current, ...fields };
    // A risk typed now is the owner's value, whatever was derived before.
    if ("risk_amount" in fields || "risk_percent" in fields) merged.risk_basis = null;
    const derived = recompute
      ? derivedFinancials(merged, await financialContext(db, ownerId, merged.account_id, merged.symbol))
      : null;

    const { data, error } = await db
      .from("journal_trades")
      .update({
        ...fields,
        ...(derived ?? {}),
        ...(meta ? { meta } : {}),
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
    const context = await resolveUser(request);
    if (context instanceof Response) return context;
    const body = await readBody(request);
    if (!body || typeof body.id !== "string") {
      return fail(400, "id is required");
    }

    const { db, ownerId } = context;

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
