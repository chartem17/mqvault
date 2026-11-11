"use client";

import { useMemo } from "react";
import { Check, ClipboardCheck } from "lucide-react";
import { useStrategies } from "@/hooks/use-strategies";
import { usePreferences } from "@/components/providers/preferences-provider";
import { useI18n } from "@/components/providers/i18n-provider";
import { AutoTextarea } from "@/components/ui/auto-textarea";
import { ruleLibrary } from "@/lib/strategy-control/rule-library";
import { msg } from "@/lib/i18n/core";

/** Items every trader confirms before the session, whatever the strategy. */
const BASE_ITEMS = [
  { id: "news", label: msg("I checked today's red news") },
  { id: "levels", label: msg("I marked my levels and bias") },
  { id: "loss", label: msg("I know my maximum loss for today") },
  { id: "state", label: msg("I am rested and calm enough to trade") },
];

/**
 * "Before you trade": a plan for the day and a tick for every rule of the active strategy. Resets every day
 * (in the user's zone); stored with the other preferences so it follows the user between devices.
 */
export function PreSessionChecklist({ today }: { today: string }) {
  const { t } = useI18n();
  const { activeStrategy } = useStrategies();
  const { preferences, update } = usePreferences();
  const items = useMemo(() => [
    ...BASE_ITEMS.map(item => ({ id: item.id, label: t(item.label) })),
    ...(activeStrategy?.rules ?? []).filter(rule => rule.enabled).map(rule => ({ id: `rule:${rule.ruleType}`, label: t("Rule: {rule}", { rule: t(ruleLibrary[rule.ruleType]?.title ?? rule.ruleType) }) })),
  ], [activeStrategy, t]);
  const current = preferences.checklist?.day === today ? preferences.checklist : { day: today, plan: "", checked: [] as string[] };
  const checked = new Set(current.checked);
  const done = items.filter(item => checked.has(item.id)).length;
  const ready = items.length > 0 && done === items.length;
  const save = (patch: Partial<typeof current>) => update({ checklist: { ...current, ...patch } });

  return <section aria-label={t("Before you trade")} className="space-y-4">
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="m-0 flex items-center gap-2 text-base font-semibold"><ClipboardCheck className="h-4 w-4 text-primary" aria-hidden="true" />{t("Before you trade")}</h2>
      <span className={`text-sm tabular-nums ${ready ? "text-green" : "text-muted-foreground"}`}>{ready ? t("Ready") : `${done}/${items.length}`}</span>
    </div>
    <label className="block space-y-1.5">
      <span className="text-xs text-muted-foreground">{t("Plan for today")}</span>
      <AutoTextarea value={current.plan} maxLength={2000} rows={2} maxRows={8} placeholder={t("Bias, key levels, what you wait for, what you skip")} onChange={event => save({ plan: event.target.value })} />
    </label>
    <ul className="m-0 space-y-1 p-0">
      {items.map(item => {
        const on = checked.has(item.id);
        return <li key={item.id} className="list-none">
          <button type="button" role="checkbox" aria-checked={on} onClick={() => save({ checked: on ? current.checked.filter(id => id !== item.id) : [...current.checked, item.id] })}
            className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-accent">
            <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${on ? "border-primary bg-primary text-primary-foreground" : "border-input"}`}>{on && <Check className="h-3.5 w-3.5" aria-hidden="true" />}</span>
            <span className={on ? "text-muted-foreground" : ""}>{item.label}</span>
          </button>
        </li>;
      })}
    </ul>
    {!activeStrategy && <p className="m-0 text-xs text-muted-foreground">{t("Pick an account with a strategy to add its rules here.")}</p>}
  </section>;
}
