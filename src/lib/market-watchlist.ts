import { MARKET_INSTRUMENTS, type MarketInstrument } from "./instruments";

export type { MarketInstrument as WatchlistInstrument } from "./instruments";

// The shared catalog (src/lib/instruments.ts) also feeds journal symbol choices and strategy rules,
// so it keeps stocks and forex exotics. The Market tab only polls what is listed here.
const FOREX_CURRENCIES = new Set(["USD", "EUR", "GBP", "JPY", "AUD", "NZD", "CAD", "CHF"]);
const EXCLUDED_ENERGY_EQUITIES = new Set(["COP", "CVX", "SLB", "XLE", "XOM"]);

export function isWatchlistInstrument(item: MarketInstrument): boolean {
  if (!item.isActive) return false;
  if (item.assetClass === "stock" || EXCLUDED_ENERGY_EQUITIES.has(item.symbol)) return false;
  if (item.assetClass === "forex") {
    return FOREX_CURRENCIES.has(item.symbol.slice(0, 3)) && FOREX_CURRENCIES.has(item.symbol.slice(3, 6));
  }
  return true;
}

export const MARKET_WATCHLIST: MarketInstrument[] = MARKET_INSTRUMENTS.filter(isWatchlistInstrument);
export const ALL_SYMBOLS = MARKET_WATCHLIST.map((item) => item.symbol);
