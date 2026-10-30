"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTrades, type JournalTrade } from "@/hooks/use-trades";
import type { TradingAccount } from "@/lib/account-data";
import { accountOverviewLabel, buildAccountOverview } from "@/lib/account-overview";
import { parseRuleRecord, settingsFromColumns, type PropRuleRecord } from "@/lib/prop-rule-record";
import { parsePropRuleSettings, type ConditionState, type PropRuleSettings, type RuleCondition } from "@/lib/prop-rule-settings";
import { fmt } from "@/lib/utils-trade";
const CARD = "rounded-2xl border border-white/10 bg-panel p-5";
const INPUT = "w-full rounded-xl border border-white/10 bg-panel px-3 py-2 text-sm text-white outline-none focus:border-teal-400 disabled:opacity-50";
const LABELS = { target: "Ціль прибутку, %", maxLoss: "Загальний ліміт збитку, %", dailyLoss: "Денний ліміт збитку, %", minTradingDays: "Мінімум торгових днів" } as const;
class RuleHttpError extends Error { constructor(message: string, readonly status: number) { super(message); } }
async function responseRecord(response: Response, accountId: string) {
  const body = await response.json();
  if (!response.ok) throw new RuleHttpError(typeof body.error === "string" ? body.error : "Не вдалося завантажити умови", response.status);
  return parseRuleRecord(body.data, accountId);
}
function ConditionField({ label, value, days, onChange }: { label: string; value: RuleCondition; days: boolean; onChange: (value: RuleCondition) => void }) {
  return <label className="space-y-2 text-xs text-white/60"><span>{label}</span><select className={INPUT} value={value.state} onChange={event => onChange({ ...value, state: event.target.value as ConditionState })}><option value="unknown">Не налаштовано</option><option value="not_applicable">Не застосовується</option><option value="configured">Застосовується</option></select>{value.state === "configured" && <input className={INPUT} type="number" min={0} max={days ? 2147483647 : 100} step={days ? 1 : "any"} value={value.value ?? ""} onChange={event => onChange({ ...value, value: event.target.value === "" ? null : Number(event.target.value) })} />}</label>;
}
export function AccountRulesCard({ account, accountId, trades }: { account: TradingAccount | null; accountId: string; trades: JournalTrade[] }) {
  const { refreshTrades } = useTrades();
  const [saved, setSaved] = useState<PropRuleRecord | null>(null);
  const [draft, setDraft] = useState<PropRuleRecord | null>(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const id = account?.id;
  const isProp = account?.accountType === "prop";
  const load = useCallback(async (signal?: AbortSignal) => {
    if (!id || !isProp) return;
    setLoading(true);
    try {
      const result = await responseRecord(await fetch(`/api/accounts/${encodeURIComponent(id)}/prop-rules`, { cache: "no-store", signal }), id);
      if (!signal?.aborted) { setSaved(result); setDraft(result); setConflict(false); setError(null); }
    } catch (cause) { if (!signal?.aborted) setError(cause instanceof Error ? cause.message : "Не вдалося завантажити умови"); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, [id, isProp]);
  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [load]);
  async function save() {
    if (!id || !saved || !draft || busy.current || conflict) return;
    try {
      const settings = parsePropRuleSettings(draft.settings);
      busy.current = true; setSaving(true); setError(null);
      const result = await responseRecord(await fetch(`/api/accounts/${encodeURIComponent(id)}/prop-rules`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expectedRevision: saved.revision, phase: draft.phase, settings }) }), id);
      setSaved(result); setDraft(result); setEditing(false); void refreshTrades();
    } catch (cause) { if (cause instanceof RuleHttpError && cause.status === 409) setConflict(true); setError(cause instanceof Error ? cause.message : "Не вдалося зберегти умови"); }
    finally { busy.current = false; setSaving(false); }
  }
  if (accountId === "all") return <div className={CARD}><div className="text-sm text-white">Усі вибрані рахунки</div><p className="mt-1 text-sm text-white/60">Зведена статистика. Спільний проп-ліміт не обчислюється.</p></div>;
  if (!account) return <div className={CARD}>Рахунок не вибрано.</div>;
  const settings = saved?.settings ?? settingsFromColumns({ target_percent: account.targetPercent, max_loss_percent: account.maxLossPercent, daily_loss_percent: account.dailyLossPercent, min_trading_days: account.minTradingDays });
  const effective = { ...account, phase: saved ? saved.phase ?? "manual" as const : account.phase, targetPercent: settings.target.state === "configured" ? settings.target.value ?? undefined : undefined };
  const summary = buildAccountOverview(effective, trades);
  const money = (value: number | null) => value === null ? "—" : `${fmt.num(value, 2)} ${account.currency}`;
  const setSetting = <K extends keyof PropRuleSettings>(key: K, value: PropRuleSettings[K]) => setDraft(current => current ? { ...current, settings: { ...current.settings, [key]: value } } : current);
  return <section className={CARD}>
    <div className="flex flex-wrap justify-between gap-4"><div><h3 className="font-semibold text-white">{account.name}</h3><p className="mt-1 text-xs text-white/60">{accountOverviewLabel(effective)} · {account.broker || "—"} · {account.platform.toUpperCase()}</p><p className="mt-1 text-xs text-white/45">Початковий капітал: {money(summary.initialBalance)}</p></div><div className="text-right"><p className="text-xs text-white/45">Оцінка за журналом</p><p className="mt-1 text-lg font-semibold text-white">{money(summary.journalBalance)}</p><p className="mt-1 text-xs text-white/60">Net P&amp;L: {money(summary.netPnl)}</p></div></div>
    <p className="mt-3 text-xs text-white/45">Початковий капітал + net P&amp;L журналу. Це не брокерський баланс і не live equity.</p>
    {summary.netPnl === null && <p className="mt-2 text-xs text-amber-300">P&amp;L неповний; прогрес недоступний.</p>}
    {isProp && <div className="mt-4 space-y-3 border-t border-white/10 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm text-white/70">Умови проп-рахунку</p><button type="button" aria-expanded={editing} disabled={!saved || loading || saving} onClick={() => { setEditing(value => !value); if (saved) setDraft(saved); }} className="rounded-xl border border-white/10 px-3 py-2 text-xs text-white disabled:opacity-40">{editing ? "Закрити редактор" : "Редагувати умови"}</button></div>
      {loading && <p className="text-xs text-white/45">Завантаження умов…</p>}
      {Object.values(LABELS).length > 0 && Object.keys(LABELS).some(key => settings[key as keyof typeof LABELS].state === "unknown") && <p className="text-xs text-white/45">Не всі умови налаштовані. Це не означає відсутність вимог.</p>}
      <div className="grid gap-3 md:grid-cols-2">{(Object.keys(LABELS) as (keyof typeof LABELS)[]).filter(key => settings[key].state === "configured").map(key => <div key={key} className="rounded-xl border border-white/10 p-3"><p className="text-xs text-white/45">{LABELS[key]}</p><p className="mt-1 text-sm text-white">{settings[key].value}</p>{key === "maxLoss" && <p className="mt-1 text-xs text-white/45">{settings.maxLossMode === "eod_trailing_percent" ? "EOD trailing · % від максимуму балансу" : settings.maxLossMode === "static" ? "Статичний · % від початкового капіталу" : "Режим розрахунку не налаштовано"}</p>}</div>)}</div>
      {settings.target.state === "configured" && summary.progressPercent !== null && <div><p className="text-xs text-white/60">Прогрес за журналом: {fmt.pct(summary.pnlPercent ?? 0)} · ціль {money(summary.targetAmount)}</p><div role="progressbar" aria-label="Прогрес за журналом" aria-valuemin={0} aria-valuemax={100} aria-valuenow={summary.progressPercent} className="mt-2 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-[var(--color-green)]" style={{ width: `${summary.progressPercent}%` }} /></div></div>}
      {settings.maxLoss.state === "configured" && settings.maxLossMode === "eod_trailing_percent" && <p className="text-xs text-amber-300">Trailing-межа недоступна: немає підтвердженої повної EOD-історії та звірки руху коштів. Формула: максимум EOD-балансу × (1 − ліміт / 100).</p>}
      <p className="text-xs text-white/45">Використання лімітів і виконання мінімуму днів не підтверджуються. Статуси проходження або провалу автоматично не встановлюються.</p>
      {settings.notes && <p className="whitespace-pre-wrap text-xs text-white/60">{settings.notes}</p>}
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      <button type="button" disabled={loading || saving} onClick={() => void load()} className="text-xs text-white/60 underline disabled:opacity-40">{editing ? "Скинути локальні зміни та перечитати умови" : "Оновити умови"}</button>
      {editing && draft && <form noValidate onSubmit={event => { event.preventDefault(); void save(); }}><fieldset disabled={saving || loading || conflict} className="space-y-4 rounded-xl border border-white/10 p-4"><legend className="px-2 text-sm text-white">Редагування умов</legend><label className="block space-y-2 text-xs text-white/60"><span>Позначка етапу — не набір правил</span><select className={INPUT} value={draft.phase ?? ""} onChange={event => setDraft({ ...draft, phase: event.target.value ? event.target.value as PropRuleRecord["phase"] : null })}><option value="">Не задано</option><option value="phase-1">Phase 1</option><option value="phase-2">Phase 2</option><option value="phase-3">Phase 3</option><option value="funded">Funded</option></select></label><div className="grid gap-4 md:grid-cols-2">{(Object.keys(LABELS) as (keyof typeof LABELS)[]).map(key => <ConditionField key={key} label={LABELS[key]} value={draft.settings[key]} days={key === "minTradingDays"} onChange={value => setSetting(key, value)} />)}</div>
      <label className="block space-y-2 text-xs text-white/60"><span>Режим загального ліміту</span><select className={INPUT} value={draft.settings.maxLossMode ?? ""} onChange={event => setSetting("maxLossMode", event.target.value ? event.target.value as PropRuleSettings["maxLossMode"] : null)}><option value="">Не налаштовано</option><option value="static">Статичний</option><option value="eod_trailing_percent">EOD trailing — % від максимального EOD-балансу</option></select></label>
      <div className="grid gap-4 md:grid-cols-2"><label className="space-y-2 text-xs text-white/60"><span>Часовий пояс правила, IANA</span><input className={INPUT} value={draft.settings.dayTimezone ?? ""} onChange={event => setSetting("dayTimezone", event.target.value || null)} placeholder="Не налаштовано" /></label><label className="space-y-2 text-xs text-white/60"><span>Завершення торгового дня</span><input className={INPUT} type="time" step={60} value={draft.settings.dayClose ?? ""} onChange={event => setSetting("dayClose", event.target.value || null)} /></label></div>
      <label className="block space-y-2 text-xs text-white/60"><span>Показник для контролю межі — окремо від EOD-максимуму</span><select className={INPUT} value={draft.settings.lossControlBasis ?? ""} onChange={event => setSetting("lossControlBasis", event.target.value ? event.target.value as PropRuleSettings["lossControlBasis"] : null)}><option value="">Не налаштовано</option><option value="balance">Balance</option><option value="equity">Equity</option></select></label><label className="block space-y-2 text-xs text-white/60"><span>Інші умови — примітка, без автоматичної перевірки</span><textarea className={INPUT} maxLength={2000} value={draft.settings.notes ?? ""} onChange={event => setSetting("notes", event.target.value || null)} /></label><p className="text-xs text-white/45">Funded не вимикає умови автоматично. Вибір «Не застосовується» приховує блок, але зберігає попереднє значення. Невідомі параметри можна залишити неналаштованими.</p><button type="submit" className="rounded-xl bg-teal-400 px-4 py-2 text-sm font-medium text-black">{saving ? "Збереження…" : "Зберегти умови"}</button></fieldset></form>}
    </div>}
  </section>;
}
