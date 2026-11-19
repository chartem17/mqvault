/**
 * Discipline marks of every trade: on plan or not, and why. Violations visible in the data are found
 * automatically, on the fly (nothing is written at import); the rest the trader marks by hand in
 * `journal_trades.meta.discipline`. "On plan" = a matched plan and no violation of either kind.
 */
import { msg } from "../i18n/core";
import { zonedParts, zonedWallTime, zonedWeekRange } from "../time/timezone";
import type { PlaybookConfig } from "./config";
import { inEntryWindow, outcomeOf, riskAtEntries, toPrice, type PlaybookTrade } from "./engine";
import { planRR, type PlanMatch, type RiskException, type TradePlan } from "./plans";

export const AUTO_VIOLATIONS = ["no_plan", "outside_window", "trade_limit", "loss_limit", "low_rr", "risk_rule", "moved_target", "manual_close_be"] as const;
export const MANUAL_VIOLATIONS = ["moved_target", "manual_close_be", "early_breakeven", "partial_close", "m3_model", "no_checklist", "other"] as const;
export type ViolationCode = typeof AUTO_VIOLATIONS[number] | typeof MANUAL_VIOLATIONS[number];

export const VIOLATION_LABEL: Record<ViolationCode, string> = {
  no_plan: msg("No plan before the entry"),
  outside_window: msg("Outside the trading window"),
  trade_limit: msg("Over the daily trade limit"),
  loss_limit: msg("After the daily stop limit"),
  low_rr: msg("RR below the minimum"),
  risk_rule: msg("Risk not by the rule"),
  moved_target: msg("Target moved further"),
  manual_close_be: msg("Closed by hand at break-even"),
  early_breakeven: msg("Break-even too early"),
  partial_close: msg("Partial close"),
  m3_model: msg("Model found on M3 only"),
  no_checklist: msg("Checklist not really passed"),
  other: msg("Other"),
};

/** Stored in `journal_trades.meta.discipline`. */
export type TradeDiscipline = {
  violations: (typeof MANUAL_VIOLATIONS[number])[];
  /** Temporary rule: held to SL/TP through a stall, not closed at zero by hand. */
  stagnation: boolean;
  /** Risk above the base taken as a flagged add-on or metals lot limit (when no plan says so). */
  exception: Exclude<RiskException, "none"> | null;
  note: string;
  updated_at: string;
};

const record = (value: unknown): Record<string, unknown> | null => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;

/** Reads `meta.discipline`; anything malformed is "nothing marked". */
export function parseDiscipline(meta: unknown): TradeDiscipline | null {
  const value = record(record(meta)?.discipline);
  if (!value) return null;
  const violations = Array.isArray(value.violations) ? [...new Set(value.violations.filter((code): code is TradeDiscipline["violations"][number] => MANUAL_VIOLATIONS.includes(code as never)))] : [];
  const exception = value.exception === "add_on" || value.exception === "metal_lot" ? value.exception : null;
  return { violations, stagnation: value.stagnation === true, exception, note: typeof value.note === "string" ? value.note.slice(0, 500) : "", updated_at: typeof value.updated_at === "string" ? value.updated_at : "" };
}

/** Value for `meta.discipline` from a PATCH body; null clears it, undefined = invalid. */
export function disciplineFromInput(input: unknown, now = new Date()): TradeDiscipline | null | undefined {
  if (input === null) return null;
  const value = record(input);
  if (!value) return undefined;
  if (value.violations !== undefined && (!Array.isArray(value.violations) || value.violations.some(code => !MANUAL_VIOLATIONS.includes(code as never)))) return undefined;
  if (value.exception !== undefined && value.exception !== null && value.exception !== "add_on" && value.exception !== "metal_lot") return undefined;
  if (value.note !== undefined && typeof value.note !== "string") return undefined;
  return parseDiscipline({ discipline: { ...value, updated_at: now.toISOString() } });
}

export type DisciplineTrade = PlaybookTrade & { discipline?: TradeDiscipline | null };
export type Violation = { code: ViolationCode; auto: boolean };
export type TradeAssessment = { tradeId: string; planId: string | null; onPlan: boolean; violations: Violation[]; stagnation: boolean; expectedRiskPct: number | null };

function dayOf(iso: string, tz: string) { try { return zonedParts(iso, tz).date; } catch { return ""; } }

