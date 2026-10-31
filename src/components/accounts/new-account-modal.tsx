"use client";
import { Button, Input, Select } from "@/components/ui/primitives";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { parseAccountSetup, type AccountType, type PropPhase, type SetupPlatform } from "@/lib/account-setup";
import type { AccountInput } from "@/hooks/use-trades";
type Props = { onClose: () => void; onCreate: (account: AccountInput) => Promise<void> | void; initialPlatform?: SetupPlatform };
import { FIELD_LABEL as LABEL, CHOICE_LAYOUT, CHOICE_SELECTED, CHOICE_IDLE } from "@/components/ui/form-styles";
function optionalNumber(value: string): number | null { return value.trim() ? Number(value) : null; }
export function NewAccountModal({ onClose, onCreate, initialPlatform = "manual" }: Props) {
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
      if (!name.trim() || name.trim().length > 200) throw new Error("Вкажіть назву рахунку до 200 символів");
      if (!accountType) throw new Error("Оберіть: особистий чи проп-рахунок");
      if (!balance.trim()) throw new Error("Вкажіть початковий капітал рахунку");
      const setup = parseAccountSetup({ accountType, platform, initialBalance: Number(balance), phase: accountType === "prop" ? phase || null : null, targetPercent: accountType === "prop" ? optionalNumber(target) : null, maxLossPercent: accountType === "prop" ? optionalNumber(maxLoss) : null, dailyLossPercent: accountType === "prop" ? optionalNumber(dailyLoss) : null, minTradingDays: accountType === "prop" ? optionalNumber(days) : null });
      busy.current = true;
      setSaving(true);
      await onCreate({ ...setup, name: name.trim(), broker: broker.trim(), currency, source: "manual", kind: platform === "mt5" ? "mt5_bridge" : "manual", mt5Login: platform === "mt5" ? login.trim() || undefined : undefined, mt5Server: platform === "mt5" ? server.trim() || undefined : undefined, color: "#4f8cff" });
      onClose();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Не вдалося зберегти рахунок"); }
    finally { busy.current = false; setSaving(false); }
  }
  if (typeof document === "undefined") return null;
  return createPortal(<dialog ref={dialog} aria-labelledby="new-account-title" onCancel={event => { event.preventDefault(); if (!saving) onClose(); }} className="fixed inset-0 m-auto max-h-[90dvh] w-[min(680px,calc(100vw-2rem))] overflow-y-auto rounded-[28px] border border-border bg-card p-6 text-foreground shadow-2xl backdrop:bg-black/70">
    <div className="mb-5 flex items-start justify-between gap-4"><div><p className="mb-2 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Trading account</p><h2 id="new-account-title" className="text-xl font-semibold">Додати рахунок</h2><p className="mt-2 text-sm text-muted-foreground">Оберіть тип рахунку й платформу. Журнал ведеться вручну.</p></div><Button variant="ghost" size="icon" type="button" aria-label="Закрити" onClick={onClose} disabled={saving} ><X className="h-4 w-4" /></Button></div>
    <form noValidate onSubmit={event => { event.preventDefault(); void create(); }}><fieldset disabled={saving} className="min-w-0 space-y-5 border-0 p-0">
      <fieldset className="space-y-2"><legend className="text-sm text-foreground">Тип рахунку</legend><div className="grid grid-cols-2 gap-3">{([['personal', 'Особистий'], ['prop', 'Проп']] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={accountType === value} onClick={() => setAccountType(value)} className={`${CHOICE_LAYOUT} ${accountType === value ? CHOICE_SELECTED : CHOICE_IDLE}`}>{label}</button>)}</div></fieldset>
      <fieldset className="space-y-2"><legend className="text-sm text-foreground">Платформа рахунку</legend><div className="grid grid-cols-2 gap-3">{([['manual', 'Без прив’язки'], ['mt5', 'MT5']] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={platform === value} onClick={() => setPlatform(value)} className={`${CHOICE_LAYOUT} ${platform === value ? CHOICE_SELECTED : CHOICE_IDLE}`}>{label}</button>)}</div><p className="text-xs text-muted-foreground">MT5 — лише позначка платформи, не підключення термінала. Автоматична синхронізація не налаштована.</p></fieldset>
      <div className="grid gap-4 md:grid-cols-2"><label className={`${LABEL} md:col-span-2`}>Назва<Input  maxLength={200} value={name} onChange={event => setName(event.target.value)} /></label><label className={LABEL}>Брокер / фірма (необов&apos;язково)<Input  maxLength={200} value={broker} onChange={event => setBroker(event.target.value)} /></label><label className={LABEL}>Валюта<Select  value={currency} onChange={event => setCurrency(event.target.value as "USD" | "USDT")}><option value="USD">USD</option><option value="USDT">USDT</option></Select></label><label className={`${LABEL} md:col-span-2`}>{accountType === "prop" ? "Розмір проп-рахунку" : "Початковий капітал"}<Input  type="number" inputMode="decimal" value={balance} onChange={event => setBalance(event.target.value)} /><span>У валюті рахунку. Значення задаєте ви.</span></label>
      {platform === "mt5" && <><label className={LABEL}>MT5 login — ідентифікатор (необов’язково)<Input  maxLength={200} value={login} onChange={event => setLogin(event.target.value)} /></label><label className={LABEL}>MT5 server (необов’язково)<Input  maxLength={200} value={server} onChange={event => setServer(event.target.value)} /></label><p className="text-xs text-muted-foreground md:col-span-2">Ці реквізити зберігаються як інформація про рахунок. Пароль не потрібен; збереження не запускає підключення.</p></>}
      </div>
      {accountType === "prop" && <fieldset className="space-y-4 rounded-2xl border border-border bg-secondary/30 p-4"><legend className="px-2 text-sm">Умови проп-рахунку</legend><p className="text-xs text-muted-foreground">Заповнюйте лише свої умови. Порожнє поле — не задано. Ліміти нижче у відсотках.</p><div className="grid gap-4 md:grid-cols-2"><label className={LABEL}>Поточна фаза<Select  value={phase} onChange={event => setPhase(event.target.value as PropPhase | "")}><option value="">Не задано</option><option value="phase-1">Phase 1</option><option value="phase-2">Phase 2</option><option value="phase-3">Phase 3</option><option value="funded">Funded</option></Select></label>{([['Ціль прибутку, %', target, setTarget], ['Загальний ліміт збитку, %', maxLoss, setMaxLoss], ['Денний ліміт збитку, %', dailyLoss, setDailyLoss]] as const).map(([label, value, setter]) => <label key={label} className={LABEL}>{label}<Input  type="number" min={0} max={100} step="any" value={value} onChange={event => setter(event.target.value)} placeholder="Не задано" /></label>)}<label className={LABEL}>Мінімум торгових днів<Input  type="number" min={0} step={1} value={days} onChange={event => setDays(event.target.value)} placeholder="Не задано" /></label></div><p className="text-xs text-muted-foreground">Фаза — позначка цього рахунку. Інші рахунки автоматично не створюються.</p></fieldset>}
      {error && <p role="alert" className="rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      <div className="flex justify-end gap-3"><Button variant="secondary" size="md" type="button" onClick={onClose} >Скасувати</Button><Button variant="primary" size="md" type="submit" disabled={!accountType} >{saving ? "Збереження…" : "Створити рахунок"}</Button></div>
    </fieldset></form>
  </dialog>, document.body);
}
