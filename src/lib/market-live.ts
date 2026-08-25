import "server-only";
import { MARKET_WATCHLIST, type WatchlistInstrument } from "@/lib/market-watchlist";
import type { MarketQuote } from "@/lib/market-types";

const TWELVE_CACHE_MS = 60_000;
const TWELVE_RETRY_AFTER_429_MS = 90_000;
const BINANCE_CACHE_MS = 15_000;
const twelveApiKey = process.env.TWELVE_DATA_API_KEY;

type TwelveResponse = Record<string, unknown>;
type Cache = { quotes: MarketQuote[]; expiresAt: number };

let twelveCache: Cache | null = null;
let binanceCache: Cache | null = null;
let twelveInFlight: Promise<MarketQuote[]> | null = null;
let binanceInFlight: Promise<MarketQuote[]> | null = null;
let twelveBlockedUntil = 0;

const numberOrNull = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

function unavailable(item: WatchlistInstrument, error: string): MarketQuote {
  return {
    ...item,
    price: null,
    previousClose: null,
    changePercent: null,
    high: null,
    low: null,
    marketState: "unknown",
    delayed: false,
    updatedAt: null,
    error,
  };
}

function quoteFromTwelve(item: WatchlistInstrument, data: TwelveResponse): MarketQuote {
  const isOpen = data.is_market_open;
  return {
    ...item,
    price: numberOrNull(data.close ?? data.price),
    previousClose: numberOrNull(data.previous_close),
    changePercent: numberOrNull(data.percent_change ?? data.change_percent),
    high: numberOrNull(data.high),
    low: numberOrNull(data.low),
    marketState: isOpen === true ? "open" : isOpen === false ? "closed" : "unknown",
    delayed: false,
    updatedAt: Date.now(),
  };
}

async function fetchBinanceBatch(items: WatchlistInstrument[]): Promise<MarketQuote[]> {
  if (binanceCache && Date.now() < binanceCache.expiresAt) return binanceCache.quotes;
  if (binanceInFlight) return binanceInFlight;

  binanceInFlight = (async () => {
    try {
      const symbols = items.map((item) => item.providerSymbol);
      const response = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbols=${encodeURIComponent(JSON.stringify(symbols))}`, {
        cache: "no-store",
        signal: AbortSignal.timeout(8_000),
      });
      if (!response.ok) throw new Error(`Binance HTTP ${response.status}`);
      const payload = await response.json() as Array<Record<string, unknown>>;
      const bySymbol = new Map(payload.map((quote) => [String(quote.symbol), quote]));
      const quotes = items.map((item) => {
        const data = bySymbol.get(item.providerSymbol);
        if (!data) return unavailable(item, "Binance returned no quote for this symbol");
        return {
          ...item,
          price: numberOrNull(data.lastPrice),
          previousClose: numberOrNull(data.prevClosePrice),
          changePercent: numberOrNull(data.priceChangePercent),
          high: numberOrNull(data.highPrice),
          low: numberOrNull(data.lowPrice),
          marketState: "open" as const,
          delayed: false,
          updatedAt: Date.now(),
        };
      });
      binanceCache = { quotes, expiresAt: Date.now() + BINANCE_CACHE_MS };
      return quotes;
    } catch (error) {
      return items.map((item) => unavailable(item, error instanceof Error ? error.message : "Binance unavailable"));
    } finally {
      binanceInFlight = null;
    }
  })();

  return binanceInFlight;
}

async function fetchTwelveBatch(items: WatchlistInstrument[]): Promise<MarketQuote[]> {
  if (!twelveApiKey) return items.map((item) => unavailable(item, "TWELVE_DATA_API_KEY is not configured"));
  if (twelveCache && Date.now() < twelveCache.expiresAt) return twelveCache.quotes;
  if (Date.now() < twelveBlockedUntil) {
    const seconds = Math.ceil((twelveBlockedUntil - Date.now()) / 1_000);
    return items.map((item) => unavailable(item, `Twelve Data rate limit: retrying automatically in ${seconds}s`));
  }
  if (twelveInFlight) return twelveInFlight;

  twelveInFlight = (async () => {
    try {
      // One request for all Twelve Data instruments, not one request per symbol.
      const url = new URL("https://api.twelvedata.com/quote");
      url.searchParams.set("symbol", items.map((item) => item.providerSymbol).join(","));
      url.searchParams.set("apikey", twelveApiKey);
      const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(10_000) });

      if (response.status === 429) {
        twelveBlockedUntil = Date.now() + TWELVE_RETRY_AFTER_429_MS;
        throw new Error("Twelve Data HTTP 429 — rate limit reached; cached data will resume automatically");
      }
      if (!response.ok) throw new Error(`Twelve Data HTTP ${response.status}`);

      const payload = await response.json() as Record<string, TwelveResponse> | TwelveResponse;
      if ((payload as TwelveResponse).status === "error") {
        throw new Error(String((payload as TwelveResponse).message ?? "Twelve Data rejected the request"));
      }

      const quotes = items.map((item) => {
        const data = (payload as Record<string, TwelveResponse>)[item.providerSymbol] ??
          (payload as Record<string, TwelveResponse>)[item.providerSymbol.replace("/", "")] ??
          (items.length === 1 ? payload as TwelveResponse : undefined);
        if (!data || data.status === "error") {
          const reason = data?.message ? String(data.message) : "Twelve Data returned no quote for this symbol";
          return unavailable(item, reason);
        }
        return quoteFromTwelve(item, data);
      });

      twelveCache = { quotes, expiresAt: Date.now() + TWELVE_CACHE_MS };
      return quotes;
    } catch (error) {
      // Preserve the last successful values during a temporary provider throttle.
      if (twelveCache?.quotes.length) return twelveCache.quotes;
      const message = error instanceof Error ? error.message : "Twelve Data unavailable";
      return items.map((item) => unavailable(item, message));
    } finally {
      twelveInFlight = null;
    }
  })();

  return twelveInFlight;
}

export async function fetchMarketQuotes(symbols?: string[]): Promise<MarketQuote[]> {
  const requested = symbols?.length
    ? MARKET_WATCHLIST.filter((item) => symbols.includes(item.symbol))
    : MARKET_WATCHLIST;
  const binanceItems = requested.filter((item) => item.provider === "binance");
  const twelveItems = requested.filter((item) => item.provider === "twelve-data");
  const [binance, twelve] = await Promise.all([
    binanceItems.length ? fetchBinanceBatch(binanceItems) : Promise.resolve([]),
    twelveItems.length ? fetchTwelveBatch(twelveItems) : Promise.resolve([]),
  ]);
  const bySymbol = new Map([...binance, ...twelve].map((quote) => [quote.symbol, quote]));
  return requested.map((item) => bySymbol.get(item.symbol) ?? unavailable(item, "Quote not returned"));
}
