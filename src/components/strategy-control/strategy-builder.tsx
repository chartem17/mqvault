"use client";
import { Button, Input, Textarea } from "@/components/ui/primitives";
import { Checkbox } from "@/components/ui/checkbox";
import { STRATEGY_SURFACE } from "@/components/strategy-control/strategy-ui";
import { useState } from "react";
import { ruleLibrary } from "@/lib/strategy-control/rule-library";
import { normalizeSessionSelection, SESSION_RULE_OPTIONS } from "@/lib/time/session-selection";
import { useI18n } from "@/components/providers/i18n-provider";
import { msg } from "@/lib/i18n/core";
import type { ParamDefinition, RuleInstance, RuleType, StrategyProfile } from "@/lib/strategy-control/types";

type Props = { onSave: (strategy: StrategyProfile) => void; onCancel: () => void };
function buildDefaultRules(): RuleInstance[] {
  return (Object.keys(ruleLibrary) as RuleType[]).map(ruleType => ({ ruleType, enabled: false, params: { ...ruleLibrary[ruleType].defaultParams } }));
}
function ParamField({ definition, value, onChange }: { definition: ParamDefinition; value: unknown; onChange: (value: unknown) => void }) {
  const { t } = useI18n();
  if (definition.type === "number") return <label className="space-y-2"><div className="text-sm font-medium text-foreground">{t(definition.label)}</div><Input type="number" min={definition.min} max={definition.max} step={definition.step} value={typeof value === "number" ? value : ""} onChange={event => onChange(Number(event.target.value))}  /></label>;
  if (definition.type === "session_list" && definition.key === "sessions") {
    const selected = Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
    const selectedKeys = new Set(selected.map(normalizeSessionSelection));
    return <fieldset className="space-y-2 md:col-span-2"><legend className="text-sm font-medium text-foreground">{t(definition.label)}</legend><p className="text-xs text-muted-foreground">{t("A group allows all of its sub-sessions. The (session) mark allows only that exact sub-session. Hours follow the markets' own clocks.")}</p><div className="grid gap-2 sm:grid-cols-2">{SESSION_RULE_OPTIONS.map(option => <label key={option.value} className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm"><Checkbox checked={selectedKeys.has(option.value)} onChange={event => {
      const next = new Set(selectedKeys);
      if (event.target.checked) next.add(option.value); else next.delete(option.value);
      onChange(SESSION_RULE_OPTIONS.filter(item => next.has(item.value)).map(item => item.label));
    }}  />{option.label}</label>)}</div></fieldset>;
  }
  if (definition.type === "session_list" || definition.type === "pair_list" || definition.type === "emotion_list") {
    const selected = (value as string[]) ?? [];
    return <label className="space-y-2"><div className="text-sm font-medium text-foreground">{t(definition.label)}</div><Input type="text" value={selected.join(", ")} onChange={event => onChange(event.target.value.split(",").map(item => item.trim()).filter(Boolean))} placeholder={definition.type === "emotion_list" ? "fear, revenge, tilt" : t("Comma-separated")}  /></label>;
  }
  return null;
}
export function StrategyBuilder({ onSave, onCancel }: Props) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [rules, setRules] = useState<RuleInstance[]>(buildDefaultRules);
  const categories: Record<string, string> = { discipline: msg("Discipline"), session: msg("Sessions"), instrument: msg("Instruments"), risk: msg("Risk"), psychology: msg("Psychology"), setup: msg("Entry model") };
  function updateRule(ruleType: RuleType, updater: (rule: RuleInstance) => RuleInstance) { setRules(current => current.map(rule => rule.ruleType === ruleType ? updater(rule) : rule)); }
  function handleSave() {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    onSave({ id: `strategy-${Date.now()}`, name: trimmedName, description: description.trim(), createdAt: new Date().toISOString().slice(0, 10), rules });
  }
  return <div className="w-full rounded-3xl border border-border bg-card p-3 shadow-sm sm:p-6"><div className="grid gap-6 xl:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)]">
    <div className="space-y-5"><div className="rounded-2xl border border-border bg-muted/30 p-4 sm:p-5"><div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{t("Basic info")}</div><div className="mt-4 space-y-4"><label className="space-y-2"><div className="text-sm font-medium text-foreground">{t("Strategy name")}</div><Input value={name} onChange={event => setName(event.target.value)} placeholder={t("For example: TS Base")}  /></label><label className="space-y-2"><div className="text-sm font-medium text-foreground">{t("Description")}</div><Textarea value={description} onChange={event => setDescription(event.target.value)} rows={5} placeholder={t("Briefly describe the profile and limits of this strategy")}  /></label></div></div><div className="rounded-2xl border border-border bg-muted/30 p-4 sm:p-5"><div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{t("Actions")}</div><div className="mt-4 flex flex-wrap gap-3"><Button variant="primary" size="md" type="button" onClick={handleSave} >{t("Save strategy")}</Button><Button variant="secondary" size="md" type="button" onClick={onCancel} >{t("Cancel")}</Button></div></div></div>
    <div className="space-y-4">{(Object.keys(ruleLibrary) as RuleType[]).map(ruleType => {
      const definition = ruleLibrary[ruleType], rule = rules.find(item => item.ruleType === ruleType);
      if (!rule) return null;
      return <div key={ruleType} className={STRATEGY_SURFACE}><div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full border border-border bg-muted/40 px-2.5 py-1 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{t(categories[definition.category])}</span><span className="text-sm font-medium text-foreground">{t(definition.title)}</span></div><p className="mt-2 text-sm leading-6 text-muted-foreground">{t(definition.description)}</p></div><label className="flex items-center gap-2 text-sm text-foreground"><Checkbox checked={rule.enabled} onChange={event => updateRule(ruleType, current => ({ ...current, enabled: event.target.checked }))}  />{t("Enabled")}</label></div>{rule.enabled ? <div className="mt-4 grid gap-4 md:grid-cols-2">{definition.paramsSchema.map(param => <ParamField key={`${ruleType}-${param.key}`} definition={param} value={rule.params[param.key]} onChange={nextValue => updateRule(ruleType, current => ({ ...current, params: { ...current.params, [param.key]: nextValue } }))} />)}</div> : null}</div>;
    })}</div>
  </div></div>;
}
