/**
 * Playbook state computed from trade history: the trading window right now, the day's limits and the
 * current risk level (1 % → 0.5 % after a losing streak → back after wins). Pure functions; every
 * "day" and wall clock is read in `config.timezone` (ADR 0019).
 */
import { shiftDay, zonedParts, zonedWallTime } from "../time/timezone";
import { minutesOf, type PlaybookConfig, type TradingWindow } from "./config";

/** The fields of a journal trade the playbook reads. Prices may come as strings from the API. */
export type PlaybookTrade = {
  id: string;
  account_id: string;
  symbol: string;
  direction: string;
  opened_at: string;
  closed_at?: string | null;
  entry_price?: number | string | null;
  stop_loss?: number | string | null;
  take_profit?: number | string | null;
  risk_percent?: number | null;
  result_r?: number | null;
  net_pnl?: number | null;
  /** From MT5 Bridge (`meta.bridge.close_reason`): "sl", "tp", "manual", … */
  close_reason?: string | null;
};

export type Outcome = "win" | "loss" | "breakeven" | "open";

export function toPrice(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** R decides when known; otherwise the sign of net P&L. Break-even (|R| < config.breakevenR) is neutral. */
export function outcomeOf(trade: Pick<PlaybookTrade, "closed_at" | "result_r" | "net_pnl">, breakevenR: number): Outcome {
  if (!trade.closed_at) return "open";
  if (typeof trade.result_r === "number" && Number.isFinite(trade.result_r)) {
    if (Math.abs(trade.result_r) < breakevenR) return "breakeven";
    return trade.result_r > 0 ? "win" : "loss";
  }
  if (typeof trade.net_pnl === "number" && Number.isFinite(trade.net_pnl)) return trade.net_pnl > 0 ? "win" : trade.net_pnl < 0 ? "loss" : "breakeven";
  return "open";
}

const isoWeekday = (day: string) => { const d = new Date(`${day}T00:00:00Z`).getUTCDay(); return d === 0 ? 7 : d; };

export type WindowNow = {
  /** Calendar day in the playbook zone. */
  day: string;
  /** Wall clock "HH:mm" in the playbook zone. */
  time: string;
  window: TradingWindow | null;
  entriesAllowed: boolean;
  /** End of the current window (ISO), when inside one. */
  endsAt: string | null;
  /** Next window with entries that has not started yet. */
  next: { window: TradingWindow; startsAt: string } | null;
};

/** Which trading window `at` falls into and whether a new entry is allowed now. */
export function windowAt(at: number | Date | string, config: PlaybookConfig): WindowNow {
  const ms = typeof at === "number" ? at : new Date(at).getTime();
  const { date, hour, minute } = zonedParts(ms, config.timezone);
  const now = hour * 60 + minute;
  const tradingDay = config.weekdays.includes(isoWeekday(date));
  const window = tradingDay ? config.windows.find(item => minutesOf(item.start) <= now && now < minutesOf(item.end)) ?? null : null;
  let next: WindowNow["next"] = null;
  for (let offset = 0; offset < 8 && !next; offset++) {
    const day = shiftDay(date, offset);
    if (!config.weekdays.includes(isoWeekday(day))) continue;
    const found = config.windows.find(item => item.entries && (offset > 0 || minutesOf(item.start) > now));
    if (found) next = { window: found, startsAt: new Date(zonedWallTime(day, found.start, config.timezone)).toISOString() };
  }
  return {
    day: date,
    time: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
    window,
    entriesAllowed: Boolean(window?.entries),
    endsAt: window ? new Date(zonedWallTime(date, window.end, config.timezone)).toISOString() : null,
    next,
  };
}

/** True when an entry at `at` is inside a window with entries. */
export function inEntryWindow(at: number | string, config: PlaybookConfig): boolean {
  try { return windowAt(at, config).entriesAllowed; } catch { return false; }
}

export type RiskLevel = "base" | "reduced";
export type RiskState = {
  level: RiskLevel;
  riskPct: number;
  /** Losses in a row at the base level (towards `lossesToReduce`). */
  lossStreak: number;
  /** Wins taken at the reduced level (towards `winsToRestore`). */
  winsAtReduced: number;
  /** Trade that switched the level last (the third loss or the restoring win). */
  changedBy: string | null;
};

const byClose = (a: PlaybookTrade, b: PlaybookTrade) => Date.parse(a.closed_at as string) - Date.parse(b.closed_at as string) || a.id.localeCompare(b.id);

function step(state: RiskState, trade: PlaybookTrade, config: PlaybookConfig): RiskState {
  const outcome = outcomeOf(trade, config.breakevenR);
  if (outcome === "open" || outcome === "breakeven") return state;
  if (state.level === "base") {
    if (outcome === "win") return { ...state, lossStreak: 0 };
    const streak = state.lossStreak + 1;
    return streak >= config.lossesToReduce
      ? { level: "reduced", riskPct: config.reducedRiskPct, lossStreak: 0, winsAtReduced: 0, changedBy: trade.id }
      : { ...state, lossStreak: streak };
  }
  if (outcome === "loss") return state;
  const wins = state.winsAtReduced + 1;
  return wins >= config.winsToRestore
    ? { level: "base", riskPct: config.baseRiskPct, lossStreak: 0, winsAtReduced: 0, changedBy: trade.id }
    : { ...state, winsAtReduced: wins };
}

const initial = (config: PlaybookConfig): RiskState => ({ level: "base", riskPct: config.baseRiskPct, lossStreak: 0, winsAtReduced: 0, changedBy: null });
const closed = (trades: readonly PlaybookTrade[]) => trades.filter(trade => trade.closed_at && Number.isFinite(Date.parse(trade.closed_at))).sort(byClose);

/** Risk level after every closed trade of the list (one account), optionally only those closed before `before`. */
export function riskState(trades: readonly PlaybookTrade[], config: PlaybookConfig, before?: number): RiskState {
  let state = initial(config);
  for (const trade of closed(trades)) {
    if (before !== undefined && Date.parse(trade.closed_at as string) > before) break;
    state = step(state, trade, config);
  }
  return state;
}

/** Risk the rule asked for at the opening of each trade (trades of one account). */
export function riskAtEntries(trades: readonly PlaybookTrade[], config: PlaybookConfig): Map<string, RiskState> {
  const done = closed(trades);
  const opened = [...trades].filter(trade => Number.isFinite(Date.parse(trade.opened_at))).sort((a, b) => Date.parse(a.opened_at) - Date.parse(b.opened_at) || a.id.localeCompare(b.id));
  const out = new Map<string, RiskState>();
  let state = initial(config), index = 0;
  for (const trade of opened) {
    const at = Date.parse(trade.opened_at);
    while (index < done.length && Date.parse(done[index].closed_at as string) <= at) state = step(state, done[index++], config);
    out.set(trade.id, state);
  }
  return out;
}

export type DayStatus = {
  day: string;
  /** Trades opened today plus saved plans not yet matched to an imported trade. */
  entries: number;
  losses: number;
  maxTrades: number;
  maxLosses: number;
  blockedBy: "losses" | "trades" | null;
};

/** Today's limits for one account. `pendingPlans` = today's active plans that no trade matches yet. */
export function dayStatus(trades: readonly PlaybookTrade[], pendingPlans: number, at: number, config: PlaybookConfig): DayStatus {
  const day = zonedParts(at, config.timezone).date;
  const today = trades.filter(trade => { try { return zonedParts(trade.opened_at, config.timezone).date === day; } catch { return false; } });
  const losses = today.filter(trade => outcomeOf(trade, config.breakevenR) === "loss").length;
  const entries = today.length + Math.max(0, pendingPlans);
  const blockedBy = losses >= config.maxLossesPerDay ? "losses" : entries >= config.maxTradesPerDay ? "trades" : null;
  return { day, entries, losses, maxTrades: config.maxTradesPerDay, maxLosses: config.maxLossesPerDay, blockedBy };
}
