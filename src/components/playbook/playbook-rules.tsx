"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Pencil, RotateCcw } from "lucide-react";
import { useI18n } from "@/components/providers/i18n-provider";
import { Button, Input } from "@/components/ui/primitives";
import { Checkbox } from "@/components/ui/checkbox";
import { DEFAULT_PLAYBOOK, sanitizePlaybook, type PlaybookConfig } from "@/lib/playbook/config";
import { msg } from "@/lib/i18n/core";

/** Entry model and trade management: the trader's own words, no numbers to edit. */
const ENTRY_MODEL = [
  msg("1H/4H context: order flow direction and a target."),
  msg("Context POI: an FVG, a swing or a compression, fully swept."),
  msg("Liquidity taken beyond a fractal."),
  msg("Reaction with an imbalance (FVG)."),
  msg("BOS: a candle body closes beyond the fractal on M5/M15."),
  msg("Limit order on the test of this FVG. M3 only refines the FVG of an already valid M5/M15 setup — looking on M3 for a model that M5 does not show is forbidden."),
  msg("Stop beyond the extreme of the sweep. Target — a specific level."),
];
const FRACTAL = msg("Fractal: 3 candles, the middle one has its extreme beyond both neighbours; confirmed after the 3rd candle closes. If a neighbour has an equal high/low — check the higher timeframe.");
const MANAGEMENT = [
  msg("Stop or take profit. Partial closes — rarely."),
  msg("Break-even only after 1–1.5R and when the price is in a problem zone (opposite POI or level)."),
  msg("The target is never moved further during the trade."),
  msg("Stagnation (temporary rule): hold to the stop or the target, do not close at zero by hand; tag such trades “stagnation”."),
];

function Block({ title, children }: { title: string; children: ReactNode }) {
  return <section className="space-y-3"><h3 className="m-0 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>{children}</section>;
}
const List = ({ items }: { items: string[] }) => <ul className="m-0 space-y-2 pl-5 text-sm leading-relaxed marker:text-muted-foreground">{items.map(item => <li key={item}>{item}</li>)}</ul>;

type NumberKey = "maxTradesPerDay" | "maxLossesPerDay" | "baseRiskPct" | "reducedRiskPct" | "lossesToReduce" | "winsToRestore" | "maxRiskPct" | "minRR" | "breakevenR";
const NUMBER_FIELDS: { key: NumberKey; label: string; step: number }[] = [
  { key: "maxTradesPerDay", label: msg("Trades per day"), step: 1 },
  { key: "maxLossesPerDay", label: msg("Stops per day before the block"), step: 1 },
  { key: "baseRiskPct", label: msg("Base risk, %"), step: 0.05 },
  { key: "reducedRiskPct", label: msg("Reduced risk, %"), step: 0.05 },
  { key: "lossesToReduce", label: msg("Losses in a row to reduce"), step: 1 },
  { key: "winsToRestore", label: msg("Wins at reduced risk to restore"), step: 1 },
  { key: "maxRiskPct", label: msg("Maximum risk for exceptions, %"), step: 0.05 },
  { key: "minRR", label: msg("Minimum RR"), step: 0.1 },
  { key: "breakevenR", label: msg("Break-even below |R|"), step: 0.05 },
];

