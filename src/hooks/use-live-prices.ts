"use client";
import { useMemo } from "react";
import { useMarketQuotes } from "@/hooks/use-market-quotes";

export type TickerData = { symbol: string; price: number; change24h: number; high24h: number; low24h: number; volume24h: number; source: "binance-ws" | "polygon-ws" | "twelvedata"; updatedAt: number; };
const SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "EURUSD", "GBPUSD", "XAUUSD", "XAGUSD"];
export function useLivePrices() {
  const { quotes, state } = useMarketQuotes(SYMBOLS, 60_000);
  const tickers = useMemo(() => Object.fromEntries(quotes.filter((q) => q.price !== null).map((q) => [q.symbol, { symbol: q.symbol, price: q.price!, change24h: q.changePercent ?? 0, high24h: q.high ?? 0, low24h: q.low ?? 0, volume24h: 0, source: q.provider === "binance" ? "binance-ws" : "twelvedata", updatedAt: q.updatedAt ?? 0 } satisfies TickerData])), [quotes]);
  return { tickers, loading: state === "loading", error: state === "error" };
}
