import type { AssetClass, Provider } from "@/lib/market-types";

export type WatchlistInstrument = {
  symbol: string;
  displaySymbol: string;
  market: string;
  assetClass: AssetClass;
  provider: Provider;
  providerSymbol: string;
};

// Market labels used across the app (journal, filters, DB).
export const MARKETS = ["Crypto", "Forex", "Commodities", "Energy", "Index", "Stocks"] as const;
export type MarketName = (typeof MARKETS)[number];

// NOTE: Twelve Data providerSymbol values for Commodities, Energy and Index are best-effort
// and must be verified against your Twelve Data plan. Index uses ETF proxies (DIA, SPY, ...),
// so prices track the index but are not the index level itself.

const crypto = (base: string): WatchlistInstrument => ({
  symbol: `${base}USDT`,
  displaySymbol: `${base}/USDT`,
  market: "Crypto",
  assetClass: "crypto",
  provider: "binance",
  providerSymbol: `${base}USDT`,
});

const forex = (base: string, quote: string): WatchlistInstrument => ({
  symbol: `${base}${quote}`,
  displaySymbol: `${base}/${quote}`,
  market: "Forex",
  assetClass: "forex",
  provider: "twelve-data",
  providerSymbol: `${base}/${quote}`,
});

const td = (
  symbol: string,
  displaySymbol: string,
  market: MarketName,
  assetClass: AssetClass,
  providerSymbol: string,
): WatchlistInstrument => ({ symbol, displaySymbol, market, assetClass, provider: "twelve-data", providerSymbol });

const stock = (ticker: string, name: string): WatchlistInstrument =>
  td(ticker, name, "Stocks", "stock", ticker);

const CRYPTO_BASES = [
  "BTC", "ETH", "BNB", "SOL", "XRP", "ADA", "DOGE", "AVAX", "DOT", "LINK",
  "LTC", "TRX", "ATOM", "NEAR", "UNI", "APT", "ARB", "OP", "SUI", "TON",
  "SHIB", "PEPE", "INJ", "FIL", "ETC", "BCH", "XLM", "AAVE", "HBAR", "POL",
];

const FOREX_PAIRS: [string, string][] = [
  // Majors
  ["EUR", "USD"], ["GBP", "USD"], ["USD", "JPY"], ["USD", "CHF"], ["USD", "CAD"], ["AUD", "USD"], ["NZD", "USD"],
  // EUR crosses
  ["EUR", "GBP"], ["EUR", "JPY"], ["EUR", "CHF"], ["EUR", "AUD"], ["EUR", "CAD"], ["EUR", "NZD"],
  // GBP crosses
  ["GBP", "JPY"], ["GBP", "CHF"], ["GBP", "AUD"], ["GBP", "CAD"], ["GBP", "NZD"],
  // AUD / NZD / CAD / CHF crosses
  ["AUD", "JPY"], ["AUD", "CAD"], ["AUD", "CHF"], ["AUD", "NZD"],
  ["NZD", "JPY"], ["NZD", "CAD"], ["NZD", "CHF"],
  ["CAD", "JPY"], ["CAD", "CHF"], ["CHF", "JPY"],
  // Exotics
  ["USD", "MXN"], ["USD", "ZAR"], ["USD", "TRY"], ["USD", "SEK"], ["USD", "NOK"],
  ["USD", "SGD"], ["USD", "PLN"], ["USD", "CNH"],
];

const COMMODITIES: WatchlistInstrument[] = [
  td("XAUUSD", "XAU/USD", "Commodities", "metal", "XAU/USD"),
  td("XAGUSD", "XAG/USD", "Commodities", "metal", "XAG/USD"),
  td("XPTUSD", "XPT/USD", "Commodities", "metal", "XPT/USD"),
  td("XPDUSD", "XPD/USD", "Commodities", "metal", "XPD/USD"),
  td("XCUUSD", "Copper", "Commodities", "metal", "XCU/USD"),
  td("WHEAT", "Wheat", "Commodities", "agriculture", "W_1"),
  td("CORN", "Corn", "Commodities", "agriculture", "C_1"),
  td("SOYBEAN", "Soybeans", "Commodities", "agriculture", "S_1"),
  td("COFFEE", "Coffee", "Commodities", "agriculture", "KC1"),
  td("SUGAR", "Sugar", "Commodities", "agriculture", "SB1"),
  td("COTTON", "Cotton", "Commodities", "agriculture", "CT1"),
  td("COCOA", "Cocoa", "Commodities", "agriculture", "CC1"),
];