/** Every rule of the trading system, readable, with its numbers taken from the one stored config. */
export function PlaybookRules({ config, onSave }: { config: PlaybookConfig; onSave: (next: PlaybookConfig | null) => void }) {
  const { t } = useI18n();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(config);
  useEffect(() => { if (!editing) setDraft(config); }, [config, editing]);

  const windows = config.windows.map(window => `${window.start}–${window.end} · ${t(window.label)}${window.entries ? "" : ` — ${t("no entries")}`}`);
  return <div className="space-y-8">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="m-0 text-sm text-muted-foreground">{t("All times on the {zone} clock.", { zone: config.timezone })}</p>
      {!editing && <Button size="sm" variant="secondary" onClick={() => setEditing(true)}><Pencil className="h-4 w-4" aria-hidden="true" />{t("Edit numbers")}</Button>}
    </div>

    {editing && <form className="space-y-5 rounded-2xl border border-border p-4" onSubmit={event => { event.preventDefault(); onSave(sanitizePlaybook(draft)); setEditing(false); }}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {NUMBER_FIELDS.map(field => <label key={field.key} className="space-y-1"><span className="text-xs text-muted-foreground">{t(field.label)}</span>
          <Input type="number" step={field.step} value={draft[field.key]} onChange={event => setDraft(current => ({ ...current, [field.key]: Number(event.target.value) }))} /></label>)}
      </div>
      <fieldset className="m-0 space-y-3 border-0 p-0">
        <legend className="mb-2 text-xs text-muted-foreground">{t("Trading windows")}</legend>
        {draft.windows.map((window, index) => <div key={window.id} className="grid grid-cols-[minmax(0,1fr)_6.5rem_6.5rem] items-center gap-3 sm:grid-cols-[minmax(0,1fr)_7rem_7rem_auto]">
          <span className="truncate text-sm">{t(window.label)}</span>
          <Input type="time" aria-label={t("Start")} value={window.start} onChange={event => setDraft(current => ({ ...current, windows: current.windows.map((item, i) => i === index ? { ...item, start: event.target.value } : item) }))} />
          <Input type="time" aria-label={t("End")} value={window.end} onChange={event => setDraft(current => ({ ...current, windows: current.windows.map((item, i) => i === index ? { ...item, end: event.target.value } : item) }))} />
          <label className="col-span-3 flex items-center gap-2 text-sm sm:col-span-1"><Checkbox checked={window.entries} onChange={event => setDraft(current => ({ ...current, windows: current.windows.map((item, i) => i === index ? { ...item, entries: event.target.checked } : item) }))} />{t("Entries")}</label>
        </div>)}
      </fieldset>
      <div className="flex flex-wrap justify-between gap-3">
        <Button variant="ghost" size="sm" onClick={() => setDraft(DEFAULT_PLAYBOOK)}><RotateCcw className="h-4 w-4" aria-hidden="true" />{t("Defaults")}</Button>
        <div className="flex gap-3"><Button variant="secondary" onClick={() => setEditing(false)}>{t("Cancel")}</Button><Button type="submit">{t("Save")}</Button></div>
      </div>
    </form>}

    <Block title={t("Daily limits")}>
      <List items={[t("At most {count} trades a day.", { count: config.maxTradesPerDay }), t("{count} stops in a day — trading is blocked until the next day.", { count: config.maxLossesPerDay })]} />
    </Block>
    <Block title={t("Trading windows")}>
      <List items={[...windows, t("After the last window — no new entries. Evening and night are forbidden.")]} />
    </Block>
    <Block title={t("Risk")}>
      <List items={[
        t("Base risk {pct}%.", { pct: config.baseRiskPct }),
        t("{count} losses in a row → {pct}%.", { count: config.lossesToReduce, pct: config.reducedRiskPct }),
        t("Back to {base}% after {count} winning trades at {reduced}%.", { base: config.baseRiskPct, count: config.winsToRestore, reduced: config.reducedRiskPct }),
        t("Risk above {pct}% only as an add-on (the main position is already at break-even) or for metals because of lot limits. Such trades carry a flag.", { pct: config.baseRiskPct }),
        t("No 0.7% or 0.5% entries “because I am not sure”: the checklist is not passed — there is no trade."),
      ]} />
    </Block>
    <Block title={t("Entry model")}>
      <List items={[...ENTRY_MODEL.map(item => t(item)), t("RR at least {min}.", { min: config.minRR })]} />
      <p className="m-0 rounded-xl bg-accent/60 px-3 py-2 text-sm leading-relaxed">{t(FRACTAL)}</p>
    </Block>
    <Block title={t("Trade management")}><List items={MANAGEMENT.map(item => t(item))} /></Block>
  </div>;
}
