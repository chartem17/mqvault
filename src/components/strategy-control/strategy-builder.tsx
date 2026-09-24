"use client";

import { useState } from "react";
import { ruleLibrary } from "@/lib/strategy-control/rule-library";
import type { ParamDefinition, RuleInstance, RuleType, StrategyProfile } from "@/lib/strategy-control/types";

type Props = {
  mode: "create" | "edit";
  initialStrategy?: StrategyProfile;
  onSave: (strategy: StrategyProfile) => void;
  onCancel: () => void;
};

function buildDefaultRules(existing?: RuleInstance[]): RuleInstance[] {
  return (Object.keys(ruleLibrary) as RuleType[]).map((ruleType) => {
    const existingRule = existing?.find((r) => r.ruleType === ruleType);
    const definition = ruleLibrary[ruleType];
    return {
      ruleType,
      enabled: existingRule?.enabled ?? false,
      params: existingRule?.params ?? { ...definition.defaultParams },
    };
  });
}

function ParamField({
  definition,
  value,
  onChange,
}: {
  definition: ParamDefinition;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  if (definition.type === "number") {
    return (
      <label className="flex items-center justify-between gap-3 text-xs text-white/55">
        {definition.label}
        <input
          type="number"
          min={definition.min}
          max={definition.max}
          step={definition.step ?? 1}
          value={Number(value ?? 0)}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-20 rounded-lg border border-white/10 bg-white/[0.05] px-2 py-1 text-right text-xs text-white outline-none"
        />
      </label>
    );
  }

  if (definition.type === "session_list" || definition.type === "pair_list") {
    const selected = (value as string[]) ?? [];
    return (
      <div className="text-xs text-white/55">
        <p className="mb-2">{definition.label}</p>
        <div className="flex flex-wrap gap-2">
          {(definition.options ?? []).map((option) => {
            const active = selected.includes(option);
            return (
              <button
                key={option}
                type="button"
                onClick={() =>
                  onChange(active ? selected.filter((v) => v !== option) : [...selected, option])
                }
                className={`rounded-full border px-3 py-1 text-xs transition ${
                  active
                    ? "border-blue-300/40 bg-blue-300/[0.14] text-blue-200"
                    : "border-white/10 bg-white/[0.03] text-white/45 hover:bg-white/[0.06]"
                }`}
              >
                {option}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return null;
}

export function StrategyBuilder({ mode, initialStrategy, onSave, onCancel }: Props) {
  const [name, setName] = useState(initialStrategy?.name ?? "");
  const [description, setDescription] = useState(initialStrategy?.description ?? "");
  const [rules, setRules] = useState<RuleInstance[]>(buildDefaultRules(initialStrategy?.rules));

  const updateRule = (ruleType: RuleType, patch: Partial<RuleInstance>) => {
    setRules((prev) => prev.map((r) => (r.ruleType === ruleType ? { ...r, ...patch } : r)));
  };

  const updateParam = (ruleType: RuleType, key: string, value: unknown) => {
    setRules((prev) =>
      prev.map((r) => (r.ruleType === ruleType ? { ...r, params: { ...r.params, [key]: value } } : r)),
    );
  };

  const handleSave = () => {
    if (!name.trim()) return;
    const strategy: StrategyProfile = {
      id: initialStrategy?.id ?? `strategy-${Date.now()}`,
      name: name.trim(),
      description: description.trim() || undefined,
      createdAt: initialStrategy?.createdAt ?? new Date().toISOString().slice(0, 10),
      rules,
    };
    onSave(strategy);
  };

  const enabledCount = rules.filter((r) => r.enabled).length;

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-black/30 p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-white">
          {mode === "create" ? "Створити нову стратегію" : `Редагувати: ${initialStrategy?.name}`}
        </h2>
        <span className="text-xs text-white/35">{enabledCount} правил увімкнено</span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-white/45">
          Назва стратегії
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Наприклад, TS Intraday Strict"
            className="mt-1 w-full rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-white outline-none"
          />
        </label>
        <label className="text-xs text-white/45">
          Опис (опційно)
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Короткий опис стратегії"
            className="mt-1 w-full rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-white outline-none"
          />
        </label>
      </div>

      <div className="mt-5 space-y-3">
        {rules.map((rule) => {
          const definition = ruleLibrary[rule.ruleType];
          return (
            <div key={rule.ruleType} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-white">{definition.title}</p>
                  <p className="mt-1 text-xs text-white/40">{definition.description}</p>
                </div>
                <label className="flex shrink-0 items-center gap-2 text-xs text-white/50">
                  <input
                    type="checkbox"
                    checked={rule.enabled}
                    onChange={(e) => updateRule(rule.ruleType, { enabled: e.target.checked })}
                    className="h-4 w-4 rounded border-white/20 bg-white/5"
                  />
                  увімкнено
                </label>
              </div>
              {rule.enabled && definition.paramsSchema.length > 0 ? (
                <div className="mt-3 space-y-2 border-t border-white/[0.05] pt-3">
                  {definition.paramsSchema.map((paramDef) => (
                    <ParamField
                      key={paramDef.key}
                      definition={paramDef}
                      value={rule.params[paramDef.key]}
                      onChange={(value) => updateParam(rule.ruleType, paramDef.key, value)}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2 text-xs text-white/60 hover:bg-white/[0.06]"
        >
          Скасувати
        </button>
        <button
          onClick={handleSave}
          disabled={!name.trim()}
          className="rounded-lg border border-blue-300/30 bg-blue-300/[0.12] px-4 py-2 text-xs text-blue-200 hover:bg-blue-300/[0.2] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {mode === "create" ? "Створити стратегію" : "Зберегти зміни"}
        </button>
      </div>
    </div>
  );
}
