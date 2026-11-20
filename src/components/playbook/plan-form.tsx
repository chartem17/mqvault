"use client";

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Check, Lock, X } from "lucide-react";
import { useI18n } from "@/components/providers/i18n-provider";
import { useTrades } from "@/hooks/use-trades";
import { PlanRejected } from "@/hooks/use-playbook";
import { useMediaQuery, PHONE_QUERY } from "@/hooks/use-media-query";
import { dialogSurface } from "@/components/ui/dialog-styles";
import { Button, Input, Select, Textarea } from "@/components/ui/primitives";
import { Checkbox } from "@/components/ui/checkbox";
import type { PlaybookConfig } from "@/lib/playbook/config";
import { msg } from "@/lib/i18n/core";
import {
  BOS_TIMEFRAMES, EMPTY_DRAFT, EXCEPTION_LABEL, POI_LABEL, POI_TYPES, REACTION_LABEL, REACTIONS, RISK_EXCEPTIONS,
  gatePassed, planGate, planRisk, planRR, type GateCheck, type PlanDraft,
} from "@/lib/playbook/plans";
import type { AccountPlaybookState } from "./playbook-status";

type Props = {
  open: boolean;
  accountId: string | null;
  config: PlaybookConfig;
  stateFor: (accountId: string, now: Date) => AccountPlaybookState;
  onSave: (draft: PlanDraft) => Promise<unknown>;
  onClose: () => void;
};

function Segmented<T extends string>({ value, options, label, onChange }: { value: T | null; options: readonly T[]; label: (option: T) => string; onChange: (value: T) => void }) {
  return <div className="flex flex-wrap gap-2">{options.map(option => <button key={option} type="button" aria-pressed={value === option} onClick={() => onChange(option)}
    className={`min-h-9 rounded-lg border px-3 text-sm transition-colors ${value === option ? "border-primary bg-primary text-primary-foreground" : "border-input hover:bg-accent"}`}>{label(option)}</button>)}</div>;
}

function Tick({ checked, onChange, children }: { checked: boolean; onChange: (value: boolean) => void; children: ReactNode }) {
  return <label className="flex cursor-pointer items-start gap-2.5 text-sm"><Checkbox className="mt-0.5" checked={checked} onChange={event => onChange(event.target.checked)} /><span>{children}</span></label>;
}

