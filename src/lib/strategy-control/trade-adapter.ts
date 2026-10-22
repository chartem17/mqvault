import type { JournalTrade } from "@/hooks/use-trades";
import type { Trade, TradeSession } from "./types";

function toNumber(value: string | number | null | undefined): number | null {
  if (value == null || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function normalizePair(symbol: string): string {
  if (!symbol) return "";
  if (symbol.includes("/")) return symbol.toUpperCase();
  if (/^[A-Z]{6}$/.test(symbol)) {
    return `${symbol.slice(0, 3).toUpperCase()}/${symbol.slice(3).toUpperCase()}`;
  }
  if (/^[A-Z0-9.-]+USDT$/i.test(symbol) && !symbol.includes("/")) {
    const base = symbol.slice(0, -4).toUpperCase();
    return `${base}/USDT`;
  }
  return symbol.toUpperCase();
}

function mapSession(value?: string | null): TradeSession | null {
  if (value === "Asia" || value === "London" || value === "NY") return value;
  if (value === "Overlap") return "London";
  if (value && value.trim()) return "Other";
  return null;
}

function mapEmotion(
  value?: string | null,
): "Calm" | "Angry" | "Neutral" | "Tired" | null {
  if (
    value === "Calm" ||
    value === "Angry" ||
    value === "Neutral" ||
    value === "Tired"
  ) {
    return value;
  }
  return null;
}

function derivePlannedRR(trade: JournalTrade): number | null {
  const entry = toNumber(trade.entry_price);
  const stop = toNumber(trade.stop_loss);
  const take = toNumber(trade.take_profit);

  if (entry === null || stop === null || take === null) return null;

  const risk = trade.direction === "Short" ? stop - entry : entry - stop;
  const reward = trade.direction === "Short" ? entry - take : take - entry;

  if (!(risk > 0) || !(reward > 0)) return null;
  return Math.round((reward / risk) * 100) / 100;
}

function inferModelConfirmed(trade: JournalTrade): boolean | null {
  if (trade.mistake && trade.mistake.trim()) return false;
  if (trade.setup || trade.entry_reason) return true;
  return null;
}

export function toStrategyControlTrade(trade: JournalTrade): Trade {
  return {
    id: trade.id,
    accountId: trade.account_id,
    date: trade.opened_at.slice(0, 10),
    openedAt: trade.opened_at,
    closedAt: trade.closed_at ?? null,
    pair: normalizePair(trade.symbol),
    market: trade.market ?? null,
    direction: trade.direction === "Short" ? "Short" : "Long",
    session: mapSession(trade.session),
    resultR: typeof trade.result_r === "number" ? trade.result_r : null,
    resultUsd: typeof trade.net_pnl === "number" ? trade.net_pnl : null,
    grossPnl: typeof trade.gross_pnl === "number" ? trade.gross_pnl : null,
    netPnl: typeof trade.net_pnl === "number" ? trade.net_pnl : null,
    riskPct: typeof trade.risk_percent === "number" ? trade.risk_percent : null,
    plannedRR: derivePlannedRR(trade),
    emotion: mapEmotion(trade.emotion),
    modelConfirmed: inferModelConfirmed(trade),
    setup: trade.setup ?? null,
    mistake: trade.mistake ?? null,
    tags: [],
  };
}
