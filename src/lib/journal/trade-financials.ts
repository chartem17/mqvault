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
