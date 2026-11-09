"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Input, Select } from "@/components/ui/primitives";
import { useTrades } from "@/hooks/use-trades";
import { useI18n } from "@/components/providers/i18n-provider";
import type { PropPhase } from "@/lib/accounts/account-setup";
import { msg } from "@/lib/i18n/core";

type Pending = { id: string; server: string; login: string; company: string | null; account_id: string; deposits: number | null };
const PHASES: { value: PropPhase; label: string }[] = [
  { value: "phase-1", label: "Phase 1" }, { value: "phase-2", label: "Phase 2" }, { value: "phase-3", label: "Phase 3" }, { value: "funded", label: msg("Funded") },
];

async function decide(id: string, decision: "confirm" | "ignore") {
  const response = await fetch("/api/bridge/accounts", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ id, decision }) });
  if (!response.ok) throw new Error(msg("Could not save the answer."));
}

/**
 * Home banner: MT5 Bridge found an account that was not in the journal and added it as personal. The type cannot be
 * detected (prop firms report their accounts as demo), so the owner answers once (docs/features/mt5-bridge.md §3.7).
 */
export function Mt5AccountReview() {
  const { t } = useI18n();
  const { accounts, upsertAccount, refreshTrades } = useTrades();
  const [pending, setPending] = useState<Pending[]>([]);
  const [propFor, setPropFor] = useState<string | null>(null);
  const [size, setSize] = useState("");
  const [phase, setPhase] = useState<PropPhase>("phase-1");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const response = await fetch("/api/bridge/accounts", { credentials: "same-origin" }).catch(() => null);
    if (!response?.ok) return;
    const body = await response.json() as { accounts: Pending[] };
    setPending(body.accounts);
  }, []);
  useEffect(() => { void load(); }, [load]);

  if (pending.length === 0) return null;

  async function run(id: string, action: () => Promise<void>) {
    setBusy(id); setError("");
    try { await action(); setPropFor(null); await load(); void refreshTrades(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : msg("Could not save the answer.")); }
    setBusy(null);
  }
  const saveProp = (item: Pending) => run(item.id, async () => {
    const account = accounts.find(entry => entry.id === item.account_id);
    const amount = Number(size.replace(",", "."));
    if (!account) throw new Error(msg("The account is not loaded yet. Refresh the page."));
    if (!(amount > 0)) throw new Error(msg("Enter the prop account size."));
    await upsertAccount({ ...account, accountType: "prop", phase, initialBalance: amount });
    await decide(item.id, "confirm");
  });
  const ignore = (item: Pending) => {
    if (!window.confirm(t("Stop syncing this MT5 account? The account and trades already in the journal stay; you can delete them yourself."))) return;
    void run(item.id, () => decide(item.id, "ignore"));
  };

  return <section aria-label={t("New MT5 accounts")} className="space-y-3">
    {pending.map(item => {
      const name = `${item.company ? `${item.company} · ` : ""}${item.server} · ${item.login}`;
      const open = propFor === item.id;
      return <div key={item.id} role="status" className="space-y-3 rounded-2xl border border-border bg-card/60 px-4 py-4 sm:px-5">
        <div>
          <p className="m-0 text-sm font-medium text-foreground">{t("MT5 Bridge found a new account: {name}", { name })}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("It was added to the journal as a personal account. MT5 cannot tell whether it is a prop account — is it?")}</p>
        </div>
        {open ? <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
          <label className="space-y-1.5 text-xs text-muted-foreground">{t("Prop account size")}
            <Input type="number" inputMode="decimal" min="0" value={size} onChange={event => setSize(event.target.value)} />
          </label>
          <label className="space-y-1.5 text-xs text-muted-foreground">{t("Phase")}
            <Select value={phase} onChange={event => setPhase(event.target.value as PropPhase)}>{PHASES.map(option => <option key={option.value} value={option.value}>{t(option.label)}</option>)}</Select>
          </label>
          <div className="flex gap-2">
            <Button onClick={() => void saveProp(item)} loading={busy === item.id}>{t("Save")}</Button>
            <Button variant="ghost" onClick={() => setPropFor(null)}>{t("Cancel")}</Button>
          </div>
        </div> : <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button size="sm" variant="secondary" loading={busy === item.id} onClick={() => void run(item.id, () => decide(item.id, "confirm"))}>{t("Personal — that's right")}</Button>
          <Button size="sm" variant="secondary" onClick={() => { setPropFor(item.id); setSize(item.deposits === null ? "" : String(item.deposits)); setPhase("phase-1"); }}>{t("It's a prop account")}</Button>
          <Button size="sm" variant="ghost" onClick={() => ignore(item)}>{t("Don't sync it")}</Button>
        </div>}
        {open && <p className="m-0 text-xs text-muted-foreground">{t("Prop rules (target, loss limits) can be set afterwards in Overview.")}</p>}
      </div>;
    })}
    {error && <p role="alert" className="m-0 text-sm text-destructive">{t(error)}</p>}
  </section>;
}
