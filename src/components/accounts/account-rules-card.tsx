"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useTrades, type JournalTrade } from "@/hooks/use-trades";
import type { TradingAccount } from "@/lib/account-data";
import { accountOverviewLabel, buildAccountOverview } from "@/lib/account-overview";
import { parseRuleRecord, settingsFromColumns, type PropRuleRecord } from "@/lib/prop-rule-record";
import { parsePropRuleSettings, type ConditionState, type PropRuleSettings, type RuleCondition } from "@/lib/prop-rule-settings";
import { fmt } from "@/lib/utils-trade";
const CARD = "rounded-2xl border border-white/10 bg-panel p-5";
const INPUT = "w-full rounded-xl border border-white/10 bg-panel px-3 py-2 text-sm text-white outline-none focus:border-teal-400 disabled:opacity-50";
const LABELS = { target: "Ціль прибутку, %", maxLoss: "Загальний ліміт збитку, %", dailyLoss: "Денний ліміт збитку, %", minTradingDays: "Мінімум торгових днів" } as const;
const CONDITION_KEYS = Object.keys(LABELS) as (keyof typeof LABELS)[];
class RuleHttpError extends Error { constructor(message: string, readonly status: number) { super(message); } }
async function responseRecord(response: Response, accountId: string) {
  const body = await response.json();
  if (!response.ok) throw new RuleHttpError(typeof body.error === "string" ? body.error : "Не вдалося завантажити умови", response.status);
  return parseRuleRecord(body.data, accountId);
}
function ConditionField({ label, value, days, onChange }: { label: string; value: RuleCondition; days: boolean; onChange: (value: RuleCondition) => void }) {
  return <fieldset className="space-y-2"><legend className="mb-2 text-xs text-white/60">{label}</legend><select aria-label={`${label}: застосовність`} className={INPUT} value={value.state} onChange={event => onChange({ ...value, state: event.target.value as ConditionState })}><option value="unknown">Ще не налаштовано</option><option value="not_applicable">Такої вимоги немає</option><option value="configured">Така вимога є</option></select>{value.state === "configured" && <input aria-label={`${label}: значення`} className={INPUT} type="number" min={0} max={days ? 2147483647 : 100} step={days ? 1 : "any"} value={value.value ?? ""} onChange={event => onChange({ ...value, value: event.target.value === "" ? null : Number(event.target.value) })} />}</fieldset>;
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
  const changeOpen = (open: boolean) => {
    if (busy.current) return;
    if (open) { if (!saved) return; setDraft(saved); if (!conflict) setError(null); }
    setEditing(open);
  };
  return <Dialog.Root open={editing} onOpenChange={changeOpen}>
    <section className={CARD}>
      <div className="flex flex-wrap justify-between gap-4"><div><h3 className="font-semibold text-white">{account.name}</h3><p className="mt-1 text-xs text-white/60">{accountOverviewLabel(effective)} · {account.broker || "—"} · {account.platform.toUpperCase()}</p><p className="mt-1 text-xs text-white/45">Початковий капітал: {money(summary.initialBalance)}</p></div><div className="text-right"><p className="text-xs text-white/45">Оцінка за журналом</p><p className="mt-1 text-lg font-semibold text-white">{money(summary.journalBalance)}</p><p className="mt-1 text-xs text-white/60">Net P&amp;L: {money(summary.netPnl)}</p></div></div>
      <p className="mt-3 text-xs text-white/45">Початковий капітал + net P&amp;L журналу. Це не брокерський баланс і не live equity.</p>
      {summary.netPnl === null && <p className="mt-2 text-xs text-amber-300">P&amp;L неповний; прогрес недоступний.</p>}
      {isProp && <div className="mt-4 space-y-3 border-t border-white/10 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm text-white/70">Умови проп-рахунку</p><Dialog.Trigger asChild><button type="button" disabled={!saved || loading || saving} className="rounded-xl border border-white/10 px-3 py-2 text-xs text-white disabled:opacity-40">Редагувати умови</button></Dialog.Trigger></div>
        {loading && <p className="text-xs text-white/45">Завантаження умов…</p>}
        {CONDITION_KEYS.some(key => settings[key].state === "unknown") && <p className="text-xs text-white/45">Не всі умови налаштовані. Це не означає відсутність вимог.</p>}
        <div className="grid gap-3 md:grid-cols-2">{CONDITION_KEYS.filter(key => settings[key].state === "configured").map(key => <div key={key} className="rounded-xl border border-white/10 p-3"><p className="text-xs text-white/45">{LABELS[key]}</p><p className="mt-1 text-sm text-white">{settings[key].value}</p>{key === "maxLoss" && <p className="mt-1 text-xs text-white/45">{settings.maxLossMode === "eod_trailing_percent" ? "Trailing від максимуму балансу на кінець дня" : settings.maxLossMode === "static" ? "Статичний від початкового капіталу" : "Режим розрахунку не налаштовано"}</p>}</div>)}</div>
        {settings.target.state === "configured" && summary.progressPercent !== null && <div><p className="text-xs text-white/60">Прогрес за журналом: {fmt.pct(summary.pnlPercent ?? 0)} · ціль {money(summary.targetAmount)}</p><div role="progressbar" aria-label="Прогрес за журналом" aria-valuemin={0} aria-valuemax={100} aria-valuenow={summary.progressPercent} className="mt-2 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-[var(--color-green)]" style={{ width: `${summary.progressPercent}%` }} /></div></div>}
        {settings.maxLoss.state === "configured" && settings.maxLossMode === "eod_trailing_percent" && <p className="text-xs text-amber-300">Trailing-правило збережено. Розрахунок межі ще недоступний: потрібна повна історія балансів на кінець дня.</p>}
        <p className="text-xs text-white/45">Використання лімітів і виконання мінімуму днів не підтверджуються. Автоматичних статусів проходження або провалу немає.</p>
        {settings.notes && <p className="whitespace-pre-wrap text-xs text-white/60">{settings.notes}</p>}
        {error && !editing && <p role="alert" className="text-sm text-red-300">{error}</p>}
        <button type="button" disabled={loading || saving} onClick={() => void load()} className="text-xs text-white/60 underline disabled:opacity-40">Оновити умови</button>
      </div>}
    </section>
    {isProp && draft && <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70" />
      <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[90dvh] w-[calc(100vw-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-white/10 bg-panel p-5 text-white shadow-2xl focus:outline-none" onEscapeKeyDown={event => { if (busy.current) event.preventDefault(); }} onPointerDownOutside={event => { if (busy.current) event.preventDefault(); }}>
        <div className="flex items-start justify-between gap-4"><div><Dialog.Title className="text-lg font-semibold">Умови рахунку</Dialog.Title><Dialog.Description className="mt-1 text-sm text-white/60">{account.name}. Вкажіть лише вимоги своєї програми. Зміни застосовуються після збереження.</Dialog.Description></div><Dialog.Close asChild><button type="button" disabled={saving} aria-label="Закрити без збереження" className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/60 disabled:opacity-40">Закрити</button></Dialog.Close></div>
        <form noValidate onSubmit={event => { event.preventDefault(); void save(); }} className="mt-5 space-y-5">
          <fieldset disabled={saving || loading || conflict} className="space-y-5">
            <label className="block space-y-2 text-xs text-white/60"><span>Етап рахунку — необов’язкова позначка</span><select className={INPUT} value={draft.phase ?? ""} onChange={event => setDraft({ ...draft, phase: event.target.value ? event.target.value as PropRuleRecord["phase"] : null })}><option value="">Не задано</option><option value="phase-1">Phase 1</option><option value="phase-2">Phase 2</option><option value="phase-3">Phase 3</option><option value="funded">Funded</option></select></label>
            <div className="grid gap-4 md:grid-cols-2">{CONDITION_KEYS.map(key => <ConditionField key={key} label={LABELS[key]} value={draft.settings[key]} days={key === "minTradingDays"} onChange={value => setSetting(key, value)} />)}</div>
            {draft.settings.maxLoss.state === "configured" && <div className="space-y-2"><label className="block space-y-2 text-xs text-white/60"><span>Як визначається загальний ліміт збитку?</span><select className={INPUT} value={draft.settings.maxLossMode ?? ""} onChange={event => setSetting("maxLossMode", event.target.value ? event.target.value as PropRuleSettings["maxLossMode"] : null)}><option value="">Ще не налаштовано</option><option value="static">Статичний — від початкового капіталу</option><option value="eod_trailing_percent">Trailing — від максимуму балансу на кінець дня</option></select></label>{draft.settings.maxLossMode === "eod_trailing_percent" && <p className="text-xs leading-5 text-white/55">Беремо найбільший баланс серед завершених торгових днів, без відкритого P&amp;L. Приклад для ліміту 5%: максимум 10 400 дає межу 9 880. Зараз зберігається правило; розрахунок за брокерською історією ще недоступний.</p>}</div>}
            <details className="rounded-xl border border-white/10 p-3"><summary className="cursor-pointer text-sm text-white/75">Додаткові параметри правил</summary><div className="mt-4 space-y-4"><p className="text-xs leading-5 text-white/45">Можна залишити неналаштованими. Ці параметри потрібні для подальшого контролю лімітів; ми не вгадуємо їх за назвою фази або часовим поясом пристрою.</p><div className="grid gap-4 md:grid-cols-2"><label className="space-y-2 text-xs text-white/60"><span>Часовий пояс правила, IANA</span><input className={INPUT} value={draft.settings.dayTimezone ?? ""} onChange={event => setSetting("dayTimezone", event.target.value || null)} placeholder="Не налаштовано" /></label><label className="space-y-2 text-xs text-white/60"><span>Коли завершується торговий день</span><input className={INPUT} type="time" step={60} value={draft.settings.dayClose ?? ""} onChange={event => setSetting("dayClose", event.target.value || null)} /></label></div><label className="block space-y-2 text-xs text-white/60"><span>Що порівнювати з межею збитку?</span><select className={INPUT} value={draft.settings.lossControlBasis ?? ""} onChange={event => setSetting("lossControlBasis", event.target.value ? event.target.value as PropRuleSettings["lossControlBasis"] : null)}><option value="">Ще не налаштовано</option><option value="balance">Balance — баланс</option><option value="equity">Equity — з урахуванням відкритих позицій</option></select></label><p className="text-xs text-white/45">Це окреме правило контролю, а не спосіб визначення EOD-максимуму.</p><label className="block space-y-2 text-xs text-white/60"><span>Інші умови — примітка, без автоматичної перевірки</span><textarea className={INPUT} maxLength={2000} value={draft.settings.notes ?? ""} onChange={event => setSetting("notes", event.target.value || null)} /></label></div></details>
            <p className="text-xs leading-5 text-white/45">Funded не підставляє правила автоматично. Вибір «Такої вимоги немає» прибирає її з картки, але не стирає раніше задане значення.</p>
          </fieldset>
          {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
          {conflict && <p className="text-xs text-white/60">Збереження заблоковано, щоб не перезаписати новіші умови. Перечитайте їх кнопкою нижче.</p>}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4"><button type="button" disabled={loading || saving} onClick={() => void load()} className="text-xs text-white/60 underline disabled:opacity-40">Скинути зміни та перечитати</button><div className="flex gap-2"><Dialog.Close asChild><button type="button" disabled={saving} className="rounded-xl border border-white/10 px-4 py-2 text-sm disabled:opacity-40">Скасувати</button></Dialog.Close><button type="submit" disabled={saving || loading || conflict} className="rounded-xl bg-teal-400 px-4 py-2 text-sm font-medium text-black disabled:opacity-40">{saving ? "Збереження…" : "Зберегти"}</button></div></div>
        </form>
      </Dialog.Content>
    </Dialog.Portal>}
  </Dialog.Root>;
}
