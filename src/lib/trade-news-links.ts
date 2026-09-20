import type { AccountTrade } from "@/hooks/use-trades";
import type { EconomicEvent, EconomicImpact } from "@/lib/economic-events";

export type NewsRelation = "before_entry" | "near_entry" | "during_trade" | "near_exit" | "after_exit";
export type ExposureScore = "none" | "low" | "medium" | "high";

export type TradeNewsLink = {
  tradeId: number;
  eventId: string;
  relation: NewsRelation;
  entryDistanceMinutes: number | null;
  exitDistanceMinutes: number | null;
  overlapsRelease: boolean;
  exposure: ExposureScore;
  relevantByCurrency: boolean;
  relevantByMarket: boolean;
};

const EVENT_WINDOWS: Record<EconomicImpact, number> = {
  high: 30,
  medium: 15,
  low: 10,
};

const CURRENCY_ASSETS: Record<string, string[]> = {
  USD: ["EUR/USD", "GBP/USD", "USD/JPY", "XAU/USD", "US30", "BTC/USDT", "ETH/USDT"],
  EUR: ["EUR/USD", "GER40"],
  GBP: ["GBP/USD"],
  JPY: ["USD/JPY"],
  CAD: ["USD/CAD"],
  AUD: ["AUD/USD"],
  CNY: ["XAU/USD", "BTC/USDT", "ETH/USDT"],
};

function minutesBetween(a: Date, b: Date) {
  return (a.getTime() - b.getTime()) / 60000;
}

function parseTradeDateTime(trade: AccountTrade) {
  const date = `${trade.date}T${trade.time || "00:00"}:00`;
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseCloseTime(trade: AccountTrade) {
  const candidate = (trade as AccountTrade & { closedAt?: string; closedAtUtc?: string }).closedAtUtc ?? (trade as AccountTrade & { closedAt?: string }).closedAt;
  if (!candidate) return null;
  const parsed = new Date(candidate);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function eventMatchesTrade(trade: AccountTrade, event: EconomicEvent) {
  const pair = trade.pair.toUpperCase();
  const assets = CURRENCY_ASSETS[event.currency] ?? [];
  return assets.some((asset) => asset.toUpperCase() === pair);
}

export function getExposureScore(impact: EconomicImpact, overlapsRelease: boolean, relation: NewsRelation): ExposureScore {
  if (!overlapsRelease && relation === "after_exit") return "none";
  if (impact === "high" && overlapsRelease) return "high";
  if (impact === "high" || relation === "near_entry" || relation === "near_exit") return "medium";
  return "low";
}

export function buildTradeNewsLink(trade: AccountTrade, event: EconomicEvent): TradeNewsLink | null {
  const openedAt = parseTradeDateTime(trade);
  const releasedAt = new Date(event.scheduledAtUtc);
  if (!openedAt || Number.isNaN(releasedAt.getTime())) return null;

  const closedAt = parseCloseTime(trade);
  const entryDistance = minutesBetween(openedAt, releasedAt);
  const exitDistance = closedAt ? minutesBetween(closedAt, releasedAt) : null;
  const window = EVENT_WINDOWS[event.impact];
  const overlapsRelease = Boolean(closedAt && openedAt <= releasedAt && releasedAt <= closedAt);
  const nearEntry = Math.abs(entryDistance) <= window;
  const nearExit = exitDistance !== null && Math.abs(exitDistance) <= window;
  const relevantByCurrency = eventMatchesTrade(trade, event);
  const relevantByMarket = relevantByCurrency;

  if (!relevantByCurrency || (!nearEntry && !nearExit && !overlapsRelease)) return null;

  const relation: NewsRelation = overlapsRelease
    ? "during_trade"
    : nearEntry && entryDistance < 0
      ? "before_entry"
      : nearEntry
        ? "near_entry"
        : nearExit && exitDistance! < 0
          ? "near_exit"
          : "after_exit";

  return {
    tradeId: trade.id,
    eventId: event.id,
    relation,
    entryDistanceMinutes: entryDistance,
    exitDistanceMinutes: exitDistance,
    overlapsRelease,
    exposure: getExposureScore(event.impact, overlapsRelease, relation),
    relevantByCurrency,
    relevantByMarket,
  };
}

export function buildTradeNewsLinks(trades: AccountTrade[], events: EconomicEvent[]) {
  return trades.flatMap((trade) => events.map((event) => buildTradeNewsLink(trade, event)).filter((link): link is TradeNewsLink => link !== null));
}
