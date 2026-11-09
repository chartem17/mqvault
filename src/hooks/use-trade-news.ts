"use client";

import { useEffect, useState } from "react";
import type { TradeNewsSummary } from "@/lib/news/news-trades";

export type TradeNewsMap = Map<string, TradeNewsSummary>;
type Loaded = { byTrade: TradeNewsMap | null; error: boolean };

// One request per trade-set key, shared by every component that shows news (journal, modal, widget, rules).
let cache: { key: string; promise: Promise<Loaded> } | null = null;

function load(key: string): Promise<Loaded> {
  if (cache?.key === key) return cache.promise;
  const promise = fetch("/api/news-impact", { cache: "no-store", credentials: "same-origin" })
    .then(response => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
    .then((payload: { trades?: TradeNewsSummary[]; coverage?: unknown }): Loaded => {
      if (!Array.isArray(payload?.trades)) throw new Error("Invalid news payload");
      // No calendar rows in range means "not checked", not "no news".
      if (!payload.coverage) return { byTrade: null, error: false };
      return { byTrade: new Map(payload.trades.map(item => [item.tradeId, item])), error: false };
    })
    .catch((): Loaded => {
      if (cache?.key === key) cache = null; // let the next render retry
      return { byTrade: null, error: true };
    });
  cache = { key, promise };
  return promise;
}

/**
 * Per-trade news exposure from /api/news-impact (all of the owner's trades).
 * `byTrade` is null while loading or when the calendar could not be read: callers then treat trades
 * as "not checked" rather than "clear", so the news rule never passes trades it did not see.
 * `key` should change when trades or their times change (see tradeNewsKey).
 */
export function useTradeNews(key: string) {
  const [state, setState] = useState<Loaded & { loading: boolean }>({ byTrade: null, error: false, loading: true });
  useEffect(() => {
    let cancelled = false;
    setState(current => ({ ...current, loading: true }));
    load(key).then(result => { if (!cancelled) setState({ ...result, loading: false }); });
    return () => { cancelled = true; };
  }, [key]);
  return state;
}

/** Cache key for a list of trades: changes when a trade is added, removed or its times change. */
export function tradeNewsKey(trades: readonly { id: string; opened_at: string; closed_at?: string | null }[]) {
  return trades.map(trade => `${trade.id}@${trade.opened_at}@${trade.closed_at ?? ""}`).join("|");
}
