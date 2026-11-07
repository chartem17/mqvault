import type { RuleInstance, RuleType, Trade } from "./types";

/**
 * Price of violations: the period as it was traded versus the same period without the trades
 * that broke an enabled rule. Counterfactual is deliberately simple — a skipped trade is not
 * replaced by anything — and only trades with a known R take part.
 *
 * Daily limits count only the trades taken after the limit was reached (the first N trades of
 * a day were allowed). Every other rule uses its evaluator's per-trade verdict.
 */
export type ViolationPoint = { tradeId: string; date: string; actualR: number; cleanR: number; violated: boolean };
export type RuleCost = { ruleType: RuleType; trades: number; resultR: number };
export type ViolationCost = {
  /** Trades with a known R, in opening order. */
  points: ViolationPoint[];
  actualR: number;
  cleanR: number;
  /** cleanR − actualR: positive = violations cost R, negative = violating trades made money. */
  costR: number;
  violatingTrades: number;
  /** Trades of the period without R; they are left out of both curves. */
  unknownR: number;
  byRule: RuleCost[];
  sample: "none" | "small" | "ok";
};
/** Per-trade verdict of a rule: the trades that broke it. */
export type RuleViolations = (ruleType: RuleType, trades: Trade[], params: Record<string, unknown>) => Trade[];

export const MIN_TRADES = 20;
export const MIN_VIOLATIONS = 5;
const DAY_LIMIT_RULES: RuleType[] = ["max_trades_per_day", "max_losses_per_day"];
const round = (value: number) => Math.round(value * 100) / 100;
const order = (a: Trade, b: Trade) => (a.openedAt ?? a.date).localeCompare(b.openedAt ?? b.date) || a.id.localeCompare(b.id);

/** Trades opened after the daily limit was reached: the (limit+1)-th trade of a day, or anything after the limit-th loss. */
export function overDailyLimit(ruleType: "max_trades_per_day" | "max_losses_per_day", trades: Trade[], limit: number): Trade[] {
  const byDay = new Map<string, Trade[]>();
  for (const trade of [...trades].sort(order)) byDay.set(trade.date, [...(byDay.get(trade.date) ?? []), trade]);
  const over: Trade[] = [];
  for (const list of byDay.values()) {
    let losses = 0;
    list.forEach((trade, index) => {
      if (ruleType === "max_trades_per_day" ? index >= limit : losses >= limit) over.push(trade);
      if ((trade.resultR ?? 0) < 0) losses++;
    });
  }
  return over;
}

export function violationCost(trades: Trade[], rules: RuleInstance[], violations: RuleViolations): ViolationCost {
  const enabled = rules.filter(rule => rule.enabled);
  const broken = new Map<string, Set<RuleType>>();
  for (const rule of enabled) {
    const offenders = DAY_LIMIT_RULES.includes(rule.ruleType)
      ? overDailyLimit(rule.ruleType as "max_trades_per_day" | "max_losses_per_day", trades, Number(rule.params.limit))
      : violations(rule.ruleType, trades, rule.params);
    for (const trade of offenders) broken.set(trade.id, (broken.get(trade.id) ?? new Set()).add(rule.ruleType));
  }

  const known = trades.filter(trade => typeof trade.resultR === "number" && Number.isFinite(trade.resultR)).sort(order);
  let actual = 0, clean = 0;
  const points = known.map(trade => {
    const violated = broken.has(trade.id);
    actual += trade.resultR as number;
    if (!violated) clean += trade.resultR as number;
    return { tradeId: trade.id, date: trade.date, actualR: round(actual), cleanR: round(clean), violated };
  });

  const byRule = enabled.map(rule => {
    const list = known.filter(trade => broken.get(trade.id)?.has(rule.ruleType));
    return { ruleType: rule.ruleType, trades: list.length, resultR: round(list.reduce((sum, trade) => sum + (trade.resultR as number), 0)) };
  }).filter(item => item.trades > 0).sort((a, b) => a.resultR - b.resultR);

  const violatingTrades = points.filter(point => point.violated).length;
  // Totals are derived from two rounded numbers so that actual − clean = −cost exactly as displayed.
  const actualR = round(actual), violatingR = round(actual - clean);
  return {
    points,
    actualR,
    cleanR: round(actualR - violatingR),
    costR: round(-violatingR),
    violatingTrades,
    unknownR: trades.length - known.length,
    byRule,
    sample: !enabled.length || !known.length ? "none" : known.length < MIN_TRADES || violatingTrades < MIN_VIOLATIONS ? "small" : "ok",
  };
}
