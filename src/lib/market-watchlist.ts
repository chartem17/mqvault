import type { AssetClass, Provider } from "@/lib/market-types";

export type WatchlistInstrument = {
  symbol: string;
  displaySymbol: string;
  market: string;
  assetClass: AssetClass;
  provider: Provider;
  providerSymbol: string;
};

// providerSymbol must be verified in your Twelve Data account before production.
export const MARKET_WATCHLIST: WatchlistInstrument[] = [
  { symbol: "BTCUSDT", displaySymbol: "BTC/USDT", market: "Crypto", assetClass: "crypto", provider: "binance", providerSymbol: "BTCUSDT" },
  { symbol: "ETHUSDT", displaySymbol: "ETH/USDT", market: "Crypto", assetClass: "crypto", provider: "binance", providerSymbol: "ETHUSDT" },
  { symbol: "SOLUSDT", displaySymbol: "SOL/USDT", market: "Crypto", assetClass: "crypto", provider: "binance", providerSymbol: "SOLUSDT" },
  { symbol: "EURUSD", displaySymbol: "EUR/USD", market: "Forex", assetClass: "forex", provider: "twelve-data", providerSymbol: "EUR/USD" },
  { symbol: "GBPUSD", displaySymbol: "GBP/USD", market: "Forex", assetClass: "forex", provider: "twelve-data", providerSymbol: "GBP/USD" },
  { symbol: "USDJPY", displaySymbol: "USD/JPY", market: "Forex", assetClass: "forex", provider: "twelve-data", providerSymbol: "USD/JPY" },
  { symbol: "XAUUSD", displaySymbol: "XAU/USD", market: "Metals", assetClass: "metal", provider: "twelve-data", providerSymbol: "XAU/USD" },
  { symbol: "US30", displaySymbol: "Dow Jones", market: "Index", assetClass: "index", provider: "twelve-data", providerSymbol: "DIA" },
];

export const getInstrument = (symbol: string) => MARKET_WATCHLIST.find((item) => item.symbol === symbol);
