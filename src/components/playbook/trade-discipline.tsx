"use client";

import { useState } from "react";
import { useI18n } from "@/components/providers/i18n-provider";
import { useTimezone } from "@/components/providers/timezone-provider";
import { useTrades, type JournalTrade } from "@/hooks/use-trades";
import { Button, Select } from "@/components/ui/primitives";
import { Checkbox } from "@/components/ui/checkbox";
import { fmt } from "@/lib/journal/utils-trade";
import { formatDateTimeOrDash } from "@/lib/time/timezone";
import { MANUAL_VIOLATIONS, VIOLATION_LABEL, type TradeAssessment, type TradeDiscipline } from "@/lib/playbook/discipline";

type Draft = Pick<TradeDiscipline, "violations" | "stagnation" | "exception">;

function Editor({ trade, onDone }: { trade: JournalTrade; onDone: () => void }) {
  const { t } = useI18n();
  const { updateTrade } = useTrades();
  const [draft, setDraft] = useState<Draft>({ violations: trade.discipline?.violations ?? [], stagnation: trade.discipline?.stagnation ?? false, exception: trade.discipline?.exception ?? null });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toggle = (code: Draft["violations"][number]) => setDraft(current => ({ ...current, violations: current.violations.includes(code) ? current.violations.filter(item => item !== code) : [...current.violations, code] }));
  async function save() {
    setSaving(true); setError(null);
    try { await updateTrade({ id: trade.id, discipline: { ...draft, note: trade.discipline?.note ?? "" } }); onDone(); }
    catch (reason) { setError(reason instanceof Error ? t(reason.message) : t("Could not save")); } finally { setSaving(false); }
  }
  return <div className="space-y-3 rounded-xl border border-border p-3">
    <fieldset className="m-0 border-0 p-0"><legend className="mb-2 text-xs text-muted-foreground">{t("Violations you know of (the rest is found automatically)")}</legend>
      <div className="grid gap-2 sm:grid-cols-2">{MANUAL_VIOLATIONS.map(code => <label key={code} className="flex items-center gap-2 text-sm"><Checkbox checked={draft.violations.includes(code)} onChange={() => toggle(code)} />{t(VIOLATION_LABEL[code])}</label>)}</div>
    </fieldset>
    <label className="flex items-center gap-2 text-sm"><Checkbox checked={draft.stagnation} onChange={event => setDraft(current => ({ ...current, stagnation: event.target.checked }))} />{t("Stagnation: held to SL/TP, not closed at zero")}</label>
    <label className="flex flex-wrap items-center gap-2 text-sm"><span className="text-muted-foreground">{t("Risk above the base as")}</span>
      <Select className="max-w-xs" value={draft.exception ?? ""} onChange={event => setDraft(current => ({ ...current, exception: event.target.value === "add_on" || event.target.value === "metal_lot" ? event.target.value : null }))}>
        <option value="">{t("not an exception")}</option><option value="add_on">{t("Add-on (main position at break-even)")}</option><option value="metal_lot">{t("Metals: lot size limit")}</option>
      </Select></label>
    {error && <p role="alert" className="m-0 text-sm text-red">{error}</p>}
    <div className="flex justify-end gap-2"><Button size="sm" variant="secondary" onClick={onDone}>{t("Cancel")}</Button><Button size="sm" onClick={save} loading={saving}>{t("Save")}</Button></div>
  </div>;
}

/** Recent trades with their discipline mark: on plan or not, why, and the manual marks. */
export function TradeDisciplineList({ trades, assessed }: { trades: JournalTrade[]; assessed: ReadonlyMap<string, TradeAssessment> }) {
  const { t, intl } = useI18n();
  const { timezone } = useTimezone();
  const [open, setOpen] = useState<string | null>(null);
  const recent = [...trades].sort((a, b) => b.opened_at.localeCompare(a.opened_at)).slice(0, 30);
  if (!recent.length) return <p className="m-0 text-sm text-muted-foreground">{t("No trades yet.")}</p>;
  return <ul className="m-0 divide-y divide-border/60 p-0">
    {recent.map(trade => {
      const mark = assessed.get(trade.id);
      return <li key={trade.id} className="list-none space-y-2 py-3">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
          <span className="text-sm">{trade.symbol} <span className="text-xs text-muted-foreground">{formatDateTimeOrDash(trade.opened_at, timezone, intl)}</span>
            {typeof trade.result_r === "number" && <span className={`ml-2 text-xs tabular-nums ${trade.result_r > 0 ? "text-green" : trade.result_r < 0 ? "text-red" : "text-muted-foreground"}`}>{fmt.r(trade.result_r)}</span>}</span>
          <span className="flex flex-wrap items-center gap-1.5">
            <span className={`rounded-md border px-1.5 py-0.5 text-xs ${mark?.onPlan ? "border-green/40 bg-green/10 text-green" : "border-red/30 bg-red/10 text-red"}`}>{mark?.onPlan ? t("On plan") : t("Off plan")}</span>
            {mark?.stagnation && <span className="rounded-md border border-gold/40 bg-gold/10 px-1.5 py-0.5 text-xs text-gold">{t("stagnation")}</span>}
            <Button size="sm" variant="ghost" onClick={() => setOpen(open === trade.id ? null : trade.id)}>{t("Marks")}</Button>
          </span>
        </div>
        {mark && mark.violations.length > 0 && <ul className="m-0 flex flex-wrap gap-1.5 p-0">{mark.violations.map(item => <li key={item.code} className="list-none rounded-md bg-accent px-1.5 py-0.5 text-xs text-muted-foreground">{t(VIOLATION_LABEL[item.code])}{item.auto && <span className="ml-1 opacity-70">· {t("auto")}</span>}</li>)}</ul>}
        {open === trade.id && <Editor trade={trade} onDone={() => setOpen(null)} />}
      </li>;
    })}
  </ul>;
}
