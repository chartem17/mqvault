"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { initialTrades, type Trade } from "@/lib/trade-data";
import { initialAccounts, type TradingAccount } from "@/lib/account-data";
import type { Mt5ClosedPosition } from "@/hooks/use-mt5";

export type AccountFilter = "all" | string;
export type AccountTrade = Trade & { accountId: string; source?: "manual" | "mt5"; mt5DealTicket?: string; mt5PositionId?: string };
type NewTrade = Omit<AccountTrade, "id">;
type TradesContextValue = { trades: AccountTrade[]; visibleTrades: AccountTrade[]; accounts: TradingAccount[]; activeAccountId: AccountFilter; activeAccount: TradingAccount | null; includedAccountIds: string[]; setActiveAccountId: (id: AccountFilter) => void; toggleAccountIncluded: (id: string) => void; addTrade: (trade: NewTrade) => void; updateTrade: (trade: AccountTrade) => void; deleteTrade: (id: number) => void; addAccount: (account: TradingAccount) => void; upsertAccount: (account: TradingAccount) => void; updateAccount: (account: TradingAccount) => void; deleteAccount: (id: string) => void; syncMt5Positions: (accountId: string, positions: Mt5ClosedPosition[], initialDeposit?: number | null) => void };
const TradeCtx = createContext<TradesContextValue | null>(null);
const LS_KEYS = { accounts: "trade-vault:accounts", trades: "trade-vault:trades", active: "trade-vault:activeAccountId", included: "trade-vault:includedAccountIds" } as const;
function load<T>(key: string, fallback: T): T { if (typeof window === "undefined") return fallback; try { const raw = window.localStorage.getItem(key); return raw ? JSON.parse(raw) as T : fallback; } catch { return fallback; } }
function save<T>(key: string, value: T) { if (typeof window !== "undefined") { try { window.localStorage.setItem(key, JSON.stringify(value)); } catch {} } }
const seededTrades: AccountTrade[] = Array.isArray(initialTrades) ? initialTrades.map((trade) => ({ ...trade, accountId: "manual", source: "manual" })) : [];
function marketForSymbol(symbol: string) { const value = symbol.toUpperCase(); if (value.includes("BTC") || value.includes("ETH") || value.includes("USDT")) return "Crypto"; if (value.includes("XAU") || value.includes("XAG")) return "Commodities"; if (value.includes("US30") || value.includes("GER40") || value.includes("NAS")) return "Index"; return "Forex"; }
function toLocalParts(isoUtc: string) { const date = new Date(isoUtc); if (Number.isNaN(date.getTime())) return { date: "", time: "", session: "" }; const pad = (v: number) => String(v).padStart(2, "0"); const hour = date.getHours(); return { date: `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`, time: `${pad(hour)}:${pad(date.getMinutes())}`, session: hour < 8 ? "Asia" : hour < 13 ? "London" : "NY" }; }

