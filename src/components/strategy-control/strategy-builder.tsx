"use client";

import { useState } from "react";
import { ruleLibrary } from "@/lib/strategy-control/rule-library";
import type {
  ParamDefinition,
  RuleInstance,
  RuleType,
  StrategyProfile,
} from "@/lib/strategy-control/types";

type Props = {
  onSave: (strategy: StrategyProfile) => void;
  onCancel: () => void;
};

function buildDefaultRules(): RuleInstance[] {
  return (Object.keys(ruleLibrary) as RuleType[]).map((ruleType) => {
    const definition = ruleLibrary[ruleType];
    return {
      ruleType,
      enabled: false,
      params: { ...definition.defaultParams },
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
      <label className="space-y-2">
        <div className="text-sm font-medium text-foreground">
          {definition.label}
        </div>
        <input
          type="number"
          value={typeof value === "number" ? value : ""}
          onChange={(event) => onChange(Number(event.target.value))}
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none"
        />
      </label>
    );
  }

  if (definition.type === "session_list" || definition.type === "pair_list") {
    const selected = (value as string[]) ?? [];
    return (
      <label className="space-y-2">
        <div className="text-sm font-medium text-foreground">
          {definition.label}
        </div>
        <input
          type="text"
          value={selected.join(", ")}
          onChange={(event) =>
            onChange(
              event.target.value
                .split(",")
                .map((item) => item.trim())
                .filter(Boolean),
            )
          }
          placeholder="Через кому"
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none"
        />
      </label>
    );
  }

  if (definition.type === "emotion_list") {
    const selected = (value as string[]) ?? [];
    return (
      <label className="space-y-2">
        <div className="text-sm font-medium text-foreground">
          {definition.label}
        </div>
        <input
          type="text"
          value={selected.join(", ")}
          onChange={(event) =>
            onChange(
              event.target.value
                .split(",")
                .map((item) => item.trim())
                .filter(Boolean),
            )
          }
          placeholder="fear, revenge, tilt"
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none"
        />
      </label>
    );
  }

  return null;
}

export function StrategyBuilder({ onSave, onCancel }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [rules, setRules] = useState<RuleInstance[]>(buildDefaultRules());

  const categories: Record<string, string> = {
    discipline: "Дисципліна",
    session: "Сесії",
    instrument: "Інструменти",
    risk: "Ризик",
    psychology: "Психологія",
  };

  function updateRule(
    ruleType: RuleType,
    updater: (rule: RuleInstance) => RuleInstance,
  ) {
    setRules((current) =>
      current.map((rule) =>
        rule.ruleType === ruleType ? updater(rule) : rule,
      ),
    );
  }

  function handleSave() {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    const strategy: StrategyProfile = {
      id: `strategy-${Date.now()}`,
      name: trimmedName,
      description: description.trim(),
      createdAt: new Date().toISOString().slice(0, 10),
      rules,
    };

    onSave(strategy);
  }

  return (
    <div className="w-full rounded-3xl border border-border bg-card p-6 shadow-sm">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)]">
        <div className="space-y-5">
          <div className="rounded-2xl border border-border bg-muted/30 p-5">
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Базова інформація
            </div>

            <div className="mt-4 space-y-4">
              <label className="space-y-2">
                <div className="text-sm font-medium text-foreground">
                  Назва стратегії
                </div>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Наприклад: TS Base"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none"
                />
              </label>

              <label className="space-y-2">
                <div className="text-sm font-medium text-foreground">Опис</div>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={5}
                  placeholder="Коротко опиши профіль і межі цієї стратегії"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none"
                />
              </label>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-muted/30 p-5">
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Дії
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleSave}
                className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-300"
              >
                Зберегти стратегію
              </button>

              <button
                type="button"
                onClick={onCancel}
                className="rounded-xl border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
              >
                Скасувати
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {(Object.keys(ruleLibrary) as RuleType[]).map((ruleType) => {
            const definition = ruleLibrary[ruleType];
            const rule = rules.find((item) => item.ruleType === ruleType);
            if (!rule) return null;

            return (
              <div
                key={ruleType}
                className="rounded-2xl border border-border bg-card p-5 shadow-sm"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-border bg-muted/40 px-2.5 py-1 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                        {categories[definition.category]}
                      </span>
                      <span className="text-sm font-medium text-foreground">
                        {definition.title}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {definition.description}
                    </p>
                  </div>

                  <label className="flex items-center gap-2 text-sm text-foreground">
                    <input
                      type="checkbox"
                      checked={rule.enabled}
                      onChange={(event) =>
                        updateRule(ruleType, (current) => ({
                          ...current,
                          enabled: event.target.checked,
                        }))
                      }
                      className="h-4 w-4 rounded border-border"
                    />
                    Увімкнено
                  </label>
                </div>

                {rule.enabled ? (
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    {definition.paramsSchema.map((param) => (
                      <ParamField
                        key={`${ruleType}-${param.key}`}
                        definition={param}
                        value={rule.params[param.key]}
                        onChange={(nextValue) =>
                          updateRule(ruleType, (current) => ({
                            ...current,
                            params: {
                              ...current.params,
                              [param.key]: nextValue,
                            },
                          }))
                        }
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
