"use client";
import { dialogSurface } from "@/components/ui/dialog-styles";
import { Button, Input, Select } from "@/components/ui/primitives";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { parseAccountSetup, type AccountType, type PropPhase, type SetupPlatform } from "@/lib/accounts/account-setup";
import type { AccountInput } from "@/hooks/use-trades";
import { useTrades } from "@/hooks/use-trades";
import { phaseLabel } from "@/lib/accounts/account-data";
import { useTimezone } from "@/components/providers/timezone-provider";
import { TimezoneSelect } from "@/components/settings/timezone-select";
import { useI18n } from "@/components/providers/i18n-provider";
type Props = { onClose: () => void; onCreate: (account: AccountInput) => Promise<void> | void; initialPlatform?: SetupPlatform };
import { FIELD_LABEL as LABEL, CHOICE_LAYOUT, CHOICE_SELECTED, CHOICE_IDLE } from "@/components/ui/form-styles";
function optionalNumber(value: string): number | null { return value.trim() ? Number(value) : null; }
export function NewAccountModal({ onClose, onCreate, initialPlatform = "manual" }: Props) {
  const { t } = useI18n();
  const dialog = useRef<HTMLDialogElement>(null);
  const busy = useRef(false);
  const [accountType, setAccountType] = useState<AccountType | null>(null);
  const [platform, setPlatform] = useState<SetupPlatform>(initialPlatform);
  const [name, setName] = useState("");
  const [broker, setBroker] = useState("");
  const [currency, setCurrency] = useState<"USD" | "USDT">("USD");
  const [balance, setBalance] = useState("");
  const [login, setLogin] = useState("");
  const [server, setServer] = useState("");
  const [phase, setPhase] = useState<PropPhase | "">("");
  const [target, setTarget] = useState("");
  const [maxLoss, setMaxLoss] = useState("");
  const [dailyLoss, setDailyLoss] = useState("");
  const [days, setDays] = useState("");
  const { accounts } = useTrades();
  const [parentId, setParentId] = useState("");
  const parents = accounts.filter(item => item.accountType === "prop" && !accounts.some(other => other.parentAccountId === item.id));
  const { timezone: userZone } = useTimezone();
  const [brokerZone, setBrokerZone] = useState(userZone);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    const previous = document.activeElement;
    node.showModal();
    return () => { node.close(); if (previous instanceof HTMLElement && previous.isConnected) previous.focus(); };
  }, []);
  async function create() {
    if (busy.current) return;
    setError(null);
    try {
      if (!name.trim() || name.trim().length > 200) throw new Error(t("Enter an account name of up to 200 characters"));
      if (!accountType) throw new Error(t("Choose personal or prop account"));
      if (!balance.trim()) throw new Error(t("Enter the starting balance"));
      const setup = parseAccountSetup({ accountType, platform, initialBalance: Number(balance), phase: accountType === "prop" ? phase || null : null, targetPercent: accountType === "prop" ? optionalNumber(target) : null, maxLossPercent: accountType === "prop" ? optionalNumber(maxLoss) : null, dailyLossPercent: accountType === "prop" ? optionalNumber(dailyLoss) : null, minTradingDays: accountType === "prop" ? optionalNumber(days) : null });
      busy.current = true;
      setSaving(true);
      await onCreate({ ...setup, name: name.trim(), broker: broker.trim(), currency, source: "manual", kind: platform === "mt5" ? "mt5_bridge" : "manual", mt5Login: platform === "mt5" ? login.trim() || undefined : undefined, mt5Server: platform === "mt5" ? server.trim() || undefined : undefined, color: "#4f8cff", brokerTimezone: brokerZone, parentAccountId: accountType === "prop" && parentId ? parentId : undefined });
      onClose();
    } catch (cause) { setError(cause instanceof Error ? t(cause.message) : t("Could not save the account")); }
    finally { busy.current = false; setSaving(false); }
  }
  if (typeof document === "undefined") return null;
  return createPortal(<dialog ref={dialog} aria-labelledby="new-account-title" onCancel={event => { event.preventDefault(); if (!saving) onClose(); }} className={dialogSurface("fixed inset-0 m-auto max-h-[90dvh] w-[min(680px,calc(100vw-1.5rem))] overflow-y-auto p-4 sm:p-6", true)}>
    <div className="mb-5 flex items-start justify-between gap-4"><div><p className="mb-2 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">{t("Trading account")}</p><h2 id="new-account-title" className="text-xl font-semibold">{t("Add account")}</h2><p className="mt-2 text-sm text-muted-foreground">{t("Choose the account type and platform. The journal is kept manually.")}</p></div><Button variant="ghost" size="icon" type="button" aria-label={t("Close")} onClick={onClose} disabled={saving} ><X className="h-4 w-4" /></Button></div>
    <form noValidate onSubmit={event => { event.preventDefault(); void create(); }}><fieldset disabled={saving} className="min-w-0 space-y-5 border-0 p-0">
      <fieldset className="space-y-2"><legend className="text-sm text-foreground">{t("Account type")}</legend><div className="grid grid-cols-2 gap-3">{([['personal', t("Personal")], ['prop', t("Prop")]] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={accountType === value} onClick={() => setAccountType(value)} className={`${CHOICE_LAYOUT} ${accountType === value ? CHOICE_SELECTED : CHOICE_IDLE}`}>{label}</button>)}</div></fieldset>
      <fieldset className="space-y-2"><legend className="text-sm text-foreground">{t("Account platform")}</legend><div className="grid grid-cols-2 gap-3">{([['manual', t("Not linked")], ['mt5', 'MT5']] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={platform === value} onClick={() => setPlatform(value)} className={`${CHOICE_LAYOUT} ${platform === value ? CHOICE_SELECTED : CHOICE_IDLE}`}>{label}</button>)}</div><p className="text-xs text-muted-foreground">{t("MT5 is only a platform label, not a terminal connection. Automatic sync is not set up.")}</p></fieldset>
      <div className="grid gap-4 md:grid-cols-2"><label className={`${LABEL} md:col-span-2`}>{t("Name")}<Input  maxLength={200} value={name} onChange={event => setName(event.target.value)} /></label><label className={LABEL}>{t("Broker / firm (optional)")}<Input  maxLength={200} value={broker} onChange={event => setBroker(event.target.value)} /></label><label className={LABEL}>{t("Currency")}<Select  value={currency} onChange={event => setCurrency(event.target.value as "USD" | "USDT")}><option value="USD">USD</option><option value="USDT">USDT</option></Select></label><label className={`${LABEL} md:col-span-2`}>{t("Broker / terminal time zone")}<TimezoneSelect aria-label={t("Broker time zone")} value={brokerZone} onChange={setBrokerZone} /><span>{t("Trade times for this account are entered in this zone — as shown in the terminal or on a screenshot.")}</span></label><label className={`${LABEL} md:col-span-2`}>{accountType === "prop" ? t("Prop account size") : t("Starting balance")}<Input  type="number" inputMode="decimal" value={balance} onChange={event => setBalance(event.target.value)} /><span>{t("In the account currency. You set the value.")}</span></label>
      {platform === "mt5" && <><label className={LABEL}>{t("MT5 login — ID (optional)")}<Input  maxLength={200} value={login} onChange={event => setLogin(event.target.value)} /></label><label className={LABEL}>{t("MT5 server (optional)")}<Input  maxLength={200} value={server} onChange={event => setServer(event.target.value)} /></label><p className="text-xs text-muted-foreground md:col-span-2">{t("These details are stored as account info. No password is needed; saving does not start a connection.")}</p></>}
      </div>
      {accountType === "prop" && <fieldset className="space-y-4 rounded-2xl border border-border bg-secondary/30 p-4"><legend className="px-2 text-sm">{t("Prop account rules")}</legend><p className="text-xs text-muted-foreground">{t("Fill in only your own rules. An empty field means not set. Limits below are in percent.")}</p><div className="grid gap-4 md:grid-cols-2"><label className={LABEL}>{t("Current phase")}<Select  value={phase} onChange={event => setPhase(event.target.value as PropPhase | "")}><option value="">{t("Not set")}</option><option value="phase-1">Phase 1</option><option value="phase-2">Phase 2</option><option value="phase-3">Phase 3</option><option value="funded">{t("Funded")}</option></Select></label><label className={LABEL}>{t("Previous stage (optional)")}<Select value={parentId} onChange={event => setParentId(event.target.value)}><option value="">{t("None — standalone account")}</option>{parents.map(item => <option key={item.id} value={item.id}>{item.name} · {t(phaseLabel[item.phase])}</option>)}</Select></label>{([[t("Profit target, %"), target, setTarget], [t("Max loss, %"), maxLoss, setMaxLoss], [t("Daily loss limit, %"), dailyLoss, setDailyLoss]] as const).map(([label, value, setter]) => <label key={label} className={LABEL}>{label}<Input  type="number" min={0} max={100} step="any" value={value} onChange={event => setter(event.target.value)} placeholder={t("Not set")} /></label>)}<label className={LABEL}>{t("Minimum trading days")}<Input  type="number" min={0} step={1} value={days} onChange={event => setDays(event.target.value)} placeholder={t("Not set")} /></label></div><p className="text-xs text-muted-foreground">{t("The phase is a label of this account. “Previous stage” links accounts into one branch (Phase 1 → Phase 2 → Funded) to track combined progress. No other accounts are created automatically.")}</p></fieldset>}
      {error && <p role="alert" className="rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      <div className="flex justify-end gap-3"><Button variant="secondary" size="md" type="button" onClick={onClose} >{t("Cancel")}</Button><Button variant="primary" size="md" type="submit" disabled={!accountType} >{saving ? t("Saving…") : t("Create account")}</Button></div>
    </fieldset></form>
  </dialog>, document.body);
}
