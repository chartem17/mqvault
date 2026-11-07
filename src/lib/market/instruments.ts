export type MarketInstrument = {
  symbol: string;
  displaySymbol: string;
  market: "Crypto" | "Forex" | "Commodities" | "Energy" | "Index" | "Stocks";
  assetClass:
    | "crypto"
    | "forex"
    | "metal"
    | "agriculture"
    | "energy"
    | "index"
    | "stock";
  provider: "binance" | "twelve-data";
  providerSymbol: string;
  isActive: boolean;
  sortOrder: number;
};

const crypto = (symbol: string, displaySymbol: string): MarketInstrument => ({
  symbol,
  displaySymbol,
  market: "Crypto",
  assetClass: "crypto",
  provider: "binance",
  providerSymbol: symbol,
  isActive: true,
  sortOrder: 0,
});

const td = (
  symbol: string,
  displaySymbol: string,
  market: MarketInstrument["market"],
  assetClass: MarketInstrument["assetClass"],
  providerSymbol: string,
): MarketInstrument => ({
  symbol,
  displaySymbol,
  market,
  assetClass,
  provider: "twelve-data",
  providerSymbol,
  isActive: true,
  sortOrder: 0,
});

const fx = (symbol: string): MarketInstrument =>
  td(
    symbol,
    `${symbol.slice(0, 3)}/${symbol.slice(3)}`,
    "Forex",
    "forex",
    `${symbol.slice(0, 3)}/${symbol.slice(3)}`,
  );

const stock = (symbol: string, name: string) =>
  td(symbol, name, "Stocks", "stock", symbol);
const energyStock = (symbol: string, name: string) =>
  td(symbol, name, "Energy", "energy", symbol);

