"use client";
import { dialogSurface, DIALOG_BACKDROP } from "@/components/ui/dialog-styles";
import { Button, Input, Select } from "@/components/ui/primitives";
import { useCallback, useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useTrades, type JournalTrade } from "@/hooks/use-trades";
import type { TradingAccount } from "@/lib/account-data";
import { accountOverviewLabel, buildAccountOverview } from "@/lib/account-overview";
import { parseRuleRecord, settingsFromColumns, type PropRuleRecord } from "@/lib/prop-rule-record";
import { parsePropRuleSettings, type ConditionState, type PropRuleSettings, type RuleCondition } from "@/lib/prop-rule-settings";
import { fmt } from "@/lib/utils-trade";
import { FORM_SURFACE as CARD } from "@/components/ui/form-styles";
import { AccountChainCard } from "@/components/accounts/account-chain-card";
const LABELS = { target: "Ціль прибутку, %", maxLoss: "Загальний ліміт збитку, %", dailyLoss: "Денний ліміт збитку, %", minTradingDays: "Мінімум торгових днів" } as const;
const CONDITION_KEYS = Object.keys(LABELS) as (keyof typeof LABELS)[];
class RuleHttpError extends Error { constructor(message: string, readonly status: number) { super(message); } }
async function responseRecord(response: Response, accountId: string) {
  const body = await response.json();
  if (!response.ok) throw new RuleHttpError(typeof body.error === "string" ? body.error : "Не вдалося завантажити умови", response.status);
  return parseRuleRecord(body.data, accountId);
}
function ConditionField({ label, value, days, onChange }: { label: string; value: RuleCondition; days: boolean; onChange: (value: RuleCondition) => void }) {
  return <fieldset className="space-y-2"><legend className="mb-2 text-xs text-muted-foreground">{label}</legend><Select aria-label={`${label}: застосовність`}  value={value.state} onChange={event => onChange({ ...value, state: event.target.value as ConditionState })}><option value="unknown">Ще не налаштовано</option><option value="not_applicable">Такої вимоги немає</option><option value="configured">Така вимога є</option></Select>{value.state === "configured" && <Input aria-label={`${label}: значення`}  type="number" min={0} max={days ? 2147483647 : 100} step={days ? 1 : "any"} value={value.value ?? ""} onChange={event => onChange({ ...value, value: event.target.value === "" ? null : Number(event.target.value) })} />}</fieldset>;
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
  if (accountId === "all") return <div className={CARD}><div className="text-sm text-foreground">Усі вибрані рахунки</div><p className="mt-1 text-sm text-muted-foreground">Зведена статистика. Спільний проп-ліміт не обчислюється.</p></div>;
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
  return <><Dialog.Root open={editing} onOpenChange={changeOpen}>
    <section className={CARD}>
      <div className="flex flex-wrap justify-between gap-4"><div><h3 className="font-semibold text-foreground">{account.name}</h3><p className="mt-1 text-xs text-muted-foreground">{accountOverviewLabel(effective)} · {account.broker || "—"} · {account.platform.toUpperCase()}</p><p className="mt-1 text-xs text-muted-foreground">Початковий капітал: {money(summary.initialBalance)}</p></div><div className="text-right"><p className="text-xs text-muted-foreground">Оцінка за журналом</p><p className="mt-1 text-lg font-semibold text-foreground">{money(summary.journalBalance)}</p><p className="mt-1 text-xs text-muted-foreground">Net P&L: {money(summary.netPnl)}</p></div></div>
      <p className="mt-3 text-xs text-muted-foreground">Початковий капітал + net P&L журналу. Це не брокерський баланс і не live equity.</p>
      {summary.netPnl === null && <p className="mt-2 text-xs text-gold">P&L неповний; прогрес недоступний.</p>}
      {isProp && <div className="mt-4 space-y-3 border-t border-border pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm text-foreground">Умови проп-рахунку</p><Dialog.Trigger asChild><Button variant="secondary" size="sm" type="button" disabled={!saved || loading || saving} >Редагувати умови</Button></Dialog.Trigger></div>
        {loading && <p className="text-xs text-muted-foreground">Завантаження умов…</p>}
        {CONDITION_KEYS.some(key => settings[key].state === "unknown") && <p className="text-xs text-muted-foreground">Не всі умови налаштовані. Це не означає відсутність вимог.</p>}
        <div className="grid gap-3 md:grid-cols-2">{CONDITION_KEYS.filter(key => settings[key].state === "configured").map(key => <div key={key} className="rounded-xl border border-border p-3"><p className="text-xs text-muted-foreground">{LABELS[key]}</p><p className="mt-1 text-sm text-foreground">{settings[key].value}</p></div>)}</div>
        {settings.target.state === "configured" && summary.progressPercent !== null && <div><p className="text-xs text-muted-foreground">Прогрес за журналом: {fmt.pct(summary.pnlPercent ?? 0)} · ціль {money(summary.targetAmount)}</p><div role="progressbar" aria-label="Прогрес за журналом" aria-valuemin={0} aria-valuemax={100} aria-valuenow={summary.progressPercent} className="mt-2 h-2 overflow-hidden rounded-full bg-secondary"><div className="h-full bg-[var(--color-green)]" style={{ width: `${summary.progressPercent}%` }} /></div></div>}
        <p className="text-xs text-muted-foreground">Використання лімітів і виконання мінімуму днів не підтверджуються. Автоматичних статусів проходження або провалу немає.</p>
        {error && !editing && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button variant="ghost" size="sm" type="button" disabled={loading || saving} onClick={() => void load()} >Оновити умови</Button>
      </div>}
    </section>
    {isProp && draft && <Dialog.Portal>
      <Dialog.Overlay className={`${DIALOG_BACKDROP} fixed inset-0 z-50`} />
      <Dialog.Content className={dialogSurface("fixed left-1/2 top-1/2 z-50 max-h-[90dvh] w-[calc(100vw-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto p-5 focus:outline-none")} onEscapeKeyDown={event => { if (busy.current) event.preventDefault(); }} onPointerDownOutside={event => { if (busy.current) event.preventDefault(); }}>
        <div className="flex items-start justify-between gap-4"><div><Dialog.Title className="text-lg font-semibold">Умови рахунку</Dialog.Title><Dialog.Description className="mt-1 text-sm text-muted-foreground">{account.name}. Вкажіть лише вимоги своєї програми. Зміни застосовуються після збереження.</Dialog.Description></div><Dialog.Close asChild><Button variant="secondary" size="sm" type="button" disabled={saving} aria-label="Закрити без збереження" >Закрити</Button></Dialog.Close></div>
        <form noValidate onSubmit={event => { event.preventDefault(); void save(); }} className="mt-5 space-y-5">
          <fieldset disabled={saving || loading || conflict} className="space-y-5">
            <label className="block space-y-2 text-xs text-muted-foreground"><span>Етап рахунку — необов’язкова позначка</span><Select  value={draft.phase ?? ""} onChange={event => setDraft({ ...draft, phase: event.target.value ? event.target.value as PropRuleRecord["phase"] : null })}><option value="">Не задано</option><option value="phase-1">Phase 1</option><option value="phase-2">Phase 2</option><option value="phase-3">Phase 3</option><option value="funded">Funded</option></Select></label>
            <div className="grid gap-4 md:grid-cols-2">{CONDITION_KEYS.map(key => <ConditionField key={key} label={LABELS[key]} value={draft.settings[key]} days={key === "minTradingDays"} onChange={value => setSetting(key, value)} />)}</div>
            <p className="text-xs leading-5 text-muted-foreground">Funded не підставляє правила автоматично. Вибір «Такої вимоги немає» прибирає її з картки, але не стирає раніше задане значення. Ліміти збитку тут лише зберігаються як ваші умови: програма їх не перевіряє.</p>
          </fieldset>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          {conflict && <p className="text-xs text-muted-foreground">Збереження заблоковано, щоб не перезаписати новіші умови. Перечитайте їх кнопкою нижче.</p>}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4"><Button variant="ghost" size="sm" type="button" disabled={loading || saving} onClick={() => void load()} >Скинути зміни та перечитати</Button><div className="flex gap-2"><Dialog.Close asChild><Button variant="secondary" size="md" type="button" disabled={saving} >Скасувати</Button></Dialog.Close><Button variant="primary" size="md" type="submit" disabled={saving || loading || conflict} >{saving ? "Збереження…" : "Зберегти"}</Button></div></div>
        </form>
      </Dialog.Content>
    </Dialog.Portal>}
  </Dialog.Root>{isProp && <AccountChainCard account={account} />}</>;
}
