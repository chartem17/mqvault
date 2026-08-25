"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { initialTrades, type Trade } from "@/lib/trade-data";
import { initialAccounts, type TradingAccount } from "@/lib/account-data";
import type { Mt5ClosedPosition } from "@/hooks/use-mt5";

export type AccountFilter = "all" | string;
export type AccountTrade = Trade & { accountId: string; source?: "manual" | "mt5"; mt5DealTicket?: string; mt5PositionId?: string };
type NewTrade = Omit<AccountTrade, "id">;

type TradesContextValue = {
  trades: AccountTrade[]; visibleTrades: AccountTrade[]; accounts: TradingAccount[]; activeAccountId: AccountFilter; activeAccount: TradingAccount | null; includedAccountIds: string[];
  setActiveAccountId: (id: AccountFilter) => void; toggleAccountIncluded: (id: string) => void; addTrade: (trade: NewTrade) => void; updateTrade: (trade: AccountTrade) => void; deleteTrade: (id: number) => void;
  addAccount: (account: TradingAccount) => void; upsertAccount: (account: TradingAccount) => void; updateAccount: (account: TradingAccount) => void; deleteAccount: (id: string) => void;
  syncMt5Positions: (accountId: string, positions: Mt5ClosedPosition[], initialDeposit?: number | null) => void;
};

const TradeCtx = createContext<TradesContextValue | null>(null);
const LS_KEYS = { accounts: "trade-vault:accounts", trades: "trade-vault:trades", active: "trade-vault:activeAccountId", included: "trade-vault:includedAccountIds" } as const;
function load<T>(key: string, fallback: T): T { if (typeof window === "undefined") return fallback; try { const raw = window.localStorage.getItem(key); return raw ? JSON.parse(raw) as T : fallback; } catch { return fallback; } }
function save<T>(key: string, value: T) { if (typeof window !== "undefined") { try { window.localStorage.setItem(key, JSON.stringify(value)); } catch {} } }
const seededTrades: AccountTrade[] = initialTrades.map((trade) => ({ ...trade, accountId: "manual", source: "manual" }));
function marketForSymbol(symbol: string) { const value = symbol.toUpperCase(); if (value.includes("BTC") || value.includes("ETH") || value.includes("USDT")) return "Crypto"; if (value.includes("XAU") || value.includes("XAG")) return "Commodities"; if (value.includes("US30") || value.includes("GER40") || value.includes("NAS")) return "Index"; return "Forex"; }
function sessionForDate(date: Date) { const hour = date.getUTCHours(); return hour < 8 ? "Asia" : hour < 13 ? "London" : "NY"; }

