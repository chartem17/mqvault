"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  AccountKind,
  AccountPhase,
  AccountStatus,
  TradingAccount,
} from "@/lib/account-data";

export type AccountFilter = "all" | string;

type DbAccount = {
  id: string;
  name: string;
  broker?: string | null;
  platform: string;
  account_type: string;
  currency: string;
  mt5_login?: string | null;
  mt5_server?: string | null;
  initial_balance?: number | null;
  phase?: string | null;
  target_percent?: number | null;
  max_loss_percent?: number | null;
  daily_loss_percent?: number | null;
  is_active: boolean;
  status: string;
  color?: string | null;
  parent_account_id?: string | null;
};

export type JournalTrade = {
  id: string;
  account_id: string;
  source?: "manual" | "mt5" | "exchange" | "import" | string | null;
  external_id?: string | null;

  opened_at: string;
  closed_at?: string | null;

  symbol: string;
  market?: string | null;
  direction: "Long" | "Short" | string;

  entry_price: string | null;
  exit_price: string | null;
  stop_loss?: string | null;
  take_profit?: string | null;
  volume?: number | null;

  risk_percent?: number | null;
  risk_amount?: number | null;
  gross_pnl?: number | null;
  commission?: number | null;
  swap?: number | null;
  fee?: number | null;
  net_pnl?: number | null;
  result_r?: number | null;

  session?: string | null;
  setup?: string | null;
  htf_bias?: string | null;
  entry_reason?: string | null;
  exit_reason?: string | null;
  emotion?: string | null;
  mistake?: string | null;
  screenshot_url?: string | null;
  notes?: string | null;
};

export type TradeInput = Partial<Omit<JournalTrade, "id">>;
export type UpdateTradeInput = TradeInput & { id: string };

export type AccountInput = {
  id?: string;
  name: string;
  broker?: string;
  platform: "manual" | "mt5";
  source: "manual" | "mt5";
  kind: AccountKind;
  currency: "USD" | "USDT";
  initialBalance: number;
  phase?: AccountPhase;
  status?: AccountStatus;
  mt5Login?: string;
  mt5Server?: string;
  color?: string;
  targetPercent?: number;
  maxLossPercent?: number;
  dailyLossPercent?: number;
  parentAccountId?: string;
};

const PROP_PHASES: AccountPhase[] = ["phase-1", "phase-2", "funded"];
const STATUSES: AccountStatus[] = ["active", "passed", "failed", "archived"];
const PALETTE = ["#7c8cff", "#76d05a", "#e9ae5b", "#5bc0de", "#d96b8a"];

const ACTIVE_ACCOUNT_STORAGE_KEY = "dashboard.activeAccountId";
const INCLUDED_ACCOUNTS_STORAGE_KEY = "dashboard.includedAccountIds";

function inferKind(account: DbAccount): AccountKind {
  if (account.platform === "mt5") return "mt5_bridge";
  return "manual";
}

function toTradingAccount(a: DbAccount, index: number): TradingAccount {
  const platform = a.platform === "mt5" ? "mt5" : "manual";
  const isProp = a.account_type === "prop";

  return {
    id: a.id,
    name: a.name,
    broker: a.broker ?? "",
    platform,
    source: platform,
    kind: inferKind(a),
    currency: a.currency === "USDT" ? "USDT" : "USD",
    initialBalance: Number(a.initial_balance ?? 0),
    phase:
      isProp && PROP_PHASES.includes(a.phase as AccountPhase)
        ? (a.phase as AccountPhase)
        : "manual",
    targetPercent: a.target_percent ?? undefined,
    maxLossPercent: a.max_loss_percent ?? undefined,
    dailyLossPercent: a.daily_loss_percent ?? undefined,
    status: STATUSES.includes(a.status as AccountStatus)
      ? (a.status as AccountStatus)
      : "active",
    mt5Login: a.mt5_login ?? undefined,
    mt5Server: a.mt5_server ?? undefined,
    color: a.color || PALETTE[index % PALETTE.length],
  };
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const base = payload.error || `Request failed (${response.status})`;
    throw new Error(payload.detail ? `${base}: ${payload.detail}` : base);
  }

  return payload as T;
}

function readStoredActiveAccount(): AccountFilter {
  if (typeof window === "undefined") return "all";
  const value = window.localStorage.getItem(ACTIVE_ACCOUNT_STORAGE_KEY);
  return value && value.trim() ? value : "all";
}

function readStoredIncludedAccounts(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(INCLUDED_ACCOUNTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === "string")
      : [];
  } catch {
    return [];
  }
}