/** Assessment of every trade; `match` comes from `matchPlans` over the same trades and plans. */
export function assessTrades(trades: readonly DisciplineTrade[], plans: readonly TradePlan[], match: PlanMatch, config: PlaybookConfig): Map<string, TradeAssessment> {
  const planById = new Map(plans.map(plan => [plan.id, plan]));
  const auto = new Map<string, Set<ViolationCode>>(trades.map(trade => [trade.id, new Set()]));
  const add = (id: string, code: ViolationCode) => auto.get(id)?.add(code);
  const byAccount = new Map<string, DisciplineTrade[]>();
  for (const trade of trades) byAccount.set(trade.account_id, [...(byAccount.get(trade.account_id) ?? []), trade]);
  const expected = new Map<string, number>();

  for (const list of byAccount.values()) {
    riskAtEntries(list, config).forEach((state, id) => expected.set(id, state.riskPct));
    // Daily limits: the (max+1)-th entry of a day, or any entry after max losses closed that day.
    const byDay = new Map<string, DisciplineTrade[]>();
    for (const trade of list) { const day = dayOf(trade.opened_at, config.timezone); if (day) byDay.set(day, [...(byDay.get(day) ?? []), trade]); }
    for (const day of byDay.values()) {
      day.sort((a, b) => Date.parse(a.opened_at) - Date.parse(b.opened_at) || a.id.localeCompare(b.id));
      day.forEach((trade, index) => {
        if (index >= config.maxTradesPerDay) add(trade.id, "trade_limit");
        const at = Date.parse(trade.opened_at);
        const losses = day.filter(other => other.id !== trade.id && other.closed_at && Date.parse(other.closed_at) <= at && outcomeOf(other, config.breakevenR) === "loss").length;
        if (losses >= config.maxLossesPerDay) add(trade.id, "loss_limit");
      });
    }
  }

  const out = new Map<string, TradeAssessment>();
  for (const trade of trades) {
    const planId = match.byTrade.get(trade.id) ?? null;
    const plan = planId ? planById.get(planId) ?? null : null;
    if (!plan) add(trade.id, "no_plan");
    if (!inEntryWindow(trade.opened_at, config)) add(trade.id, "outside_window");
    const entry = toPrice(trade.entry_price), stop = toPrice(trade.stop_loss), take = toPrice(trade.take_profit);
    const rr = planRR(trade.direction, entry, stop, take);
    if (rr !== null && rr < config.minRR && !(plan && take === null)) add(trade.id, "low_rr");
    const exception = plan?.risk_exception && plan.risk_exception !== "none" ? plan.risk_exception : trade.discipline?.exception ?? null;
    const rule = expected.get(trade.id) ?? null;
    if (typeof trade.risk_percent === "number" && rule !== null) {
      const off = exception ? trade.risk_percent > config.maxRiskPct + config.riskTolerancePct : Math.abs(trade.risk_percent - rule) > config.riskTolerancePct;
      if (off) add(trade.id, "risk_rule");
    }
    if (plan && take !== null) {
      const slack = Math.abs(plan.entry - plan.stop) * 0.1;
      if (plan.direction === "Long" ? take > plan.target + slack : take < plan.target - slack) add(trade.id, "moved_target");
    }
    if (trade.close_reason === "manual" && typeof trade.result_r === "number" && Math.abs(trade.result_r) < config.breakevenR) add(trade.id, "manual_close_be");

    const autoCodes = auto.get(trade.id) ?? new Set<ViolationCode>();
    const violations: Violation[] = [...autoCodes].map(code => ({ code, auto: true }));
    for (const code of trade.discipline?.violations ?? []) if (!autoCodes.has(code)) violations.push({ code, auto: false });
    out.set(trade.id, { tradeId: trade.id, planId, onPlan: Boolean(plan) && violations.length === 0, violations, stagnation: trade.discipline?.stagnation === true, expectedRiskPct: rule });
  }
  return out;
}

export type DisciplineSummary = {
  trades: number;
  onPlan: number;
  /** Share of trades on plan, 0–100; null without trades. */
  onPlanPct: number | null;
  onPlanR: number;
  offPlanR: number;
  onPlanNet: number;
  offPlanNet: number;
  stagnation: number;
  stagnationR: number;
};

const round = (value: number) => Math.round(value * 100) / 100;

/** Totals for trades opened in [from, to). */
export function disciplineSummary(trades: readonly DisciplineTrade[], assessed: ReadonlyMap<string, TradeAssessment>, from: number, to: number): DisciplineSummary {
  const list = trades.filter(trade => { const at = Date.parse(trade.opened_at); return at >= from && at < to && assessed.has(trade.id); });
  const r = (trade: DisciplineTrade) => typeof trade.result_r === "number" ? trade.result_r : 0;
  const net = (trade: DisciplineTrade) => typeof trade.net_pnl === "number" ? trade.net_pnl : 0;
  const on = list.filter(trade => assessed.get(trade.id)?.onPlan), off = list.filter(trade => !assessed.get(trade.id)?.onPlan);
  const stalled = list.filter(trade => assessed.get(trade.id)?.stagnation);
  const sum = (items: DisciplineTrade[], value: (trade: DisciplineTrade) => number) => round(items.reduce((total, trade) => total + value(trade), 0));
  return {
    trades: list.length, onPlan: on.length, onPlanPct: list.length ? Math.round(on.length / list.length * 100) : null,
    onPlanR: sum(on, r), offPlanR: sum(off, r), onPlanNet: sum(on, net), offPlanNet: sum(off, net),
    stagnation: stalled.length, stagnationR: sum(stalled, r),
  };
}

/** This week (Mon–Sun) and this month in the playbook zone, as [from, to) ms. */
export function disciplinePeriods(now: number, tz: string) {
  const week = zonedWeekRange(now, tz);
  const month = zonedParts(now, tz).date.slice(0, 7);
  const [y, m] = month.split("-").map(Number);
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  const start = (key: string) => zonedWallTime(`${key}-01`, "00:00", tz);
  return { week, month: { from: start(month), to: start(next) } };
}
