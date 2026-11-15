/**
 * Server-side money and R of a trade (ADR 0003, ADR 0020). The only place these formulas live; the trade form may
 * import them for a preview, never re-implement them.
 *
 * - net = gross − |commission| − |fee| + swap.
 * - Initial risk is measured from the INITIAL stop (the stop at entry), never from the last stop: a stop moved to
 *   break-even or into profit must not erase or inflate R.
 * - risk_amount (account currency) = |entry − initial stop| × volume × value of a 1.0 price move per lot. That value is
 *   read from the trade itself (gross / (move × volume)) — no contract specs needed for FX, metals, indices or crypto —
 *   or, when the trade barely moved, from the account's other trades on the same symbol (calibrateValuePerLot).
 * - If the stop does not give a risk, a risk typed by the owner (amount, or % of the starting balance) is used.
 * - result_r = net / risk_amount; without a money risk, the price R (move / stop distance); otherwise empty.
 */

/** Inputs of the derived fields. A PATCH recomputes only when one of them really changes (notes and review chips never do). */
export const FINANCIAL_KEYS = [
  "direction", "entry_price", "exit_price", "initial_stop_loss", "volume", "closed_at",
  "gross_pnl", "commission", "swap", "fee", "risk_amount", "risk_percent",
] as const;

/** How risk_amount was obtained. "stop": computed from the initial stop; "entered": typed or imported; "planned": estimate from the planned % (backfill only). */
export type RiskBasis = "stop" | "entered" | "planned";

export type FinancialContext = {
  /** Account starting balance: the base of risk_percent (prop rules are set against it). */
  initialBalance?: number | null;
  /** Account currency per 1.0 price move per 1 lot on this symbol, from calibrateValuePerLot. */
  valuePerLot?: number | null;
};

export type DerivedFinancials = {
  net_pnl: number;
  risk_amount: number | null;
  risk_percent: number | null;
  risk_basis: RiskBasis | null;
  result_r: number | null;
};