export function useTrades() {
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [trades, setTrades] = useState<JournalTrade[]>([]);
  const [activeAccountId, setActiveAccountId] = useState<AccountFilter>(() =>
    readStoredActiveAccount(),
  );
  const [includedAccountIds, setIncludedAccountIds] = useState<string[]>(() =>
    readStoredIncludedAccounts(),
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (initial: boolean) => {
    try {
      if (initial) setLoading(true);
      else setRefreshing(true);
      setError(null);

      const [accountsRes, tradesRes] = await Promise.all([
        api<{ data: DbAccount[] }>("/api/accounts"),
        api<{ data: JournalTrade[] }>("/api/journal/trades"),
      ]);

      const mapped = (accountsRes.data ?? []).map(toTradingAccount);
      setAccounts(mapped);
      setTrades(tradesRes.data ?? []);

      setIncludedAccountIds((current) => {
        const validCurrent = current.filter((id) =>
          mapped.some((account) => account.id === id),
        );

        if (validCurrent.length) return validCurrent;
        return mapped.map((account) => account.id);
      });

      setActiveAccountId((current) => {
        if (current === "all") return "all";
        return mapped.some((account) => account.id === current)
          ? current
          : "all";
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load(true);
  }, [load]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(ACTIVE_ACCOUNT_STORAGE_KEY, activeAccountId);
  }, [activeAccountId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      INCLUDED_ACCOUNTS_STORAGE_KEY,
      JSON.stringify(includedAccountIds),
    );
  }, [includedAccountIds]);

  useEffect(() => {
    if (!accounts.length) return;

    if (
      activeAccountId !== "all" &&
      !accounts.some((account) => account.id === activeAccountId)
    ) {
      setActiveAccountId("all");
    }
  }, [accounts, activeAccountId]);

  useEffect(() => {
    if (!accounts.length) return;

    setIncludedAccountIds((current) => {
      const valid = current.filter((id) =>
        accounts.some((account) => account.id === id),
      );
      return valid.length ? valid : accounts.map((account) => account.id);
    });
  }, [accounts]);

  const refreshTrades = useCallback(() => load(false), [load]);

  const createTrade = useCallback(async (input: TradeInput) => {
    try {
      setSaving(true);
      setError(null);

      const res = await api<{ data: JournalTrade }>("/api/journal/trades", {
        method: "POST",
        body: JSON.stringify(input),
      });

      setTrades((current) => [res.data, ...current]);
      return res.data;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create trade");
      throw err;
    } finally {
      setSaving(false);
    }
  }, []);

  const updateTrade = useCallback(async (input: UpdateTradeInput) => {
    try {
      setSaving(true);
      setError(null);

      const res = await api<{ data: JournalTrade }>("/api/journal/trades", {
        method: "PATCH",
        body: JSON.stringify(input),
      });

      setTrades((current) =>
        current.map((trade) => (trade.id === res.data.id ? res.data : trade)),
      );

      return res.data;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update trade");
      throw err;
    } finally {
      setSaving(false);
    }
  }, []);

  const deleteTrade = useCallback(async (id: string) => {
    try {
      setSaving(true);
      setError(null);

      await api<{ success: boolean }>("/api/journal/trades", {
        method: "DELETE",
        body: JSON.stringify({ id }),
      });

      setTrades((current) => current.filter((trade) => trade.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete trade");
      throw err;
    } finally {
      setSaving(false);
    }
  }, []);

  const upsertAccount = useCallback(
    async (input: AccountInput) => {
      try {
        setSaving(true);
        setError(null);

        const method = input.id ? "PATCH" : "POST";
        const payload = {
          id: input.id,
          name: input.name,
          broker: input.broker ?? null,
          platform: input.platform,
          account_type: input.platform === "mt5" ? "prop" : "personal",
          currency: input.currency,
          initialBalance: input.initialBalance,
          phase: input.phase ?? (input.platform === "mt5" ? "phase-1" : null),
          status: input.status ?? "active",
          mt5Login: input.mt5Login,
          mt5Server: input.mt5Server,
          color: input.color,
          targetPercent: input.targetPercent,
          maxLossPercent: input.maxLossPercent,
          dailyLossPercent: input.dailyLossPercent,
          parentAccountId: input.parentAccountId,
        };

        const res = await api<{ data: DbAccount }>("/api/accounts", {
          method,
          body: JSON.stringify(payload),
        });

        const mapped = toTradingAccount(res.data, accounts.length);

        setAccounts((current) => {
          const exists = current.some((account) => account.id === mapped.id);
          return exists
            ? current.map((account) =>
                account.id === mapped.id ? mapped : account,
              )
            : [...current, mapped];
        });

        setIncludedAccountIds((current) =>
          current.includes(mapped.id) ? current : [...current, mapped.id],
        );

        return mapped;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save account");
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [accounts.length],
  );

  const deleteAccount = useCallback(async (id: string) => {
    try {
      setSaving(true);
      setError(null);

      await api<{ success: boolean }>("/api/accounts", {
        method: "DELETE",
        body: JSON.stringify({ id }),
      });

      setAccounts((current) => current.filter((account) => account.id !== id));
      setIncludedAccountIds((current) => current.filter((item) => item !== id));
      setTrades((current) =>
        current.filter((trade) => trade.account_id !== id),
      );
      setActiveAccountId((current) => (current === id ? "all" : current));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete account");
      throw err;
    } finally {
      setSaving(false);
    }
  }, []);

  const visibleTrades = useMemo(() => {
    if (activeAccountId === "all") {
      return trades.filter((trade) =>
        includedAccountIds.includes(trade.account_id),
      );
    }

    return trades.filter((trade) => trade.account_id === activeAccountId);
  }, [trades, activeAccountId, includedAccountIds]);

  const activeAccount = useMemo(() => {
    if (activeAccountId === "all") return null;
    return accounts.find((account) => account.id === activeAccountId) ?? null;
  }, [accounts, activeAccountId]);

  const toggleAccountIncluded = useCallback((id: string) => {
    setIncludedAccountIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  }, []);

  return {
    trades,
    visibleTrades,
    accounts,
    activeAccountId,
    activeAccount,
    includedAccountIds,
    loading,
    refreshing,
    saving,
    error,
    setActiveAccountId,
    toggleAccountIncluded,
    refreshTrades,
    createTrade,
    updateTrade,
    deleteTrade,
    upsertAccount,
    deleteAccount,
  };
}
