"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { parseAccountSetup, type AccountType, type PropPhase, type SetupPlatform } from "@/lib/account-setup";
import type { AccountInput } from "@/hooks/use-trades";
type Props = { onClose: () => void; onCreate: (account: AccountInput) => Promise<void> | void; initialPlatform?: SetupPlatform };
const INPUT = "rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-400/50";
const LABEL = "flex flex-col gap-1 text-xs text-white/60";
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
  return createPortal(<dialog ref={dialog} aria-labelledby="new-account-title" onCancel={event => { event.preventDefault(); if (!saving) onClose(); }} className="fixed inset-0 m-auto max-h-[90dvh] w-[min(680px,calc(100vw-2rem))] overflow-y-auto rounded-[28px] border border-white/10 bg-[#0d1117] p-6 text-white shadow-2xl backdrop:bg-black/70">
    <div className="mb-5 flex items-start justify-between gap-4"><div><p className="mb-2 text-[11px] uppercase tracking-[0.22em] text-white/35">Trading account</p><h2 id="new-account-title" className="text-xl font-semibold">Додати рахунок</h2><p className="mt-2 text-sm text-white/55">Оберіть тип рахунку й платформу. Журнал ведеться вручну.</p></div><button type="button" aria-label="Закрити" onClick={onClose} disabled={saving} className="rounded-xl border border-white/10 p-2 text-white/60 disabled:opacity-50"><X className="h-4 w-4" /></button></div>
    <form noValidate onSubmit={event => { event.preventDefault(); void create(); }}><fieldset disabled={saving} className="min-w-0 space-y-5 border-0 p-0">
      <fieldset className="space-y-2"><legend className="text-sm text-white/70">Тип рахунку</legend><div className="grid grid-cols-2 gap-3">{([['personal', 'Особистий'], ['prop', 'Проп']] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={accountType === value} onClick={() => setAccountType(value)} className={`rounded-2xl border p-4 text-left ${accountType === value ? "border-emerald-400/60 bg-emerald-400/10" : "border-white/10 bg-white/[0.03]"}`}>{label}</button>)}</div></fieldset>
      <fieldset className="space-y-2"><legend className="text-sm text-white/70">Платформа рахунку</legend><div className="grid grid-cols-2 gap-3">{([['manual', 'Без прив’язки'], ['mt5', 'MT5']] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={platform === value} onClick={() => setPlatform(value)} className={`rounded-2xl border p-4 text-left ${platform === value ? "border-emerald-400/60 bg-emerald-400/10" : "border-white/10 bg-white/[0.03]"}`}>{label}</button>)}</div><p className="text-xs text-white/40">MT5 — лише позначка платформи, не підключення термінала. Автоматична синхронізація не налаштована.</p></fieldset>
      <div className="grid gap-4 md:grid-cols-2"><label className={`${LABEL} md:col-span-2`}>Назва<input className={INPUT} maxLength={200} value={name} onChange={event => setName(event.target.value)} /></label><label className={LABEL}>Брокер / фірма (необов&apos;язково)<input className={INPUT} maxLength={200} value={broker} onChange={event => setBroker(event.target.value)} /></label><label className={LABEL}>Валюта<select className={INPUT} value={currency} onChange={event => setCurrency(event.target.value as "USD" | "USDT")}><option value="USD">USD</option><option value="USDT">USDT</option></select></label><label className={`${LABEL} md:col-span-2`}>{accountType === "prop" ? "Розмір проп-рахунку" : "Початковий капітал"}<input className={INPUT} type="number" inputMode="decimal" value={balance} onChange={event => setBalance(event.target.value)} /><span>У валюті рахунку. Значення задаєте ви.</span></label>
      {platform === "mt5" && <><label className={LABEL}>MT5 login — ідентифікатор (необов’язково)<input className={INPUT} maxLength={200} value={login} onChange={event => setLogin(event.target.value)} /></label><label className={LABEL}>MT5 server (необов’язково)<input className={INPUT} maxLength={200} value={server} onChange={event => setServer(event.target.value)} /></label><p className="text-xs text-white/55 md:col-span-2">Ці реквізити зберігаються як інформація про рахунок. Пароль не потрібен; збереження не запускає підключення.</p></>}
      </div>
      {accountType === "prop" && <fieldset className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4"><legend className="px-2 text-sm">Умови проп-рахунку</legend><p className="text-xs text-white/55">Заповнюйте лише свої умови. Порожнє поле — не задано. Ліміти нижче у відсотках.</p><div className="grid gap-4 md:grid-cols-2"><label className={LABEL}>Поточна фаза<select className={INPUT} value={phase} onChange={event => setPhase(event.target.value as PropPhase | "")}><option value="">Не задано</option><option value="phase-1">Phase 1</option><option value="phase-2">Phase 2</option><option value="phase-3">Phase 3</option><option value="funded">Funded</option></select></label>{([['Ціль прибутку, %', target, setTarget], ['Загальний ліміт збитку, %', maxLoss, setMaxLoss], ['Денний ліміт збитку, %', dailyLoss, setDailyLoss]] as const).map(([label, value, setter]) => <label key={label} className={LABEL}>{label}<input className={INPUT} type="number" min={0} max={100} step="any" value={value} onChange={event => setter(event.target.value)} placeholder="Не задано" /></label>)}<label className={LABEL}>Мінімум торгових днів<input className={INPUT} type="number" min={0} step={1} value={days} onChange={event => setDays(event.target.value)} placeholder="Не задано" /></label></div><p className="text-xs text-white/40">Фаза — позначка цього рахунку. Інші рахунки автоматично не створюються.</p></fieldset>}
      {error && <p role="alert" className="rounded-xl border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}
      <div className="flex justify-end gap-3"><button type="button" onClick={onClose} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm">Скасувати</button><button type="submit" disabled={!accountType} className="rounded-xl bg-emerald-400 px-4 py-2.5 text-sm font-medium text-black disabled:opacity-50">{saving ? "Збереження…" : "Створити рахунок"}</button></div>
    </fieldset></form>
  </dialog>, document.body);
}
