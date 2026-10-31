import type { MarketInstrument } from "@/lib/instruments";

export type AssetClass = MarketInstrument["assetClass"];
export type Provider = MarketInstrument["provider"];
export type MarketState = "open" | "closed" | "unknown";
export type MarketQuote = {
  symbol: string;
  displaySymbol: string;
  market: string;
  assetClass: AssetClass;
  price: number | null;
  previousClose: number | null;
  changePercent: number | null;
  high: number | null;
  low: number | null;
  marketState: MarketState;
  delayed: boolean;
  provider: Provider;
  updatedAt: number | null;
  stale?: boolean;
  error?: string;
};