const ENERGY: WatchlistInstrument[] = [
  td("WTIUSD", "WTI Crude", "Energy", "energy", "WTI/USD"),
  td("BRENTUSD", "Brent Crude", "Energy", "energy", "XBR/USD"),
  td("NGUSD", "Natural Gas", "Energy", "energy", "NG/USD"),
  td("HEATINGOIL", "Heating Oil", "Energy", "energy", "HO1"),
  td("GASOLINE", "RBOB Gasoline", "Energy", "energy", "RB1"),
  td("XLE", "Energy Sector ETF", "Energy", "energy", "XLE"),
  td("XOM", "Exxon Mobil", "Energy", "energy", "XOM"),
  td("CVX", "Chevron", "Energy", "energy", "CVX"),
  td("COP", "ConocoPhillips", "Energy", "energy", "COP"),
  td("SLB", "Schlumberger", "Energy", "energy", "SLB"),
];

const INDICES: WatchlistInstrument[] = [
  td("US30", "Dow Jones", "Index", "index", "DIA"),
  td("US500", "S&P 500", "Index", "index", "SPY"),
  td("NAS100", "Nasdaq 100", "Index", "index", "QQQ"),
  td("US2000", "Russell 2000", "Index", "index", "IWM"),
  td("GER40", "DAX 40", "Index", "index", "EWG"),
  td("UK100", "FTSE 100", "Index", "index", "EWU"),
  td("FRA40", "CAC 40", "Index", "index", "EWQ"),
  td("JPN225", "Nikkei 225", "Index", "index", "EWJ"),
  td("HK50", "Hang Seng", "Index", "index", "EWH"),
  td("CHN50", "China Large-Cap", "Index", "index", "FXI"),
  td("AUS200", "ASX 200", "Index", "index", "EWA"),
  td("EEM", "Emerging Markets", "Index", "index", "EEM"),
];

const STOCKS: WatchlistInstrument[] = [
  stock("AAPL", "Apple"), stock("MSFT", "Microsoft"), stock("NVDA", "NVIDIA"), stock("GOOGL", "Alphabet"),
  stock("AMZN", "Amazon"), stock("META", "Meta"), stock("TSLA", "Tesla"), stock("AVGO", "Broadcom"),
  stock("AMD", "AMD"), stock("NFLX", "Netflix"), stock("INTC", "Intel"), stock("CRM", "Salesforce"),
  stock("ORCL", "Oracle"), stock("ADBE", "Adobe"), stock("QCOM", "Qualcomm"), stock("PLTR", "Palantir"),
  stock("COIN", "Coinbase"), stock("MSTR", "MicroStrategy"), stock("UBER", "Uber"), stock("SHOP", "Shopify"),
  stock("JPM", "JPMorgan"), stock("BAC", "Bank of America"), stock("GS", "Goldman Sachs"), stock("V", "Visa"),
  stock("MA", "Mastercard"), stock("BRK.B", "Berkshire Hathaway"), stock("WMT", "Walmart"), stock("COST", "Costco"),
  stock("KO", "Coca-Cola"), stock("PEP", "PepsiCo"), stock("MCD", "McDonald's"), stock("NKE", "Nike"),
  stock("DIS", "Disney"), stock("JNJ", "Johnson & Johnson"), stock("UNH", "UnitedHealth"), stock("LLY", "Eli Lilly"),
  stock("PFE", "Pfizer"), stock("BA", "Boeing"), stock("CAT", "Caterpillar"), stock("F", "Ford"),
];

export const MARKET_WATCHLIST: WatchlistInstrument[] = [
  ...CRYPTO_BASES.map(crypto),
  ...FOREX_PAIRS.map(([b, q]) => forex(b, q)),
  ...COMMODITIES,
  ...ENERGY,
  ...INDICES,
  ...STOCKS,
];

export const getInstrument = (symbol: string) => MARKET_WATCHLIST.find((item) => item.symbol === symbol);

export const getInstrumentsByMarket = (market: string) => MARKET_WATCHLIST.filter((item) => item.market === market);
