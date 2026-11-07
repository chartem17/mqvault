/**
 * Inputs of the server-computed `net_pnl` / `result_r`. A PATCH recomputes them only when one of
 * these values actually changes: imported trades carry reconciled values the formula does not
 * reproduce, so editing a note or a review chip must leave them untouched.
 */
export const FINANCIAL_KEYS = ["direction", "entry_price", "exit_price", "stop_loss", "gross_pnl", "commission", "swap", "fee"] as const;

function toNum(value: unknown): number | null {
  if (value === "" || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function financialsChanged(fields: Record<string, unknown>, current: Record<string, unknown>): boolean {
  return FINANCIAL_KEYS.some(key => {
    if (!(key in fields)) return false;
    if (key === "direction") return fields.direction !== current.direction;
    const next = toNum(fields[key]), prev = toNum(current[key]);
    // Costs are stored as positive amounts; a sign flip is not a change.
    if (key === "commission" || key === "fee") return Math.abs(next ?? 0) !== Math.abs(prev ?? 0);
    return next !== prev;
  });
}

function round(value: number, digits: number) { const k = 10 ** digits; return Math.round(value * k) / k; }

/** net = gross − (commission + fee) + swap; commission/fee are costs whatever their sign, swap is signed. */
export function calcNet(gross: number, commission: number, swap: number, fee: number) {
  return round(gross - (Math.abs(commission) + Math.abs(fee)) + swap, 8);
}

/** Realised R = price move / initial risk (entry → stop); null without a valid stop. */
export function calcR(direction: unknown, entry: number | null, exit: number | null, stop: number | null): number | null {
  if (entry === null || exit === null || stop === null) return null;
  if (direction !== "Long" && direction !== "Short") return null;
  const risk = direction === "Long" ? entry - stop : stop - entry;
  if (!(risk > 0)) return null;
  const move = direction === "Long" ? exit - entry : entry - exit;
  return round(move / risk, 4);
}

/** Server-side derived fields of a trade row. The only place these formulas live (ADR 0003). */
export function derivedFinancials(source: Record<string, unknown>) {
  return {
    net_pnl: calcNet(toNum(source.gross_pnl) ?? 0, toNum(source.commission) ?? 0, toNum(source.swap) ?? 0, toNum(source.fee) ?? 0),
    result_r: calcR(source.direction, toNum(source.entry_price), toNum(source.exit_price), toNum(source.stop_loss)),
  };
}
