"use client";
import { useCallback, useEffect, useState } from "react";
import type { MarketQuote } from "@/lib/market-types";

type FeedState = "loading" | "ready" | "degraded" | "error";
export function useMarketQuotes(symbols?: string[], refreshMs = 15_000) {
  const [quotes, setQuotes] = useState<MarketQuote[]>([]);
  const [state, setState] = useState<FeedState>("loading");
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const load = useCallback(async () => {
    try {
      const params = symbols?.length ? `?symbols=${encodeURIComponent(symbols.join(","))}` : "";
      const response = await fetch(`/api/market/quotes${params}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`Market API HTTP ${response.status}`);
      const payload = await response.json() as { quotes: MarketQuote[]; generatedAt: number };
      setQuotes(payload.quotes);
      setUpdatedAt(payload.generatedAt);
      setState(payload.quotes.some((quote) => quote.error) ? "degraded" : "ready");
    } catch {
      setState("error");
    }
  }, [symbols?.join(",")]);
  useEffect(() => { load(); const timer = window.setInterval(load, refreshMs); return () => window.clearInterval(timer); }, [load, refreshMs]);
  return { quotes, state, updatedAt, refresh: load };
}