export function TradeProvider({ children }: { children: ReactNode }) {
  const [accounts, setAccounts] = useState(initialAccounts); const [trades, setTrades] = useState(seededTrades); const [activeAccountId, setActiveAccountId] = useState<AccountFilter>("all"); const [includedAccountIds, setIncludedAccountIds] = useState(initialAccounts.map((account) => account.id)); const [hydrated, setHydrated] = useState(false);
  useEffect(() => { const storedAccounts = load(LS_KEYS.accounts, initialAccounts); setAccounts(storedAccounts); const storedTrades = load<unknown>(LS_KEYS.trades, seededTrades); setTrades(Array.isArray(storedTrades) ? storedTrades as AccountTrade[] : seededTrades); setActiveAccountId(load(LS_KEYS.active, "all")); setIncludedAccountIds(load(LS_KEYS.included, storedAccounts.map((account) => account.id))); setHydrated(true); }, []);
  useEffect(() => { if (hydrated) save(LS_KEYS.accounts, accounts); }, [accounts, hydrated]); useEffect(() => { if (hydrated) save(LS_KEYS.trades, trades); }, [trades, hydrated]); useEffect(() => { if (hydrated) save(LS_KEYS.active, activeAccountId); }, [activeAccountId, hydrated]); useEffect(() => { if (hydrated) save(LS_KEYS.included, includedAccountIds); }, [includedAccountIds, hydrated]);
  const addTrade = useCallback((trade: NewTrade) => setTrades((current) => [...current, { ...trade, id: current.reduce((max, item) => Math.max(max, item.id), 0) + 1, accountId: trade.accountId || (activeAccountId === "all" ? "manual" : activeAccountId), source: trade.source ?? "manual" }]), [activeAccountId]);
  const updateTrade = useCallback((trade: AccountTrade) => setTrades((current) => current.map((item) => item.id === trade.id ? trade : item)), []); const deleteTrade = useCallback((id: number) => setTrades((current) => current.filter((item) => item.id !== id)), []);
  const upsertAccount = useCallback((account: TradingAccount) => { setAccounts((current) => current.some((item) => item.id === account.id) ? current.map((item) => item.id === account.id ? { ...item, ...account } : item) : [...current, account]); setIncludedAccountIds((current) => current.includes(account.id) ? current : [...current, account.id]); }, []);
  const addAccount = useCallback((account: TradingAccount) => upsertAccount(account), [upsertAccount]); const updateAccount = useCallback((account: TradingAccount) => setAccounts((current) => current.map((item) => item.id === account.id ? account : item)), []);
  const deleteAccount = useCallback((id: string) => { if (id === "manual") return; setAccounts((current) => current.filter((item) => item.id !== id)); setTrades((current) => current.filter((trade) => trade.accountId !== id)); setIncludedAccountIds((current) => current.filter((item) => item !== id)); setActiveAccountId((current) => current === id ? "all" : current); }, []);
  const toggleAccountIncluded = useCallback((id: string) => { if (id === "manual") return; setIncludedAccountIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]); }, []);

  const syncMt5Positions = useCallback((accountId: string, positions: Mt5ClosedPosition[], initialDeposit?: number | null) => {
    setTrades((current) => {
      const byPosition = new Map(current.filter((trade) => trade.accountId === accountId && trade.mt5PositionId).map((trade) => [trade.mt5PositionId!, trade]));
      const result = [...current];
      let nextId = current.reduce((max, item) => Math.max(max, item.id), 0);
      for (const position of positions) {
        const opened = toLocalParts(position.openedAt);
        const existing = byPosition.get(position.positionId);
        if (existing) {
          const updated: AccountTrade = {
            ...existing,
            source: "mt5",
            mt5PositionId: position.positionId,
            mt5DealTicket: position.ticket,
            openedAtUtc: position.openedAt,
            closedAtUtc: position.closedAt,
            date: opened.date || existing.date,
            time: opened.time || existing.time,
            session: opened.session || existing.session,
            pair: position.symbol,
            market: marketForSymbol(position.symbol),
            direction: position.direction,
            entry: String(position.entryPrice),
            stop: position.stopLoss == null ? "" : String(position.stopLoss),
            tp: position.takeProfit == null ? "" : String(position.takeProfit),
            exit_price: String(position.exitPrice),
            risk_pct: position.riskPercent ?? existing.risk_pct ?? 0,
            result_usd: position.netPnl,
            result_r: position.resultR ?? existing.result_r ?? 0,
          };
          const index = result.findIndex((trade) => trade.id === existing.id);
          if (index >= 0) result[index] = updated;
          continue;
        }
        result.push({ id: ++nextId, accountId, source: "mt5", mt5PositionId: position.positionId, mt5DealTicket: position.ticket, openedAtUtc: position.openedAt, closedAtUtc: position.closedAt, date: opened.date, time: opened.time, pair: position.symbol, market: marketForSymbol(position.symbol), direction: position.direction, entry: String(position.entryPrice), stop: position.stopLoss == null ? "" : String(position.stopLoss), tp: position.takeProfit == null ? "" : String(position.takeProfit), exit_price: String(position.exitPrice), risk_pct: position.riskPercent ?? 0, result_usd: position.netPnl, result_r: position.resultR ?? 0, session: opened.session, setup: "MT5 import", htf_bias: "", entry_reason: "", exit_reason: "MT5 history", emotion: "", mistake: "", screenshot: "", notes: "" });
      }
      return result;
    });
    if (typeof initialDeposit === "number" && initialDeposit > 0) setAccounts((current) => current.map((account) => account.id === accountId && account.initialBalance <= 0 ? { ...account, initialBalance: initialDeposit } : account));
  }, []);

  const visibleTrades = useMemo(() => activeAccountId === "all" ? trades.filter((trade) => includedAccountIds.includes(trade.accountId)) : trades.filter((trade) => trade.accountId === activeAccountId), [trades, activeAccountId, includedAccountIds]);
  const activeAccount = useMemo(() => activeAccountId === "all" ? null : accounts.find((account) => account.id === activeAccountId) ?? null, [accounts, activeAccountId]);
  const value = { trades, visibleTrades, accounts, activeAccountId, activeAccount, includedAccountIds, setActiveAccountId, toggleAccountIncluded, addTrade, updateTrade, deleteTrade, addAccount, upsertAccount, updateAccount, deleteAccount, syncMt5Positions };
  return <TradeCtx.Provider value={value}>{children}</TradeCtx.Provider>;
}
export function useTrades() { const context = useContext(TradeCtx); if (!context) throw new Error("useTrades must be used within TradeProvider"); return context; }
