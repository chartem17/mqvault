"use client";

import { useEffect, useState } from "react";
import type { NewsBucket } from "@/lib/news/news-trades";

export type TradeNewsInfo = { bucket: NewsBucket; nearestHighMinutes: number | null; tags: string[] };

/**
 * Per-trade news exposure from /api/news-impact (all of the owner's trades).
 * `byTrade` is null while loading or when the calendar could not be read: callers then treat trades
 * as "not checked" rather than "clear", so the news rule never passes trades it did not see.
 */
export function useTradeNews(refreshKey: unknown = 0) {
  const [byTrade, setByTrade] = useState<Map<string, TradeNewsInfo> | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setError(false);
    fetch("/api/news-impact", { cache: "no-store", credentials: "same-origin" })
      .then(response => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
      .then((payload: { trades?: ({ tradeId: string } & TradeNewsInfo)[]; coverage?: unknown }) => {
        if (cancelled) return;
        if (!Array.isArray(payload?.trades)) throw new Error("Invalid news payload");
        // No calendar rows in range means "not checked", not "no news".
        if (!payload.coverage) { setByTrade(null); return; }
        setByTrade(new Map(payload.trades.map(item => [item.tradeId, { bucket: item.bucket, nearestHighMinutes: item.nearestHighMinutes, tags: item.tags }])));
      })
      .catch(() => { if (!cancelled) { setByTrade(null); setError(true); } });
    return () => { cancelled = true; };
  }, [refreshKey]);
  return { byTrade, error };
}
