"use client";
import { LOCAL_MT5_RETIRED_MESSAGE } from "../lib/mt5-retirement";
export type Mt5Health = {
  connected: boolean; login?: number; server?: string; company?: string; balance?: number; equity?: number; currency?: string; error?: string;
};
export type Mt5Position = {
  ticket: string; positionId?: string; symbol: string; direction: "Long" | "Short"; volume: number; openPrice: number; currentPrice: number; stopLoss: number; takeProfit: number; profit: number; swap: number; openedAt: string;
};
export type Mt5Deal = {
  ticket: string; order?: string; positionId?: string; symbol: string; direction: "Long" | "Short"; volume: number; price: number; profit: number; commission?: number; swap?: number; time: string; entry?: "in" | "out" | "inout";
};
export type Mt5ClosedPosition = {
  positionId: string; ticket: string; symbol: string; direction: "Long" | "Short"; volume: number; entryPrice: number; exitPrice: number; stopLoss?: number | null; takeProfit?: number | null; openedAt: string; closedAt: string; grossPnl: number; commission: number; swap: number; netPnl: number; riskAmount?: number | null; riskPercent?: number | null; resultR?: number | null;
};
export type UseMt5Result = {
  health: Mt5Health; positions: Mt5Position[]; deals: Mt5Deal[]; closedPositions: Mt5ClosedPosition[]; initialDeposit: number | null; updatedAt: string | null; loading: boolean; refresh: () => Promise<void>;
};
const RETIRED: UseMt5Result = {
  health: { connected: false, error: LOCAL_MT5_RETIRED_MESSAGE }, positions: [], deals: [], closedPositions: [], initialDeposit: null, updatedAt: null, loading: false, refresh: () => Promise.resolve(),
};
/** Compatibility-only API. Local bridge transport and background polling are permanently retired. */
export function useMt5(refreshMs = 5000): UseMt5Result {
  void refreshMs;
  return RETIRED;
}
