"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTrades } from "@/hooks/use-trades";
import { useUndo } from "@/components/ui/undo-toast";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { isRecord, STRATEGY_UUID, toStrategyProfile, type StoredStrategy } from "@/lib/strategy-control/strategy-storage";
import type { StrategyProfile } from "@/lib/strategy-control/types";

type AccountStrategy = StrategyProfile & { accountId: string };
async function requestJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", credentials: "same-origin", ...options, headers: { "Content-Type": "application/json", ...options?.headers } });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new Error(isRecord(payload) && typeof payload.error === "string" ? payload.error : `Request failed (${response.status})`);
  if (!isRecord(payload)) throw new Error("Invalid strategy response");
  return payload as T;
}
function profileFromRow(row: StoredStrategy): AccountStrategy {
  if (!STRATEGY_UUID.test(row.account_id)) throw new Error("Invalid strategy account");
  return { ...toStrategyProfile(row), accountId: row.account_id };
}

export function useStrategies() {
  const { activeAccountId, accounts } = useTrades();
  const { notify } = useUndo();
  const [records, setRecords] = useState<AccountStrategy[]>([]);
  const [selection, setSelection] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const [pending, setPending] = useState<AccountStrategy | null>(null);
  const currentAccount = useRef(activeAccountId);
  const mounted = useRef(true);
  const generation = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const writeBusy = useRef(false);
  const deletionIds = useRef(new Set<string>());

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; generation.current++; controller.current?.abort(); };
  }, []);
  const reload = useCallback(async () => {
    const ticket = ++generation.current;
    const accountId = currentAccount.current;
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    if (mounted.current) { setLoading(true); setError(null); }
    try {
      const result = await requestJson<{ strategies: StoredStrategy[] }>(`/api/strategies?accountId=${encodeURIComponent(accountId)}`, { signal: abort.signal });
      if (!Array.isArray(result.strategies)) throw new Error("Invalid strategy list");
      const next = result.strategies.map(profileFromRow);
      if (mounted.current && ticket === generation.current && accountId === currentAccount.current) setRecords(next);
    } catch (cause) {
      if (cause instanceof Error && cause.name === "AbortError") return;
      if (mounted.current && ticket === generation.current) setError(cause instanceof Error ? cause.message : "Не вдалося завантажити стратегії");
    } finally { if (mounted.current && ticket === generation.current) setLoading(false); }
  }, []);
  useEffect(() => {
    currentAccount.current = activeAccountId;
    setRecords([]); setPending(null);
    void reload();
  }, [activeAccountId, reload]);

  const accountIds = new Set(accounts.map(account => account.id));
  const strategies = records.filter(strategy => accountIds.has(strategy.accountId) && !hidden.has(strategy.id));
  const selectedStrategyId = strategies.some(strategy => strategy.id === selection) ? selection : strategies[0]?.id ?? "";
  const activeStrategy = strategies.find(strategy => strategy.id === selectedStrategyId) ?? null;
  const canCreate = activeAccountId !== "all" && accountIds.has(activeAccountId);

  async function createStrategy(profile: StrategyProfile, sourceId?: string): Promise<AccountStrategy> {
    const accountId = currentAccount.current;
    if (accountId === "all" || !STRATEGY_UUID.test(accountId) || !accounts.some(account => account.id === accountId)) {
      const message = "Виберіть конкретний рахунок перед збереженням стратегії";
      setError(message); throw new Error(message);
    }
    if (writeBusy.current) throw new Error("Збереження стратегії вже виконується");
    writeBusy.current = true;
    setSaving(true); setError(null);
    try {
      const result = await requestJson<{ strategy: StoredStrategy }>("/api/strategies", { method: "POST", body: JSON.stringify({ account_id: accountId, name: profile.name, description: profile.description ?? null, definition: { rules: profile.rules }, source_strategy_id: sourceId ?? null }) });
      const saved = profileFromRow(result.strategy);
      if (mounted.current && currentAccount.current === accountId) {
        setRecords(current => [saved, ...current.filter(strategy => strategy.id !== saved.id)]);
        setSelection(saved.id);
      }
      return saved;
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : "Не вдалося зберегти стратегію");
      throw cause;
    } finally { writeBusy.current = false; if (mounted.current) setSaving(false); }
  }
  async function duplicateStrategy(profile: AccountStrategy) {
    return createStrategy({ ...profile, name: `${profile.name} Copy`, rules: profile.rules.map(rule => ({ ...rule, params: { ...rule.params } })) }, profile.id);
  }
  function requestDelete(strategy: AccountStrategy) {
    if (!hidden.has(strategy.id) && !deletionIds.current.has(strategy.id)) setPending(strategy);
  }
  function confirmDelete() {
    const removed = pending;
    setPending(null);
    if (!removed || hidden.has(removed.id) || deletionIds.current.has(removed.id)) return;
    const fallback = strategies.find(strategy => strategy.id !== removed.id)?.id ?? "";
    deletionIds.current.add(removed.id);
    const accepted = notify({
      key: `strategy:${removed.id}`,
      message: `Стратегію «${removed.name}» видалено`,
      duration: 10000,
      onUndo: () => {
        deletionIds.current.delete(removed.id);
        if (!mounted.current) return;
        setHidden(current => { const next = new Set(current); next.delete(removed.id); return next; });
        setSelection(current => current === fallback ? removed.id : current);
        void reload();
      },
      onCommit: async () => {
        try {
          const result = await requestJson<{ success: boolean }>("/api/strategies", { method: "DELETE", body: JSON.stringify({ id: removed.id }) });
          if (result.success !== true) throw new Error("Strategy deletion was not confirmed");
          if (mounted.current) setRecords(current => current.filter(strategy => strategy.id !== removed.id));
        } finally { deletionIds.current.delete(removed.id); }
      },
    });
    if (!accepted) { deletionIds.current.delete(removed.id); return; }
    setHidden(current => new Set(current).add(removed.id));
    setSelection(current => current === removed.id ? fallback : current);
  }
  const confirmation = <ConfirmDialog open={pending !== null} title={`Видалити стратегію «${pending?.name ?? ""}»?`} description="Угоди не видалятимуться. Після підтвердження буде 10 секунд, щоб скасувати; потім стратегія видалиться з бази даних." onCancel={() => setPending(null)} onConfirm={confirmDelete} />;
  return { strategies, activeStrategy, selectedStrategyId, setSelectedStrategyId: setSelection, loading, saving, error, canCreate, createStrategy, duplicateStrategy, requestDelete, confirmation, reload };
}