export function toNum(value: unknown): number | null {
  if (value === "" || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

const isOpen = (value: unknown) => (value ?? null) === null;

export function financialsChanged(fields: Record<string, unknown>, current: Record<string, unknown>): boolean {
  return FINANCIAL_KEYS.some(key => {
    if (!(key in fields)) return false;
    if (key === "direction") return fields.direction !== current.direction;
    if (key === "closed_at") return isOpen(fields.closed_at) !== isOpen(current.closed_at);
    const next = toNum(fields[key]), prev = toNum(current[key]);
    // Costs are stored as positive amounts; a sign flip is not a change.
    if (key === "commission" || key === "fee") return Math.abs(next ?? 0) !== Math.abs(prev ?? 0);
    return next !== prev;
  });
}

function round(value: number, digits: number) { const k = 10 ** digits; return Math.round(value * k) / k; }
const side = (direction: unknown): 1 | -1 | null => (direction === "Long" ? 1 : direction === "Short" ? -1 : null);

/** net = gross − (commission + fee) + swap; commission/fee are costs whatever their sign, swap is signed. */
export function calcNet(gross: number, commission: number, swap: number, fee: number) {
  return round(gross - (Math.abs(commission) + Math.abs(fee)) + swap, 8);
}

/** Price distance entry → initial stop on the losing side; null when the stop is missing or not on the losing side. */
export function riskDistance(direction: unknown, entry: number | null, initialStop: number | null): number | null {
  const s = side(direction);
  if (s === null || entry === null || initialStop === null || initialStop <= 0) return null;
  const distance = s * (entry - initialStop);
  return distance > 0 ? distance : null;
}

/** Price R = move / initial stop distance (costs not included); null without a valid initial stop. */
export function calcPriceR(direction: unknown, entry: number | null, exit: number | null, initialStop: number | null): number | null {
  const distance = riskDistance(direction, entry, initialStop);
  const s = side(direction);
  if (distance === null || s === null || entry === null || exit === null) return null;
  return round((s * (exit - entry)) / distance, 4);
}

/** Smallest |gross| (account currency) that gives a trustworthy value per lot: cents rounding stays under 0.5 %. */
const MIN_GROSS_FOR_VALUE = 1;

export type ValueSource = { direction?: unknown; entry_price?: unknown; exit_price?: unknown; volume?: unknown; gross_pnl?: unknown; closed_at?: unknown };

/**
 * Account currency per 1.0 price move per 1 lot, read from one closed trade: gross / (signed move × volume).
 * Works for any instrument: contract size and currency conversion are already inside the broker's gross.
 */
export function tradeValuePerLot(trade: ValueSource): number | null {
  if ("closed_at" in trade && isOpen(trade.closed_at)) return null;
  const s = side(trade.direction);
  const entry = toNum(trade.entry_price), exit = toNum(trade.exit_price), volume = toNum(trade.volume), gross = toNum(trade.gross_pnl);
  if (s === null || entry === null || exit === null || volume === null || gross === null) return null;
  if (!(volume > 0) || Math.abs(gross) < MIN_GROSS_FOR_VALUE) return null;
  const move = s * (exit - entry);
  if (move === 0) return null;
  const value = gross / (move * volume);
  return value > 0 && Number.isFinite(value) ? value : null;
}

/** Median value per lot over an account's closed trades on one symbol; null when none qualifies. */
export function calibrateValuePerLot(trades: readonly ValueSource[]): number | null {
  const values = trades.map(tradeValuePerLot).filter((value): value is number => value !== null).sort((a, b) => a - b);
  if (!values.length) return null;
  const middle = Math.floor(values.length / 2);
  return values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2;
}

/** One instrument whatever the broker suffix: "EURUSD.raw", "eurusd" → "EURUSD". */
export function valueKey(symbol: unknown): string {
  return String(symbol ?? "").trim().toUpperCase().split(/[.#_\s]/)[0].replace(/[^A-Z0-9]/g, "");
}

/** Value per lot for every symbol of one account's trades (keys from valueKey). */
export function valuesBySymbol(trades: readonly (ValueSource & { symbol?: unknown })[]): Map<string, number> {
  const groups = new Map<string, ValueSource[]>();
  for (const trade of trades) {
    const key = valueKey(trade.symbol);
    if (!key) continue;
    groups.set(key, [...(groups.get(key) ?? []), trade]);
  }
  const values = new Map<string, number>();
  for (const [key, list] of groups) {
    const value = calibrateValuePerLot(list);
    if (value !== null) values.set(key, value);
  }
  return values;
}

/**
 * Initial risk of a trade. `source.risk_basis === "stop"` marks a stored risk_amount/percent as derived earlier:
 * such values are recomputed, never treated as typed.
 */
export function calcRisk(source: Record<string, unknown>, context: FinancialContext = {}): Pick<DerivedFinancials, "risk_amount" | "risk_percent" | "risk_basis"> {
  const balance = toNum(context.initialBalance);
  const base = balance !== null && balance > 0 ? balance : null;
  const distance = riskDistance(source.direction, toNum(source.entry_price), toNum(source.initial_stop_loss));
  const volume = toNum(source.volume);
  const calibrated = toNum(context.valuePerLot);
  const value = tradeValuePerLot(source) ?? (calibrated !== null && calibrated > 0 ? calibrated : null);
  if (distance !== null && volume !== null && volume > 0 && value !== null) {
    const amount = round(distance * volume * value, 2);
    if (amount > 0) return { risk_amount: amount, risk_percent: base ? round((amount / base) * 100, 4) : null, risk_basis: "stop" };
  }
  if (source.risk_basis === "stop") return { risk_amount: null, risk_percent: null, risk_basis: null };
  const basis: RiskBasis = source.risk_basis === "planned" ? "planned" : "entered";
  const amount = toNum(source.risk_amount), percent = toNum(source.risk_percent);
  if (amount !== null && amount > 0) {
    return { risk_amount: amount, risk_percent: percent !== null && percent > 0 ? percent : base ? round((amount / base) * 100, 4) : null, risk_basis: basis };
  }
  if (percent !== null && percent > 0) return { risk_amount: base ? round((percent / 100) * base, 2) : null, risk_percent: percent, risk_basis: basis };
  return { risk_amount: null, risk_percent: null, risk_basis: null };
}

/** Server-side derived fields of a trade row. The only place these formulas live (ADR 0003, ADR 0020). */
export function derivedFinancials(source: Record<string, unknown>, context: FinancialContext = {}): DerivedFinancials {
  const net = calcNet(toNum(source.gross_pnl) ?? 0, toNum(source.commission) ?? 0, toNum(source.swap) ?? 0, toNum(source.fee) ?? 0);
  const risk = calcRisk(source, context);
  const open = ("closed_at" in source && isOpen(source.closed_at)) || toNum(source.exit_price) === null;
  let r: number | null = null;
  if (!open) {
    r = risk.risk_amount !== null && risk.risk_amount > 0
      ? round(net / risk.risk_amount, 4)
      : calcPriceR(source.direction, toNum(source.entry_price), toNum(source.exit_price), toNum(source.initial_stop_loss));
  }
  return { net_pnl: net, ...risk, result_r: r };
}
