export type AssetClass = "crypto" | "forex" | "metal" | "index";
export type Provider = "binance" | "twelve-data";
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
  error?: string;
};
