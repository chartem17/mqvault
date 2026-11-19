"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTrades } from "@/hooks/use-trades";
import { usePreferences } from "@/components/providers/preferences-provider";
import { DEFAULT_PLAYBOOK, sanitizePlaybook, type PlaybookConfig } from "@/lib/playbook/config";
import { dayStatus, riskState, windowAt } from "@/lib/playbook/engine";
import { matchPlans, pendingPlansToday, type PlanDraft, type TradePlan } from "@/lib/playbook/plans";
import { assessTrades } from "@/lib/playbook/discipline";
import { zonedParts } from "@/lib/time/timezone";

type PlansState = { plans: TradePlan[]; available: boolean | null; error: string | null };
export class PlanRejected extends Error { constructor(message: string, readonly failed: string[]) { super(message); } }

async function call<T>(method: string, body?: unknown): Promise<T> {
  const response = await fetch("/api/trade-plans", { method, cache: "no-store", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const payload = await response.json().catch(() => ({}));
  if (response.status === 422) throw new PlanRejected(payload.error ?? "The checklist is not passed", Array.isArray(payload.failed) ? payload.failed : []);
  if (!response.ok) throw new Error(payload.error ?? `Request failed (${response.status})`);
  return payload as T;
}

/**
 * Playbook data for the UI: the stored rules (preferences), the trade plans, plan ↔ trade matches and
 * the discipline assessment of every trade. All of it is computed from what the journal already has.
 */
export function usePlaybook() {
  const { preferences, update } = usePreferences();
  const { trades } = useTrades();
  const config = useMemo<PlaybookConfig>(() => preferences.playbook ? sanitizePlaybook(preferences.playbook) : DEFAULT_PLAYBOOK, [preferences.playbook]);
  const [state, setState] = useState<PlansState>({ plans: [], available: null, error: null });

  const load = useCallback(async () => {
    try {
      const data = await call<{ plans: TradePlan[]; available: boolean }>("GET");
      setState({ plans: data.plans ?? [], available: data.available !== false, error: null });
    } catch (error) { setState(current => ({ ...current, error: error instanceof Error ? error.message : "Failed to load plans" })); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const match = useMemo(() => matchPlans(state.plans, trades, config), [state.plans, trades, config]);
  const assessed = useMemo(() => assessTrades(trades, state.plans, match, config), [trades, state.plans, match, config]);

  /** Window, daily limits and risk of one account right now. */
  const accountState = useCallback((accountId: string, now: Date) => {
    const at = now.getTime();
    const own = trades.filter(trade => trade.account_id === accountId);
    const today = zonedParts(at, config.timezone).date;
    const pending = pendingPlansToday(state.plans, match, accountId, today, iso => zonedParts(iso, config.timezone).date);
    return { window: windowAt(at, config), day: dayStatus(own, pending, at, config), risk: riskState(own, config, at) };
  }, [trades, state.plans, match, config]);

  const createPlan = useCallback(async (draft: PlanDraft) => {
    const data = await call<{ plan: TradePlan }>("POST", draft);
    setState(current => ({ ...current, plans: [data.plan, ...current.plans] }));
    return data.plan;
  }, []);
  const patchPlan = useCallback(async (body: { id: string; status?: "cancelled"; trade_id?: string | null }) => {
    const data = await call<{ plan: TradePlan }>("PATCH", body);
    setState(current => ({ ...current, plans: current.plans.map(plan => plan.id === data.plan.id ? data.plan : plan) }));
  }, []);
  const deletePlan = useCallback(async (id: string) => {
    await call("DELETE", { id });
    setState(current => ({ ...current, plans: current.plans.filter(plan => plan.id !== id) }));
  }, []);
  const saveConfig = useCallback((next: PlaybookConfig | null) => update({ playbook: next }), [update]);

  return { config, saveConfig, plans: state.plans, plansAvailable: state.available, plansError: state.error, reloadPlans: load, match, assessed, accountState, createPlan, patchPlan, deletePlan };
}