export const MARKET_INSTRUMENTS: MarketInstrument[] = [
  // Crypto (Binance)
  crypto("AAVEUSDT", "AAVE/USDT"),
  crypto("ADAUSDT", "ADA/USDT"),
  crypto("APTUSDT", "APT/USDT"),
  crypto("ARBUSDT", "ARB/USDT"),
  crypto("ATOMUSDT", "ATOM/USDT"),
  crypto("AVAXUSDT", "AVAX/USDT"),
  crypto("BCHUSDT", "BCH/USDT"),
  crypto("BNBUSDT", "BNB/USDT"),
  crypto("BTCUSDT", "BTC/USDT"),
  crypto("DOGEUSDT", "DOGE/USDT"),
  crypto("DOTUSDT", "DOT/USDT"),
  crypto("ETCUSDT", "ETC/USDT"),
  crypto("ETHUSDT", "ETH/USDT"),
  crypto("FILUSDT", "FIL/USDT"),
  crypto("HBARUSDT", "HBAR/USDT"),
  crypto("INJUSDT", "INJ/USDT"),
  crypto("LINKUSDT", "LINK/USDT"),
  crypto("LTCUSDT", "LTC/USDT"),
  crypto("NEARUSDT", "NEAR/USDT"),
  crypto("OPUSDT", "OP/USDT"),
  crypto("PEPEUSDT", "PEPE/USDT"),
  crypto("POLUSDT", "POL/USDT"),
  crypto("SHIBUSDT", "SHIB/USDT"),
  crypto("SOLUSDT", "SOL/USDT"),
  crypto("SUIUSDT", "SUI/USDT"),
  crypto("TONUSDT", "TON/USDT"),
  crypto("TRXUSDT", "TRX/USDT"),
  crypto("UNIUSDT", "UNI/USDT"),
  crypto("XLMUSDT", "XLM/USDT"),
  crypto("XRPUSDT", "XRP/USDT"),

  // Forex (Twelve Data)
  fx("AUDCAD"),
  fx("AUDCHF"),
  fx("AUDJPY"),
  fx("AUDNZD"),
  fx("AUDUSD"),
  fx("CADCHF"),
  fx("CADJPY"),
  fx("CHFJPY"),
  fx("EURAUD"),
  fx("EURCAD"),
  fx("EURCHF"),
  fx("EURGBP"),
  fx("EURJPY"),
  fx("EURNZD"),
  fx("EURUSD"),
  fx("GBPAUD"),
  fx("GBPCAD"),
  fx("GBPCHF"),
  fx("GBPJPY"),
  fx("GBPNZD"),
  fx("GBPUSD"),
  fx("NZDCAD"),
  fx("NZDCHF"),
  fx("NZDJPY"),
  fx("NZDUSD"),
  fx("USDCAD"),
  fx("USDCHF"),
  fx("USDCNH"),
  fx("USDJPY"),
  fx("USDMXN"),
  fx("USDNOK"),
  fx("USDPLN"),
  fx("USDSEK"),
  fx("USDSGD"),
  fx("USDTRY"),
  fx("USDZAR"),

  // Metals
  td("XAGUSD", "XAG/USD", "Commodities", "metal", "XAG/USD"),
  td("XAUUSD", "XAU/USD", "Commodities", "metal", "XAU/USD"),
  td("XCUUSD", "Copper", "Commodities", "metal", "XCU/USD"),
  td("XPDUSD", "XPD/USD", "Commodities", "metal", "XPD/USD"),
  td("XPTUSD", "XPT/USD", "Commodities", "metal", "XPT/USD"),

  // Agriculture
  td("COCOA", "Cocoa", "Commodities", "agriculture", "CC1"),
  td("COFFEE", "Coffee", "Commodities", "agriculture", "KC1"),
  td("CORN", "Corn", "Commodities", "agriculture", "C_1"),
  td("COTTON", "Cotton", "Commodities", "agriculture", "CT1"),
  td("SOYBEAN", "Soybeans", "Commodities", "agriculture", "S_1"),
  td("SUGAR", "Sugar", "Commodities", "agriculture", "SB1"),
  td("WHEAT", "Wheat", "Commodities", "agriculture", "W_1"),

  // Energy
  td("BRENTUSD", "Brent Crude", "Energy", "energy", "XBR/USD"),
  td("GASOLINE", "RBOB Gasoline", "Energy", "energy", "RB1"),
  td("HEATINGOIL", "Heating Oil", "Energy", "energy", "HO1"),
  td("NGUSD", "Natural Gas", "Energy", "energy", "NG/USD"),
  td("WTIUSD", "WTI Crude", "Energy", "energy", "WTI/USD"),
  energyStock("COP", "ConocoPhillips"),
  energyStock("CVX", "Chevron"),
  energyStock("SLB", "Schlumberger"),
  energyStock("XLE", "Energy Sector ETF"),
  energyStock("XOM", "Exxon Mobil"),

  // Indices
  td("AUS200", "ASX 200", "Index", "index", "EWA"),
  td("CHN50", "China Large-Cap", "Index", "index", "FXI"),
  td("EEM", "Emerging Markets", "Index", "index", "EEM"),
  td("FRA40", "CAC 40", "Index", "index", "EWQ"),
  td("GER40", "DAX 40", "Index", "index", "EWG"),
  td("HK50", "Hang Seng", "Index", "index", "EWH"),
  td("JPN225", "Nikkei 225", "Index", "index", "EWJ"),
  td("NAS100", "Nasdaq 100", "Index", "index", "QQQ"),
  td("UK100", "FTSE 100", "Index", "index", "EWU"),
  td("US2000", "Russell 2000", "Index", "index", "IWM"),
  td("US30", "Dow Jones", "Index", "index", "DIA"),
  td("US500", "S&P 500", "Index", "index", "SPY"),

  // Stocks
  stock("AAPL", "Apple"),
  stock("ADBE", "Adobe"),
  stock("AMD", "AMD"),
  stock("AMZN", "Amazon"),
  stock("AVGO", "Broadcom"),
  stock("BA", "Boeing"),
  stock("BAC", "Bank of America"),
  stock("BRK.B", "Berkshire Hathaway"),
  stock("CAT", "Caterpillar"),
  stock("COIN", "Coinbase"),
  stock("COST", "Costco"),
  stock("CRM", "Salesforce"),
  stock("DIS", "Disney"),
  stock("F", "Ford"),
  stock("GOOGL", "Alphabet"),
  stock("GS", "Goldman Sachs"),
  stock("INTC", "Intel"),
  stock("JNJ", "Johnson & Johnson"),
  stock("JPM", "JPMorgan"),
  stock("KO", "Coca-Cola"),
  stock("LLY", "Eli Lilly"),
  stock("MA", "Mastercard"),
  stock("MCD", "McDonald's"),
  stock("META", "Meta"),
  stock("MSFT", "Microsoft"),
  stock("MSTR", "MicroStrategy"),
  stock("NFLX", "Netflix"),
  stock("NKE", "Nike"),
  stock("NVDA", "NVIDIA"),
  stock("ORCL", "Oracle"),
  stock("PEP", "PepsiCo"),
  stock("PFE", "Pfizer"),
  stock("PLTR", "Palantir"),
  stock("QCOM", "Qualcomm"),
  stock("SHOP", "Shopify"),
  stock("TSLA", "Tesla"),
  stock("UBER", "Uber"),
  stock("UNH", "UnitedHealth"),
  stock("V", "Visa"),
  stock("WMT", "Walmart"),
];

export const MARKET_WATCHLIST = MARKET_INSTRUMENTS;
export const ALL_SYMBOLS = MARKET_INSTRUMENTS.map((item) => item.symbol);

// ---- Aliases used by useInstruments / ManualTradeModal ----
export type Instrument = MarketInstrument;
export const FALLBACK_INSTRUMENTS: Instrument[] = MARKET_INSTRUMENTS;

export function marketForSymbol(
  list: Instrument[] | null | undefined,
  symbol: string,
): string | null {
  if (!Array.isArray(list)) return null;
  const key = symbol.trim().toUpperCase();
  return list.find((item) => item.symbol.toUpperCase() === key)?.market ?? null;
}