/** One numbered item of the checklist with its pass mark. */
function Item({ n, check, children }: { n: number; check: GateCheck | undefined; children?: ReactNode }) {
  const { t } = useI18n();
  const ok = check?.ok ?? false;
  return <li className="list-none space-y-2.5 border-b border-border/60 py-4 last:border-0">
    <div className="flex items-start gap-3">
      <span aria-hidden="true" className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[0.65rem] tabular-nums ${ok ? "border-green bg-green/15 text-green" : "border-input text-muted-foreground"}`}>{ok ? <Check className="h-3 w-3" /> : n}</span>
      <div className="min-w-0 flex-1 space-y-2.5">
        <p className="m-0 text-sm font-medium">{check ? t(check.label, check.vars) : ""}{check?.auto && <span className="ml-2 text-xs font-normal text-muted-foreground">{t("checked automatically")}</span>}</p>
        {check?.detail && !ok && <p className="m-0 text-xs text-red">{t(check.detail, check.vars)}</p>}
        {children}
      </div>
    </div>
  </li>;
}

const PRICE_LABEL = { entry: msg("Entry"), stop: msg("Stop"), target: msg("Target") } as const;
const DIRECTION_LABEL = { Long: msg("Long"), Short: msg("Short") } as const;
const numberOrNull = (value: string) => { const n = Number(value.replace(",", ".")); return value.trim() && Number.isFinite(n) && n > 0 ? n : null; };

/**
 * Trade plan — the checklist barrier BEFORE an entry. The save button stays disabled, with the list of what
 * blocks it, until every item passes; the server runs the same checks again and refuses anything else.
 */
export function PlanForm({ open, accountId, config, stateFor, onSave, onClose }: Props) {
  const { t } = useI18n();
  const { accounts } = useTrades();
  const phone = useMediaQuery(PHONE_QUERY);
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();
  const [draft, setDraft] = useState<PlanDraft>(EMPTY_DRAFT);
  const [prices, setPrices] = useState({ entry: "", stop: "", target: "", risk: "" });
  const [now, setNow] = useState(() => new Date());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resets local form/selection state when its input changes
    setDraft({ ...EMPTY_DRAFT, account_id: accountId ?? accounts[0]?.id ?? "" });
    setPrices({ entry: "", stop: "", target: "", risk: "" });
    setError(null); setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, [open, accountId, accounts]);
  useEffect(() => {
    const node = dialog.current;
    if (!open || !node) return;
    const previous = document.activeElement;
    node.showModal();
    return () => { node.close(); if (previous instanceof HTMLElement && previous.isConnected) previous.focus(); };
  }, [open]);

  const set = <K extends keyof PlanDraft>(key: K, value: PlanDraft[K]) => setDraft(current => ({ ...current, [key]: value }));
  const full: PlanDraft = { ...draft, entry: numberOrNull(prices.entry), stop: numberOrNull(prices.stop), target: numberOrNull(prices.target), risk_pct: numberOrNull(prices.risk) };
  const state = useMemo(() => full.account_id ? stateFor(full.account_id, now) : null, [full.account_id, now, stateFor]);
  const checks = state ? planGate(full, { now: now.getTime(), day: state.day, risk: state.risk, config }) : [];
  const byId = new Map(checks.map(check => [check.id, check]));
  const blockers = checks.filter(check => !check.ok);
  const passed = state !== null && gatePassed(checks);
  const rr = planRR(full.direction, full.entry, full.stop, full.target);
  const risk = state ? planRisk(full, state.risk) : null;

  async function submit() {
    if (!passed || saving) return;
    setSaving(true); setError(null);
    try { await onSave(full); onClose(); }
    catch (reason) {
      if (reason instanceof PlanRejected) setError(t("The server refused the plan: {items}", { items: reason.failed.map(code => byId.get(code) ? t(byId.get(code)!.label, byId.get(code)!.vars) : code).join(", ") }));
      else setError(reason instanceof Error ? t(reason.message) : t("Could not save the plan"));
    } finally { setSaving(false); }
  }

  if (!open || typeof document === "undefined") return null;
  const layout = phone ? "fixed inset-0 m-0 h-[100dvh] max-h-none w-screen max-w-none rounded-none p-0" : "fixed inset-0 m-auto max-h-[min(92vh,900px)] w-[min(720px,calc(100vw-2rem))] p-0";
  return createPortal(<dialog ref={dialog} aria-labelledby={`${id}-title`} onCancel={event => { event.preventDefault(); onClose(); }} className={dialogSurface(layout, true)}>
    <div className="flex h-full max-h-[inherit] flex-col">
      <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
        <div><h2 id={`${id}-title`} className="m-0 text-lg font-semibold">{t("New trade plan")}</h2><p className="m-0 mt-1 text-xs text-muted-foreground">{t("Before the entry. No passed checklist — no trade.")}</p></div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label={t("Close")}><X className="h-4 w-4" /></Button>
      </header>
      <ol className="m-0 min-h-0 flex-1 overflow-y-auto px-5 py-1">
        <Item n={0} check={byId.get("basics")}>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto]">
            <Select aria-label={t("Account")} value={draft.account_id} onChange={event => set("account_id", event.target.value)}>
              <option value="">{t("Choose an account")}</option>
              {accounts.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}
            </Select>
            <Input aria-label={t("Instrument")} placeholder={t("Instrument, e.g. XAUUSD")} value={draft.symbol} maxLength={40} onChange={event => set("symbol", event.target.value.toUpperCase())} />
            <Segmented value={draft.direction} options={["Long", "Short"] as const} label={option => t(DIRECTION_LABEL[option])} onChange={value => set("direction", value)} />
          </div>
        </Item>
        <Item n={1} check={byId.get("window")}>{state && <p className="m-0 text-xs text-muted-foreground">{state.window.window ? t(state.window.window.label) : t("No trading window now")} · {state.window.time} ({config.timezone})</p>}</Item>
        <Item n={2} check={byId.get("at_desk")}><Tick checked={draft.at_desk} onChange={value => set("at_desk", value)}>{t("I am at the computer, set up, and this is not a trade out of boredom")}</Tick></Item>
        <Item n={3} check={byId.get("limits")}>{state && <p className="m-0 text-xs text-muted-foreground">{t("Trades {entries} of {maxTrades} · stops {losses} of {maxLosses}", { entries: state.day.entries, maxTrades: state.day.maxTrades, losses: state.day.losses, maxLosses: state.day.maxLosses })}</p>}</Item>
        <Item n={4} check={byId.get("context")}><Input value={draft.context} maxLength={500} placeholder={t("Order flow direction and the target")} onChange={event => set("context", event.target.value)} /></Item>
        <Item n={5} check={byId.get("poi")}>
          <Segmented value={draft.poi_type} options={POI_TYPES} label={option => t(POI_LABEL[option])} onChange={value => set("poi_type", value)} />
          <Input value={draft.poi_note} maxLength={300} placeholder={t("Which POI (timeframe, level)")} onChange={event => set("poi_note", event.target.value)} />
          <Tick checked={draft.poi_swept} onChange={value => set("poi_swept", value)}>{t("The POI was fully swept")}</Tick>
        </Item>
        <Item n={6} check={byId.get("reaction")}><Segmented value={draft.reaction} options={REACTIONS} label={option => t(REACTION_LABEL[option])} onChange={value => set("reaction", value)} /></Item>
        <Item n={7} check={byId.get("bos")}>
          <Segmented value={draft.bos_timeframe} options={BOS_TIMEFRAMES} label={option => option} onChange={value => set("bos_timeframe", value)} />
          <Tick checked={draft.bos_body_close} onChange={value => set("bos_body_close", value)}>{t("Candle body closed beyond the fractal")}</Tick>
        </Item>
        <Item n={8} check={byId.get("limit")}>
          <Tick checked={draft.limit_on_fvg} onChange={value => set("limit_on_fvg", value)}>{t("Limit order on the test of this FVG")}</Tick>
          <Tick checked={draft.m3_refined} onChange={value => set("m3_refined", value)}>{t("M3 used only to refine the FVG of a valid M5/M15 setup")}</Tick>
        </Item>
        <Item n={9} check={byId.get("prices")}>
          <div className="grid grid-cols-3 gap-3">
            {(["entry", "stop", "target"] as const).map(key => <label key={key} className="space-y-1"><span className="text-xs text-muted-foreground">{t(PRICE_LABEL[key])}</span>
              <Input inputMode="decimal" value={prices[key]} onChange={event => setPrices(current => ({ ...current, [key]: event.target.value }))} /></label>)}
          </div>
        </Item>
        <Item n={10} check={byId.get("rr")}><p className="m-0 text-sm tabular-nums">{t("RR: {rr}", { rr: rr ?? "—" })}</p></Item>
        <Item n={11} check={byId.get("risk")}>
          <p className="m-0 text-sm">{t("Rule risk now: {pct}%", { pct: state?.risk.riskPct ?? "—" })}</p>
          <Segmented value={draft.risk_exception} options={RISK_EXCEPTIONS} label={option => t(EXCEPTION_LABEL[option])} onChange={value => set("risk_exception", value)} />
          {draft.risk_exception !== "none" && <label className="block max-w-[12rem] space-y-1"><span className="text-xs text-muted-foreground">{t("Risk for this exception, %")}</span><Input inputMode="decimal" value={prices.risk} onChange={event => setPrices(current => ({ ...current, risk: event.target.value }))} /></label>}
          {risk !== null && <p className="m-0 text-xs text-muted-foreground">{t("This plan risks {pct}%.", { pct: risk })}</p>}
        </Item>
        <Item n={12} check={byId.get("why")}>
          <Input type="url" value={draft.screenshot_url} maxLength={500} placeholder={t("Screenshot link (TradingView or image)")} onChange={event => set("screenshot_url", event.target.value)} />
          <Textarea value={draft.reason} maxLength={1000} rows={2} className="min-h-16" placeholder={t("Why this entry, in one sentence")} onChange={event => set("reason", event.target.value)} />
        </Item>
      </ol>
      <footer className="space-y-3 border-t border-border px-5 py-4">
        {blockers.length > 0 && <div role="status" className="text-xs text-muted-foreground"><span className="mr-1 inline-flex items-center gap-1 font-medium text-foreground"><Lock className="h-3.5 w-3.5" aria-hidden="true" />{t("Blocked by:")}</span>{blockers.map(check => t(check.label, check.vars)).join(" · ")}</div>}
        {!state && <p className="m-0 text-xs text-muted-foreground">{t("Choose an account first.")}</p>}
        {error && <p role="alert" className="m-0 text-sm text-red">{error}</p>}
        <div className="flex justify-end gap-3"><Button variant="secondary" onClick={onClose}>{t("Cancel")}</Button><Button onClick={submit} disabled={!passed} loading={saving}>{t("Save plan")}</Button></div>
      </footer>
    </div>
  </dialog>, document.body);
}