export function TradeProvider({ children }: { children: ReactNode }) {
  const [accounts, setAccounts] = useState(initialAccounts); const [trades, setTrades] = useState<AccountTrade[]>(seededTrades); const [activeAccountId, setActiveAccountId] = useState<AccountFilter>("all"); const [includedAccountIds, setIncludedAccountIds] = useState(initialAccounts.map((account) => account.id)); const [hydrated, setHydrated] = useState(false);
  useEffect(() => { const storedAccounts = load(LS_KEYS.accounts, initialAccounts); setAccounts(storedAccounts); setTrades(load(LS_KEYS.trades, seededTrades)); setActiveAccountId(load<AccountFilter>(LS_KEYS.active, "all")); setIncludedAccountIds(load(LS_KEYS.included, storedAccounts.map((account) => account.id))); setHydrated(true); }, []);
  useEffect(() => { if (hydrated) save(LS_KEYS.accounts, accounts); }, [accounts, hydrated]); useEffect(() => { if (hydrated) save(LS_KEYS.trades, trades); }, [trades, hydrated]); useEffect(() => { if (hydrated) save(LS_KEYS.active, activeAccountId); }, [activeAccountId, hydrated]); useEffect(() => { if (hydrated) save(LS_KEYS.included, includedAccountIds); }, [includedAccountIds, hydrated]);
  const addTrade = useCallback((trade: NewTrade) => setTrades((current) => [...current, { ...trade, id: current.reduce((max, item) => Math.max(max, item.id), 0) + 1, accountId: trade.accountId || (activeAccountId === "all" ? "manual" : activeAccountId), source: trade.source ?? "manual" }]), [activeAccountId]);
  const updateTrade = useCallback((trade: AccountTrade) => setTrades((current) => current.map((item) => item.id === trade.id ? trade : item)), []); const deleteTrade = useCallback((id: number) => setTrades((current) => current.filter((item) => item.id !== id)), []);
  const upsertAccount = useCallback((account: TradingAccount) => { setAccounts((current) => current.some((item) => item.id === account.id) ? current.map((item) => item.id === account.id ? { ...item, ...account } : item) : [...current, account]); setIncludedAccountIds((current) => current.includes(account.id) ? current : [...current, account.id]); }, []);
  const addAccount = useCallback((account: TradingAccount) => upsertAccount(account), [upsertAccount]); const updateAccount = useCallback((account: TradingAccount) => setAccounts((current) => current.map((item) => item.id === account.id ? account : item)), []);
  const deleteAccount = useCallback((id: string) => { if (id === "manual") return; setAccounts((current) => current.filter((item) => item.id !== id)); setTrades((current) => current.filter((trade) => trade.accountId !== id)); setIncludedAccountIds((current) => current.filter((item) => item !== id)); setActiveAccountId((current) => current === id ? "all" : current); }, []);
  const toggleAccountIncluded = useCallback((id: string) => { if (id === "manual") return; setIncludedAccountIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]); }, []);

  const syncMt5Positions = useCallback((accountId: string, positions: Mt5ClosedPosition[], initialDeposit?: number | null) => {
    setTrades((current) => {
      const known = new Set(current.filter((trade) => trade.accountId === accountId && trade.mt5PositionId).map((trade) => trade.mt5PositionId));
      const baseId = current.reduce((max, item) => Math.max(max, item.id), 0);
      const imported = positions.filter((position) => !known.has(position.positionId)).map((position, index) => {
        const opened = new Date(position.openedAt); const closed = new Date(position.closedAt); const validOpened = !Number.isNaN(opened.getTime()); const netPnl = position.netPnl;
        return { id: baseId + index + 1, accountId, source: "mt5" as const, mt5PositionId: position.positionId, mt5DealTicket: position.ticket, date: validOpened ? opened.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10), time: validOpened ? opened.toISOString().slice(11, 16) : "00:00", pair: position.symbol, market: marketForSymbol(position.symbol), direction: position.direction, entry: String(position.entryPrice), stop: position.stopLoss == null ? "" : String(position.stopLoss), tp: position.takeProfit == null ? "" : String(position.takeProfit), exit_price: String(position.exitPrice), risk_pct: position.riskPercent ?? 0, result_usd: netPnl, result_r: position.resultR ?? 0, session: validOpened ? sessionForDate(opened) : "", setup: "MT5 import", htf_bias: "", entry_reason: "", exit_reason: "MT5 history", emotion: "", mistake: "", screenshot: "", notes: `MT5 position ${position.positionId}${!Number.isNaN(closed.getTime()) ? ` · closed ${closed.toISOString()}` : ""}` };
      });
      return imported.length ? [...current, ...imported] : current;
    });
    if (typeof initialDeposit === "number" && initialDeposit > 0) setAccounts((current) => current.map((account) => account.id === accountId && account.initialBalance <= 0 ? { ...account, initialBalance: initialDeposit } : account));
  }, []);

  useEffect(() => {
    const account = accounts.find((item) => item.source === "mt5" && item.mt5Login); if (!account) return; let cancelled = false;
    Promise.all([fetch("/api/mt5/history", { cache: "no-store" }), fetch("/api/mt5/health", { cache: "no-store" })]).then(async ([historyResponse, healthResponse]) => { if (cancelled || !historyResponse.ok || !healthResponse.ok) return; const history = await historyResponse.json() as { positions?: Mt5ClosedPosition[]; initialDeposit?: number | null }; const health = await healthResponse.json() as { login?: number }; if (!cancelled && String(health.login ?? "") === account.mt5Login) syncMt5Positions(account.id, history.positions ?? [], history.initialDeposit); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [accounts, syncMt5Positions]);
  const visibleTrades = useMemo(() => activeAccountId === "all" ? trades.filter((trade) => includedAccountIds.includes(trade.accountId)) : trades.filter((trade) => trade.accountId === activeAccountId), [trades, activeAccountId, includedAccountIds]); const activeAccount = useMemo(() => activeAccountId === "all" ? null : accounts.find((account) => account.id === activeAccountId) ?? null, [accounts, activeAccountId]);
  return <TradeCtx.Provider value={{ trades, visibleTrades, accounts, activeAccountId, activeAccount, includedAccountIds, setActiveAccountId, toggleAccountIncluded, addTrade, updateTrade, deleteTrade, addAccount, upsertAccount, updateAccount, deleteAccount, syncMt5Positions }}>{children}</TradeCtx.Provider>;
}
export function useTrades() { const context = useContext(TradeCtx); if (!context) throw new Error("useTrades must be used within TradeProvider"); return context; }
