"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { AccountKind, AccountPhase, AccountStatus, AccountType, TradingAccount } from "@/lib/account-data";
import { useUndo } from "@/components/ui/undo-toast";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export type AccountFilter = "all" | string;
type DbAccount = { id: string; name: string; broker?: string | null; platform: string; account_type: string; currency: string; mt5_login?: string | null; mt5_server?: string | null; initial_balance?: number | null; phase?: string | null; target_percent?: number | null; max_loss_percent?: number | null; daily_loss_percent?: number | null; min_trading_days?: number | null; is_active: boolean; status: string; color?: string | null; parent_account_id?: string | null };
export type JournalTrade = {
  id: string; account_id: string; source?: "manual" | "mt5" | "exchange" | "import" | string | null; external_id?: string | null; opened_at: string; closed_at?: string | null; symbol: string; market?: string | null; direction: "Long" | "Short" | string;
  entry_price: string | null; exit_price: string | null; stop_loss?: string | null; take_profit?: string | null; volume?: number | null; risk_percent?: number | null; risk_amount?: number | null; gross_pnl?: number | null; commission?: number | null; swap?: number | null; fee?: number | null; net_pnl?: number | null; result_r?: number | null; session?: string | null; setup?: string | null; htf_bias?: string | null; entry_reason?: string | null; exit_reason?: string | null; emotion?: string | null; mistake?: string | null; screenshot_url?: string | null; notes?: string | null;
};
export type TradeInput = Partial<Omit<JournalTrade, "id">>;
export type UpdateTradeInput = TradeInput & { id: string };
export type AccountInput = { id?: string; accountType?: AccountType; name: string; broker?: string; platform: "manual" | "mt5"; source: "manual" | "mt5"; kind: AccountKind; currency: "USD" | "USDT"; initialBalance: number; phase?: AccountPhase | null; status?: AccountStatus; mt5Login?: string; mt5Server?: string; color?: string; targetPercent?: number | null; maxLossPercent?: number | null; dailyLossPercent?: number | null; minTradingDays?: number | null; parentAccountId?: string };
const PROP_PHASES: AccountPhase[] = ["phase-1", "phase-2", "phase-3", "funded"];
const STATUSES: AccountStatus[] = ["active", "passed", "failed", "archived"];
const PALETTE = ["#7c8cff", "#76d05a", "#e9ae5b", "#5bc0de", "#d96b8a"];
const ACTIVE_KEY = "dashboard.activeAccountId";
const INCLUDED_KEY = "dashboard.includedAccountIds";
function toTradingAccount(a: DbAccount, index: number): TradingAccount {
  const platform = a.platform === "mt5" ? "mt5" : "manual";
  return { id: a.id, accountType: a.account_type === "prop" ? "prop" : "personal", minTradingDays: a.min_trading_days ?? undefined, name: a.name, broker: a.broker ?? "", platform, source: platform, kind: platform === "mt5" ? "mt5_bridge" : "manual", currency: a.currency === "USDT" ? "USDT" : "USD", initialBalance: Number(a.initial_balance ?? 0), phase: a.account_type === "prop" && PROP_PHASES.includes(a.phase as AccountPhase) ? a.phase as AccountPhase : "manual", targetPercent: a.target_percent ?? undefined, maxLossPercent: a.max_loss_percent ?? undefined, dailyLossPercent: a.daily_loss_percent ?? undefined, status: STATUSES.includes(a.status as AccountStatus) ? a.status as AccountStatus : "active", mt5Login: a.mt5_login ?? undefined, mt5Server: a.mt5_server ?? undefined, color: a.color || PALETTE[index % PALETTE.length] };
}
async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) { const base = payload.error || `Request failed (${response.status})`; throw new Error(payload.detail ? `${base}: ${payload.detail}` : base); }
  return payload as T;
}
function readActive(): AccountFilter { try { return typeof window === "undefined" ? "all" : window.localStorage.getItem(ACTIVE_KEY)?.trim() || "all"; } catch { return "all"; } }
function readIncluded(): string[] { try { const parsed: unknown = JSON.parse(typeof window === "undefined" ? "[]" : window.localStorage.getItem(INCLUDED_KEY) || "[]"); return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : []; } catch { return []; } }
function useTradesState() {
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [trades, setTrades] = useState<JournalTrade[]>([]);
  const [activeAccountId, setActiveAccountId] = useState<AccountFilter>(readActive);
  const [includedAccountIds, setIncludedAccountIds] = useState<string[]>(readIncluded);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async (initial: boolean) => {
    try {
      if (initial) setLoading(true); else setRefreshing(true);
      setError(null);
      const [accountsRes, tradesRes] = await Promise.all([api<{ data: DbAccount[] }>("/api/accounts"), api<{ data: JournalTrade[] }>("/api/journal/trades")]);
      const mapped = (accountsRes.data ?? []).map(toTradingAccount);
      setAccounts(mapped); setTrades(tradesRes.data ?? []);
      setIncludedAccountIds(current => { const valid = current.filter(id => mapped.some(account => account.id === id)); return valid.length ? valid : mapped.map(account => account.id); });
      setActiveAccountId(current => current === "all" || mapped.some(account => account.id === current) ? current : "all");
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to load data"); } finally { setLoading(false); setRefreshing(false); }
  }, []);
  useEffect(() => { void load(true); }, [load]);
  useEffect(() => { try { window.localStorage.setItem(ACTIVE_KEY, activeAccountId); } catch { /* Storage may be unavailable. */ } }, [activeAccountId]);
  useEffect(() => { try { window.localStorage.setItem(INCLUDED_KEY, JSON.stringify(includedAccountIds)); } catch { /* Storage may be unavailable. */ } }, [includedAccountIds]);
  useEffect(() => { if (accounts.length && activeAccountId !== "all" && !accounts.some(account => account.id === activeAccountId)) setActiveAccountId("all"); }, [accounts, activeAccountId]);
  useEffect(() => { if (!accounts.length) return; setIncludedAccountIds(current => { const valid = current.filter(id => accounts.some(account => account.id === id)); return valid.length ? valid : accounts.map(account => account.id); }); }, [accounts]);
  const refreshTrades = useCallback(() => load(false), [load]);
  const createTrade = useCallback(async (input: TradeInput) => {
    try { setSaving(true); setError(null); const res = await api<{ data: JournalTrade }>("/api/journal/trades", { method: "POST", body: JSON.stringify(input) }); setTrades(current => [res.data, ...current]); return res.data; }
    catch (err) { setError(err instanceof Error ? err.message : "Failed to create trade"); throw err; } finally { setSaving(false); }
  }, []);
  const updateTrade = useCallback(async (input: UpdateTradeInput) => {
    try { setSaving(true); setError(null); const res = await api<{ data: JournalTrade }>("/api/journal/trades", { method: "PATCH", body: JSON.stringify(input) }); setTrades(current => current.map(trade => trade.id === res.data.id ? res.data : trade)); return res.data; }
    catch (err) { setError(err instanceof Error ? err.message : "Failed to update trade"); throw err; } finally { setSaving(false); }
  }, []);
  const deleteTrade = useCallback(async (id: string) => {
    try { setSaving(true); setError(null); const res = await api<{ success: boolean }>("/api/journal/trades", { method: "DELETE", body: JSON.stringify({ id }) }); if (res.success !== true) throw new Error("Trade deletion was not confirmed"); setTrades(current => current.filter(trade => trade.id !== id)); }
    catch (err) { setError(err instanceof Error ? err.message : "Failed to delete trade"); throw err; } finally { setSaving(false); }
  }, []);
  const upsertAccount = useCallback(async (input: AccountInput) => {
    try {
      setSaving(true); setError(null);
      const payload = { id: input.id, name: input.name, broker: input.broker, platform: input.platform, account_type: input.accountType, currency: input.currency, initialBalance: input.initialBalance, phase: input.phase, status: input.status, mt5Login: input.mt5Login, mt5Server: input.mt5Server, color: input.color, targetPercent: input.targetPercent, maxLossPercent: input.maxLossPercent, dailyLossPercent: input.dailyLossPercent, minTradingDays: input.minTradingDays, parentAccountId: input.parentAccountId };
      const res = await api<{ data: DbAccount }>("/api/accounts", { method: input.id ? "PATCH" : "POST", body: JSON.stringify(payload) });
      const mapped = toTradingAccount(res.data, accounts.length);
      setAccounts(current => current.some(account => account.id === mapped.id) ? current.map(account => account.id === mapped.id ? mapped : account) : [...current, mapped]);
      setIncludedAccountIds(current => current.includes(mapped.id) ? current : [...current, mapped.id]); return mapped;
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to save account"); throw err; } finally { setSaving(false); }
  }, [accounts.length]);
  const deleteAccount = useCallback(async (id: string) => {
    try {
      setSaving(true); setError(null); const res = await api<{ success: boolean }>("/api/accounts", { method: "DELETE", body: JSON.stringify({ id }) }); if (res.success !== true) throw new Error("Account deletion was not confirmed");
      setAccounts(current => current.filter(account => account.id !== id)); setIncludedAccountIds(current => current.filter(item => item !== id)); setTrades(current => current.filter(trade => trade.account_id !== id)); setActiveAccountId(current => current === id ? "all" : current);
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to delete account"); throw err; } finally { setSaving(false); }
  }, []);
  const visibleTrades = useMemo(() => trades.filter(trade => activeAccountId === "all" ? includedAccountIds.includes(trade.account_id) : trade.account_id === activeAccountId), [trades, activeAccountId, includedAccountIds]);
  const activeAccount = useMemo(() => activeAccountId === "all" ? null : accounts.find(account => account.id === activeAccountId) ?? null, [accounts, activeAccountId]);
  const toggleAccountIncluded = useCallback((id: string) => setIncludedAccountIds(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]), []);
  return { trades, visibleTrades, accounts, activeAccountId, activeAccount, includedAccountIds, loading, refreshing, saving, error, setActiveAccountId, toggleAccountIncluded, refreshTrades, createTrade, updateTrade, deleteTrade, upsertAccount, deleteAccount };
}

type TradesContextValue = ReturnType<typeof useTradesState>;
const TradesContext = createContext<TradesContextValue | null>(null);

export function TradesProvider({ children }: { children: ReactNode }) {
  const base = useTradesState();
  const { notify } = useUndo();
  const [hiddenTrades, setHiddenTrades] = useState<Set<string>>(() => new Set());
  const [hiddenAccounts, setHiddenAccounts] = useState<Set<string>>(() => new Set());
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const locks = useRef(new Set<string>());
  function revealTrade(id: string, key: string) { setHiddenTrades(current => { const next = new Set(current); next.delete(id); return next; }); locks.current.delete(key); }
  function revealAccount(id: string) { setHiddenAccounts(current => { const next = new Set(current); next.delete(id); return next; }); locks.current.delete(`account:${id}`); }
  async function deleteTrade(id: string) {
    const trade = base.trades.find(item => item.id === id);
    if (!trade) return;
    const key = `trade:${trade.account_id}:${id}`;
    if (locks.current.has(key) || locks.current.has(`account:${trade.account_id}`) || hiddenTrades.has(id) || hiddenAccounts.has(trade.account_id)) return;
    locks.current.add(key);
    const date = new Date(trade.opened_at).toLocaleString("uk-UA", { timeZone: "Europe/Kyiv" });
    const accepted = notify({ key, message: `Позицію ${trade.symbol} · ${date} видалено`, duration: 10000, onUndo: () => { revealTrade(id, key); void base.refreshTrades(); }, onCommit: async () => { await base.deleteTrade(id); locks.current.delete(key); } });
    if (accepted) setHiddenTrades(current => new Set(current).add(id)); else locks.current.delete(key);
  }
  async function deleteAccount(id: string) { if (!locks.current.has(`account:${id}`) && !hiddenAccounts.has(id) && base.accounts.some(account => account.id === id)) setConfirmId(id); }
  const hasPendingTrades = confirmId !== null && [...locks.current].some(key => key.startsWith(`trade:${confirmId}:`));
  function confirmDelete() {
    const id = confirmId;
    const account = base.accounts.find(item => item.id === id);
    if (!id || !account || hasPendingTrades || locks.current.has(`account:${id}`)) return;
    setConfirmId(null);
    const key = `account:${id}`; locks.current.add(key);
    const accepted = notify({ key, message: `Рахунок «${account.name}» видалено`, duration: 10000, onUndo: () => { revealAccount(id); void base.refreshTrades(); }, onCommit: async () => { await base.deleteAccount(id); locks.current.delete(key); } });
    if (accepted) setHiddenAccounts(current => new Set(current).add(id)); else locks.current.delete(key);
  }
  const accounts = base.accounts.filter(account => !hiddenAccounts.has(account.id));
  const accountIds = new Set(accounts.map(account => account.id));
  const trades = base.trades.filter(trade => accountIds.has(trade.account_id) && !hiddenTrades.has(trade.id));
  const activeAccountId = hiddenAccounts.has(base.activeAccountId) ? "all" : base.activeAccountId;
  const includedAccountIds = base.includedAccountIds.filter(id => accountIds.has(id));
  const visibleTrades = trades.filter(trade => activeAccountId === "all" ? includedAccountIds.includes(trade.account_id) : trade.account_id === activeAccountId);
  const activeAccount = activeAccountId === "all" ? null : accounts.find(account => account.id === activeAccountId) ?? null;
  const pendingAccount = base.accounts.find(account => account.id === confirmId);
  const count = base.trades.filter(trade => trade.account_id === confirmId).length;
  return <TradesContext.Provider value={{ ...base, accounts, trades, visibleTrades, activeAccountId, activeAccount, includedAccountIds, deleteTrade, deleteAccount }}>
    {children}
    <ConfirmDialog open={Boolean(pendingAccount)} title={`Видалити рахунок «${pendingAccount?.name ?? ""}»?`} description={hasPendingTrades ? "Спочатку скасуйте або дочекайтеся завершення видалення окремих угод цього рахунку. Потім натисніть Видалити знову." : `Рахунок і ${count} угод зникнуть з дашборда. Після підтвердження буде 10 секунд, щоб скасувати. Перезавантаження до завершення таймера скасує відкладений запит.`} onCancel={() => setConfirmId(null)} onConfirm={confirmDelete} />
  </TradesContext.Provider>;
}

export function useTrades(): TradesContextValue { const context = useContext(TradesContext); if (!context) throw new Error("useTrades must be used within TradesProvider"); return context; }
