"use client";

import { useCallback, useEffect, useState } from "react";

export type Mt5Health = {
  connected: boolean;
  login?: number;
  server?: string;
  company?: string;
  balance?: number;
  equity?: number;
  currency?: string;
  error?: string;
};

export type Mt5Position = {
  ticket: string;
  positionId?: string;
  symbol: string;
  direction: "Long" | "Short";
  volume: number;
  openPrice: number;
  currentPrice: number;
  stopLoss: number;
  takeProfit: number;
  profit: number;
  swap: number;
  openedAt: string;
};

export type Mt5Deal = {
  ticket: string;
  order?: string;
  positionId?: string;
  symbol: string;
  direction: "Long" | "Short";
  volume: number;
  price: number;
  profit: number;
  commission?: number;
  swap?: number;
  time: string;
  entry?: "in" | "out" | "inout";
};

export type Mt5ClosedPosition = {
  positionId: string;
  ticket: string;
  symbol: string;
  direction: "Long" | "Short";
  volume: number;
  entryPrice: number;
  exitPrice: number;
  stopLoss?: number | null;
  takeProfit?: number | null;
  openedAt: string;
  closedAt: string;
  grossPnl: number;
  commission: number;
  swap: number;
  netPnl: number;
  riskAmount?: number | null;
  riskPercent?: number | null;
  resultR?: number | null;
};

type HistoryResponse = { connected: boolean; updatedAt?: string; initialDeposit?: number | null; deals?: Mt5Deal[]; positions?: Mt5ClosedPosition[]; error?: string };
type PositionsResponse = { connected: boolean; updatedAt?: string; positions?: Mt5Position[] };

export type UseMt5Result = {
  health: Mt5Health;
  positions: Mt5Position[];
  deals: Mt5Deal[];
  closedPositions: Mt5ClosedPosition[];
  initialDeposit: number | null;
  updatedAt: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
};

const OFFLINE: Mt5Health = { connected: false, error: "MT5 bridge offline" };

export function useMt5(refreshMs = 5000): UseMt5Result {
  const [health, setHealth] = useState<Mt5Health>(OFFLINE);
  const [positions, setPositions] = useState<Mt5Position[]>([]);
  const [deals, setDeals] = useState<Mt5Deal[]>([]);
  const [closedPositions, setClosedPositions] = useState<Mt5ClosedPosition[]>([]);
  const [initialDeposit, setInitialDeposit] = useState<number | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const [healthResponse, positionsResponse, historyResponse] = await Promise.all([
        fetch("/api/mt5/health", { cache: "no-store" }),
        fetch("/api/mt5/positions", { cache: "no-store" }),
        fetch("/api/mt5/history", { cache: "no-store" }),
      ]);
      if (!healthResponse.ok) throw new Error("Health request failed");
      const nextHealth = await healthResponse.json() as Mt5Health;
      setHealth(nextHealth);
      if (!nextHealth.connected) {
        setPositions([]); setDeals([]); setClosedPositions([]); setInitialDeposit(null); setUpdatedAt(null); return;
      }
      if (positionsResponse.ok) {
        const data = await positionsResponse.json() as PositionsResponse;
        setPositions(data.positions ?? []); setUpdatedAt(data.updatedAt ?? null);
      } else setPositions([]);
      if (historyResponse.ok) {
        const data = await historyResponse.json() as HistoryResponse;
        setDeals(data.deals ?? []); setClosedPositions(data.positions ?? []); setInitialDeposit(typeof data.initialDeposit === "number" ? data.initialDeposit : null); setUpdatedAt(data.updatedAt ?? null);
      } else { setDeals([]); setClosedPositions([]); setInitialDeposit(null); }
    } catch {
      setHealth(OFFLINE); setPositions([]); setDeals([]); setClosedPositions([]); setInitialDeposit(null); setUpdatedAt(null);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void refresh(); const id = window.setInterval(() => void refresh(), refreshMs); return () => window.clearInterval(id); }, [refresh, refreshMs]);
  return { health, positions, deals, closedPositions, initialDeposit, updatedAt, loading, refresh };
}
