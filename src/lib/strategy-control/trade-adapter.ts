import type { JournalTrade } from "@/hooks/use-trades";
import { getKyivDate, getSessionGroup, getSessionKey, getSessionLabel } from "@/lib/sessions";
import type { Trade, TradeSession } from "./types";
function toNumber(value: string | number | null | undefined): number | null { if (value == null || value === "") return null; const num = Number(value); return Number.isFinite(num) ? num : null; }
function normalizePair(symbol: string): string { if (!symbol) return ""; if (symbol.includes("/")) return symbol.toUpperCase(); if (/^[A-Z]{6}$/.test(symbol)) return `${symbol.slice(0, 3).toUpperCase()}/${symbol.slice(3).toUpperCase()}`; if (/^[A-Z0-9.-]+USDT$/i.test(symbol)) return `${symbol.slice(0, -4).toUpperCase()}/USDT`; return symbol.toUpperCase(); }
function mapEmotion(value?: string | null): "Calm" | "Angry" | "Neutral" | "Tired" | null { return value === "Calm" || value === "Angry" || value === "Neutral" || value === "Tired" ? value : null; }
function derivePlannedRR(trade: JournalTrade): number | null { const entry = toNumber(trade.entry_price), stop = toNumber(trade.stop_loss), take = toNumber(trade.take_profit); if (entry === null || stop === null || take === null) return null; const risk = trade.direction === "Short" ? stop - entry : entry - stop; const reward = trade.direction === "Short" ? entry - take : take - entry; return risk > 0 && reward > 0 ? Math.round(reward / risk * 100) / 100 : null; }
function inferModelConfirmed(trade: JournalTrade): boolean | null { if (trade.mistake?.trim()) return false; if (trade.setup || trade.entry_reason) return true; return null; }
export function toStrategyControlTrade(trade: JournalTrade): Trade {
  let session: TradeSession | null = null, sessionKey: string | null = null, sessionGroup: string | null = null;
  let date = trade.opened_at.slice(0, 10);
  try {
    date = getKyivDate(trade.opened_at); sessionKey = getSessionKey(trade.opened_at); sessionGroup = getSessionGroup(trade.opened_at);
    const group = sessionGroup;
    session = group === "asia" ? "Asia" : group === "london" ? "London" : group === "new_york" ? "NY" : "Other";
  } catch { /* Invalid timestamps remain unclassified. */ }
  return { id: trade.id, accountId: trade.account_id, date, openedAt: trade.opened_at, closedAt: trade.closed_at ?? null, pair: normalizePair(trade.symbol), market: trade.market ?? null, direction: trade.direction === "Short" ? "Short" : "Long", session, sessionKey, sessionGroup, resultR: typeof trade.result_r === "number" ? trade.result_r : null, resultUsd: typeof trade.net_pnl === "number" ? trade.net_pnl : null, grossPnl: typeof trade.gross_pnl === "number" ? trade.gross_pnl : null, netPnl: typeof trade.net_pnl === "number" ? trade.net_pnl : null, riskPct: typeof trade.risk_percent === "number" ? trade.risk_percent : null, plannedRR: derivePlannedRR(trade), emotion: mapEmotion(trade.emotion), modelConfirmed: inferModelConfirmed(trade), setup: trade.setup ?? null, mistake: trade.mistake ?? null, tags: [] };
}
export { getSessionLabel };
