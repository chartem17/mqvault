/**
 * One trading idea made of several trades (scaling in, a second entry on the same move) — ADR 0022.
 * Pure. Trades are linked by `meta.idea.id`; nothing about the idea is stored besides that id.
 *
 * The idea's R is Σ net / Σ initial risk: every trade keeps its own risk at its own initial stop, and the idea is
 * judged by the money made per money risked. This is the same as the average of the trades' R weighted by their
 * risk, so a 1 % trade counts twice as much as a 0.5 % add-on. It is deliberately NOT computed from an average
 * entry and a common stop: when the add-on's stop sits inside the first trade's profit, a "common stop" would
 * describe a position that never existed.
 */
import { msg } from "../i18n/core";
import { planRR, sameSymbol } from "../playbook/plans";

export const MAX_IDEA_TRADES = 10;
/** Trades opened further apart than this are not offered as one idea. */
export const IDEA_WINDOW_HOURS = 72;

export type IdeaLink = { id: string };
export type IdeaTrade = {
  id: string; account_id: string; symbol: string; direction: string; opened_at: string; closed_at?: string | null;
  entry_price?: string | number | null; volume?: number | string | null; take_profit?: string | number | null;
  stop_loss?: string | number | null; initial_stop_loss?: string | number | null;
  net_pnl?: number | null; risk_amount?: number | null; risk_percent?: number | null; idea?: IdeaLink | null;
};

const num = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};
const round = (value: number, digits: number) => Math.round(value * 10 ** digits) / 10 ** digits;

/** Two trades can form one idea: same account, same instrument (broker suffixes ignored), same direction. */
export function canJoin(a: IdeaTrade, b: IdeaTrade): boolean {
  return a.id !== b.id && a.account_id === b.account_id && a.direction === b.direction && sameSymbol(a.symbol, b.symbol);
}

/** Trades that may be linked with `trade`: compatible and opened within the window, nearest first. */
export function ideaCandidates<T extends IdeaTrade>(trade: IdeaTrade, trades: readonly T[], windowHours = IDEA_WINDOW_HOURS): T[] {
  const at = Date.parse(trade.opened_at);
  if (!Number.isFinite(at)) return [];
  const span = windowHours * 3_600_000;
  return trades
    .filter(other => canJoin(trade, other) && !(trade.idea && other.idea?.id === trade.idea.id) && Math.abs(Date.parse(other.opened_at) - at) <= span)
    .sort((x, y) => Math.abs(Date.parse(x.opened_at) - at) - Math.abs(Date.parse(y.opened_at) - at));
}

/** All trades of the idea `id`, in opening order. */
export function ideaTrades<T extends IdeaTrade>(id: string, trades: readonly T[]): T[] {
  return trades.filter(trade => trade.idea?.id === id).sort((a, b) => Date.parse(a.opened_at) - Date.parse(b.opened_at));
}

export type IdeaSummary = {
  count: number;
  /** Still running: at least one trade is open. Net and R then cover only the closed ones. */
  open: boolean;
  net: number | null;
  /** Σ initial risk in money; null when a trade has no known risk (R would be misleading). */
  risk: number | null;
  r: number | null;
  /** Σ risk % of the trades (each against the account's starting balance). */
  riskPercent: number | null;
  /** Planned RR of the idea: the trades' planned RR weighted by their risk. */
  plannedRR: number | null;
  /** Average entry weighted by volume — where the combined position actually stood. Informational only. */
  averageEntry: number | null;
  volume: number | null;
};

export function summarizeIdea(trades: readonly IdeaTrade[]): IdeaSummary {
  const closed = trades.filter(trade => trade.closed_at);
  const nets = closed.map(trade => num(trade.net_pnl));
  const net = closed.length && nets.every(value => value !== null) ? round(nets.reduce((sum: number, value) => sum + (value as number), 0), 2) : null;
  const risks = closed.map(trade => num(trade.risk_amount));
  const risk = closed.length && risks.every(value => value !== null && value > 0) ? round(risks.reduce((sum: number, value) => sum + (value as number), 0), 2) : null;
  const percents = trades.map(trade => num(trade.risk_percent));
  const riskPercent = trades.length && percents.every(value => value !== null && value > 0) ? round(percents.reduce((sum: number, value) => sum + (value as number), 0), 4) : null;

  // Planned RR weighted by each trade's money risk (or its risk % when money risk is unknown).
  let weighted = 0, weights = 0, plannedKnown = trades.length > 0;
  for (const trade of trades) {
    const rr = planRR(trade.direction, num(trade.entry_price), num(trade.initial_stop_loss) ?? num(trade.stop_loss), num(trade.take_profit));
    const weight = num(trade.risk_amount) ?? num(trade.risk_percent);
    if (rr === null || weight === null || !(weight > 0)) { plannedKnown = false; break; }
    weighted += rr * weight; weights += weight;
  }

  let priced = 0, lots = 0, entryKnown = trades.length > 0;
  for (const trade of trades) {
    const entry = num(trade.entry_price), volume = num(trade.volume);
    if (entry === null || volume === null || !(volume > 0)) { entryKnown = false; break; }
    priced += entry * volume; lots += volume;
  }

  return {
    count: trades.length,
    open: closed.length < trades.length,
    net,
    risk,
    r: net !== null && risk !== null ? round(net / risk, 2) : null,
    riskPercent,
    plannedRR: plannedKnown && weights > 0 ? round(weighted / weights, 2) : null,
    averageEntry: entryKnown && lots > 0 ? round(priced / lots, 6) : null,
    volume: entryKnown ? round(lots, 4) : null,
  };
}

/** Validates a request to link trades into one idea; returns the reason in English source text, or null. */
export function linkProblem(trades: readonly IdeaTrade[]): string | null {
  if (trades.length < 2) return msg("Pick at least two trades");
  if (trades.length > MAX_IDEA_TRADES) return msg("An idea can hold up to 10 trades");
  const [first, ...rest] = trades;
  if (rest.some(trade => !canJoin(first, trade))) return msg("Trades of one idea must share the account, instrument and direction");
  const times = trades.map(trade => Date.parse(trade.opened_at));
  if (times.some(time => !Number.isFinite(time)) || Math.max(...times) - Math.min(...times) > IDEA_WINDOW_HOURS * 3_600_000) return msg("Trades of one idea must be opened within 72 hours");
  return null;
}

/** `meta.idea` from a stored row; anything malformed reads as "no idea". */
export function parseIdea(meta: unknown): IdeaLink | null {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return null;
  const idea = (meta as Record<string, unknown>).idea;
  if (!idea || typeof idea !== "object" || Array.isArray(idea)) return null;
  const id = (idea as Record<string, unknown>).id;
  return typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id) ? { id } : null;
}
