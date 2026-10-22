"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  AlertTriangle,
  TrendingUp,
  Target,
  Scale,
  X,
} from "lucide-react";

import { useTrades } from "@/hooks/use-trades";
import { analyzeTrades } from "@/lib/strategy-control/engine";
import { mockStrategies } from "@/lib/strategy-control/mock-strategies";
import { ruleLibrary } from "@/lib/strategy-control/rule-library";
import { toStrategyControlTrade } from "@/lib/strategy-control/trade-adapter";
import type {
  RuleFinding,
  RuleInstance,
  RuleStatus,
  StrategyProfile,
} from "@/lib/strategy-control/types";
import { StrategyBuilder } from "@/components/strategy-control/strategy-builder";

const statusTone: Record<
  RuleStatus,
  {
    chip: string;
    card: string;
    label: string;
  }
> = {
  ok: {
    chip: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    card: "border-border bg-card",
    label: "OK",
  },
  warning: {
    chip: "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    card: "border-amber-500/20 bg-amber-500/5 dark:bg-amber-500/10",
    label: "Потребує уваги",
  },
  critical: {
    chip: "border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-300",
    card: "border-rose-500/20 bg-rose-500/5 dark:bg-rose-500/10",
    label: "Негативний вплив",
  },
  insufficient: {
    chip: "border-slate-500/20 bg-slate-500/10 text-slate-700 dark:text-slate-300",
    card: "border-border bg-card",
    label: "Мала вибірка",
  },
};

const impactTone: Record<string, string> = {
  positive:
    "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  negative:
    "border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  neutral:
    "border-slate-500/20 bg-slate-500/10 text-slate-700 dark:text-slate-300",
  unknown:
    "border-slate-500/20 bg-slate-500/10 text-slate-700 dark:text-slate-300",
};

const statusLabel: Record<RuleStatus, string> = {
  ok: "OK",
  warning: "Потребує уваги",
  critical: "Негативний вплив",
  insufficient: "Мала вибірка",
};

function formatPct(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) return "—";
  return `${value}%`;
}

function formatR(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}R`;
}

function formatDateInput(value: Date) {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateLabel(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}.${month}.${year}`;
}

function getDefaultRange() {
  const end = new Date();
  const start = new Date(end);
  start.setMonth(start.getMonth() - 3);

  return {
    start: formatDateInput(start),
    end: formatDateInput(end),
  };
}

function metricTone(value: number | null | undefined) {
  if (typeof value !== "number") return "text-foreground";
  if (value > 0) return "text-emerald-700 dark:text-emerald-300";
  if (value < 0) return "text-rose-700 dark:text-rose-300";
  return "text-foreground";
}

function formatRuleParams(rule: RuleInstance) {
  switch (rule.ruleType) {
    case "max_trades_per_day":
      return `(${rule.params.limit}/день)`;
    case "max_losses_per_day":
      return `(${rule.params.limit}/день)`;
    case "allowed_sessions":
      return `(${((rule.params.sessions as string[]) ?? []).join(", ")})`;
    case "core_instruments":
      return `(${((rule.params.pairs as string[]) ?? []).join(", ")})`;
    case "risk_range":
      return `(${rule.params.min_pct}% - ${rule.params.max_pct}%)`;
    case "min_planned_rr":
      return `(${rule.params.min_rr}R)`;
    case "high_risk_requires_rr":
      return `(${rule.params.risk_threshold_pct}% - ${rule.params.min_rr}R)`;
    case "risk_escalation_after_loss":
      return `(x${rule.params.escalation_factor})`;
    case "emotion_filter":
      return `(${((rule.params.states as string[]) ?? []).join(", ")})`;
    default:
      return "";
  }
}

function StatCard({
  label,
  value,
  hint,
  icon,
  valueTone,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ReactNode;
  valueTone?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </span>
        <span className="text-muted-foreground">{icon}</span>
      </div>
      <div
        className={`text-3xl font-semibold tracking-tight ${valueTone ?? "text-foreground"}`}
      >
        {value}
      </div>
      {hint ? (
        <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

function RuleCard({
  finding,
  rule,
  onOpen,
}: {
  finding: RuleFinding;
  rule?: RuleInstance;
  onOpen: () => void;
}) {
  const status = statusTone[finding.status];
  const impactClass = impactTone[finding.impactStatus] ?? impactTone.unknown;

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`w-full rounded-2xl border p-5 text-left transition hover:border-foreground/15 hover:bg-accent/40 ${status.card}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold text-foreground">
            {finding.title} {rule ? formatRuleParams(rule) : null}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {finding.category}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <span
            className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.14em] ${status.chip}`}
          >
            {status.label}
          </span>
          <span
            className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.14em] ${impactClass}`}
          >
            {finding.impactStatus === "positive"
              ? "Позитивний вплив"
              : finding.impactStatus === "negative"
                ? "Негативний вплив"
                : finding.impactStatus === "neutral"
                  ? "Нейтральний вплив"
                  : "Без висновку"}
          </span>
        </div>
      </div>

      <p className="mt-4 max-w-[90ch] text-sm leading-6 text-foreground/90">
        {finding.message}
      </p>

      <div className="mt-4 flex flex-wrap gap-5 text-sm text-muted-foreground">
        <span>Порушень: {finding.violations}</span>
        <span>Угод: {finding.affectedTrades}</span>
        <span className={metricTone(finding.impactR)}>
          Вплив: {formatR(finding.impactR)}
        </span>
        <span>Надійність: {finding.confidence}</span>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4">
          <div className="text-[11px] uppercase tracking-[0.16em] text-emerald-700/80 dark:text-emerald-300/80">
            За дотримання ({finding.compliantCount})
          </div>
          <div className="mt-2 text-2xl font-semibold text-emerald-700 dark:text-emerald-300">
            {formatR(finding.compliantAvgR)}
          </div>
        </div>

        <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-4">
          <div className="text-[11px] uppercase tracking-[0.16em] text-rose-700/80 dark:text-rose-300/80">
            За порушення ({finding.affectedTrades})
          </div>
          <div className="mt-2 text-2xl font-semibold text-rose-700 dark:text-rose-300">
            {formatR(finding.violatedAvgR)}
          </div>
        </div>
      </div>

      {finding.recommendation ? (
        <div className="mt-4 rounded-xl border border-border bg-muted/40 p-4 text-sm leading-6 text-foreground/90">
          {finding.recommendation}
        </div>
      ) : null}

      <div className="mt-4 text-sm font-medium text-blue-700 dark:text-blue-300">
        Деталі правила →
      </div>
    </button>
  );
}

function FindingModal({
  finding,
  open,
  onClose,
}: {
  finding: RuleFinding | null;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open || !finding) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-border bg-background p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-3xl font-semibold tracking-tight text-foreground">
              {finding.title}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-border bg-card p-2 text-muted-foreground transition hover:bg-accent hover:text-foreground"
            aria-label="Закрити"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            Висновок
          </div>
          <p className="mt-3 text-lg leading-7 text-foreground">
            {finding.message}
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            Статус: {statusLabel[finding.status]} · Надійність:{" "}
            {finding.confidence}
          </p>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Порушень
            </div>
            <div className="mt-3 text-4xl font-semibold text-foreground">
              {finding.violations}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Вплив
            </div>
            <div
              className={`mt-3 text-4xl font-semibold ${metricTone(finding.impactR)}`}
            >
              {formatR(finding.impactR)}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Дотримано
            </div>
            <div className="mt-3 text-4xl font-semibold text-foreground">
              {formatR(finding.compliantAvgR)}
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              {finding.compliantCount} угод
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Порушено
            </div>
            <div className="mt-3 text-4xl font-semibold text-foreground">
              {formatR(finding.violatedAvgR)}
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              {finding.affectedTrades} угод
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-border bg-card p-5">
          <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            Доказові угоди ({finding.evidenceTrades.length})
          </div>

          <div className="mt-4 space-y-3">
            {finding.evidenceTrades.length ? (
              finding.evidenceTrades.map((trade) => (
                <div
                  key={trade.id}
                  className="flex items-center justify-between rounded-xl border border-border bg-muted/40 px-4 py-3"
                >
                  <div className="text-sm text-foreground/90">
                    {trade.date} · {trade.pair} · {trade.session ?? "—"}
                  </div>
                  <div
                    className={`text-sm font-medium ${metricTone(trade.resultR)}`}
                  >
                    {formatR(trade.resultR)}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                Конкретних порушених угод не знайдено.
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              const ids = finding.evidenceTradeIds.join(",");
              router.push(`/journal?focusTradeIds=${encodeURIComponent(ids)}`);
            }}
            className="mt-4 rounded-xl border border-blue-500/20 bg-blue-500/10 px-4 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-500/15 dark:text-blue-300"
          >
            Відкрити фільтр у журналі
          </button>
        </div>

        <p className="mt-5 text-sm leading-6 text-muted-foreground">
          Обмеження: порівняння описове й не доводить причинність. Не
          використовуй його як автоматичний сигнал збільшення ризику.
        </p>
      </div>
    </div>
  );
}

function StrategyDetailsModal({
  strategy,
  open,
  onClose,
}: {
  strategy: StrategyProfile | null;
  open: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open || !strategy) return null;

  const activeRules = strategy.rules.filter((rule) => rule.enabled);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-3xl border border-border bg-background p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Деталі стратегії
            </div>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
              {strategy.name}
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
              {strategy.description?.trim() ||
                "Опис для цієї стратегії ще не додано."}
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full border border-border bg-muted/40 px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                Активних правил: {activeRules.length}
              </span>
              <span className="rounded-full border border-border bg-muted/40 px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                Створено: {strategy.createdAt || "—"}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-border bg-card p-2 text-muted-foreground transition hover:bg-accent hover:text-foreground"
            aria-label="Закрити"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-4">
          {activeRules.length ? (
            activeRules.map((rule) => (
              <div
                key={rule.ruleType}
                className="rounded-2xl border border-border bg-card p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-base font-semibold text-foreground">
                      {ruleLibrary[rule.ruleType].title}{" "}
                      <span className="text-muted-foreground">
                        {formatRuleParams(rule)}
                      </span>
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {ruleLibrary[rule.ruleType].description}
                    </div>
                  </div>

                  <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-300">
                    Активне правило
                  </span>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {Object.entries(rule.params).map(([key, value]) => (
                    <div
                      key={`${rule.ruleType}-${key}`}
                      className="rounded-xl border border-border bg-muted/40 p-4"
                    >
                      <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                        {key}
                      </div>
                      <div className="mt-2 text-sm font-medium text-foreground">
                        {Array.isArray(value)
                          ? value.join(", ")
                          : String(value)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
              У цій стратегії поки немає активних правил.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function StrategyControlTab() {
  const { visibleTrades, loading, error } = useTrades();

  const [strategies, setStrategies] =
    useState<StrategyProfile[]>(mockStrategies);
  const [selectedStrategyId, setSelectedStrategyId] = useState<string>(
    mockStrategies[0]?.id ?? "",
  );
  const [selectedFinding, setSelectedFinding] = useState<RuleFinding | null>(
    null,
  );
  const [strategyDetailsOpen, setStrategyDetailsOpen] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [period, setPeriod] = useState(getDefaultRange());

  const activeStrategy =
    strategies.find((strategy) => strategy.id === selectedStrategyId) ??
    strategies[0] ??
    null;

  useEffect(() => {
    if (!activeStrategy && strategies[0]) {
      setSelectedStrategyId(strategies[0].id);
    }
  }, [activeStrategy, strategies]);

  const filteredTrades = useMemo(() => {
    return visibleTrades.filter((trade) => {
      const day = trade.opened_at.slice(0, 10);
      return day >= period.start && day <= period.end;
    });
  }, [visibleTrades, period]);

  const strategyTrades = useMemo(
    () => filteredTrades.map(toStrategyControlTrade),
    [filteredTrades],
  );

  const analysis = useMemo(() => {
    if (!activeStrategy) return null;
    return analyzeTrades(strategyTrades, activeStrategy, period);
  }, [activeStrategy, strategyTrades, period]);

  const sortedFindings = useMemo(() => {
    if (!analysis) return [];
    return [...analysis.findings].sort((a, b) => {
      const rank = { critical: 0, warning: 1, insufficient: 2, ok: 3 };
      return rank[a.status] - rank[b.status];
    });
  }, [analysis]);

  const focusFindings = useMemo(
    () => sortedFindings.filter((finding) => finding.status !== "ok"),
    [sortedFindings],
  );

  function handleCreateStrategy(strategy: StrategyProfile) {
    setStrategies((current) => [strategy, ...current]);
    setSelectedStrategyId(strategy.id);
    setBuilderOpen(false);
  }

  function handleDeleteStrategy() {
    if (!activeStrategy) return;
    if (strategies.length <= 1) return;

    const next = strategies.filter(
      (strategy) => strategy.id !== activeStrategy.id,
    );
    setStrategies(next);
    setSelectedStrategyId(next[0]?.id ?? "");
  }

  function handleDuplicateStrategy() {
    if (!activeStrategy) return;

    const copy: StrategyProfile = {
      ...activeStrategy,
      id: `${activeStrategy.id}-copy-${Date.now()}`,
      name: `${activeStrategy.name} Copy`,
      createdAt: new Date().toISOString().slice(0, 10),
      rules: activeStrategy.rules.map((rule) => ({
        ...rule,
        params: { ...rule.params },
      })),
    };

    setStrategies((current) => [copy, ...current]);
    setSelectedStrategyId(copy.id);
  }

  if (builderOpen) {
    return (
      <div className="w-full min-w-0 space-y-6">
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            Trade Vault · конструктор стратегій
          </div>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-foreground">
            Нова стратегія
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Створення нової стратегії не впливає на раніше створені.
          </p>
        </div>

        <StrategyBuilder
          onSave={handleCreateStrategy}
          onCancel={() => setBuilderOpen(false)}
        />
      </div>
    );
  }

  return (
    <>
      <div className="w-full min-w-0 space-y-6">
        <div className="flex flex-col gap-4 2xl:flex-row 2xl:items-start 2xl:justify-between">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              Trade Vault · behavioral layer
            </div>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-foreground">
              Контроль стратегії
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              Не дублює загальний P&amp;L. Показує, наскільки виконувались
              правила саме обраної стратегії.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="rounded-2xl border border-border bg-card px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                Від
              </div>
              <input
                type="date"
                value={period.start}
                onChange={(event) =>
                  setPeriod((current) => ({
                    ...current,
                    start: event.target.value,
                  }))
                }
                className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
              />
            </label>

            <label className="rounded-2xl border border-border bg-card px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                До
              </div>
              <input
                type="date"
                value={period.end}
                onChange={(event) =>
                  setPeriod((current) => ({
                    ...current,
                    end: event.target.value,
                  }))
                }
                className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
              />
            </label>
          </div>
        </div>

        <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 2xl:flex-row 2xl:items-center 2xl:justify-between">
          <div className="flex flex-1 flex-col gap-4 2xl:flex-row 2xl:items-center">
            <div className="flex min-w-[260px] items-center gap-3">
              <span className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                Стратегія
              </span>
              <select
                value={activeStrategy?.id ?? ""}
                onChange={(event) => setSelectedStrategyId(event.target.value)}
                className="min-w-[240px] rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
              >
                {strategies.map((strategy) => (
                  <option key={strategy.id} value={strategy.id}>
                    {strategy.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex min-w-0 items-center gap-3">
              <div className="truncate text-sm text-muted-foreground">
                {activeStrategy?.description ||
                  "Короткий опис активної стратегії"}
              </div>

              {activeStrategy ? (
                <button
                  type="button"
                  onClick={() => setStrategyDetailsOpen(true)}
                  className="shrink-0 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-accent"
                >
                  Переглянути деталі
                </button>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setBuilderOpen(true)}
              className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-500/15 dark:text-emerald-300"
            >
              + Створити стратегію
            </button>
            <button
              type="button"
              onClick={handleDuplicateStrategy}
              className="rounded-xl border border-blue-500/20 bg-blue-500/10 px-4 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-500/15 dark:text-blue-300"
            >
              Дублювати як нову
            </button>
            <button
              type="button"
              onClick={handleDeleteStrategy}
              disabled={strategies.length <= 1}
              className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-500/15 disabled:cursor-not-allowed disabled:opacity-50 dark:text-rose-300"
            >
              Видалити
            </button>
          </div>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
            Завантаження журналу угод...
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-6 text-sm text-rose-700 dark:text-rose-300">
            Не вдалося завантажити trades: {error}
          </div>
        ) : !activeStrategy || !analysis ? (
          <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
            Немає активної стратегії для аналізу.
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <StatCard
                label="Виконання правил"
                value={formatPct(analysis.compliance)}
                hint={`${analysis.cleanTrades} із ${analysis.checkedTrades || 0} перевірених угод`}
                icon={<ShieldCheck className="h-5 w-5" />}
              />
              <StatCard
                label="Дисциплінарний ризик"
                value={`${analysis.disciplineRisk}/100`}
                hint={
                  analysis.disciplineRisk >= 70
                    ? "Високий"
                    : analysis.disciplineRisk >= 40
                      ? "Середній"
                      : "Низький"
                }
                icon={<AlertTriangle className="h-5 w-5" />}
              />
              <StatCard
                label="Winrate"
                value={analysis.winRate !== null ? `${analysis.winRate}%` : "—"}
                hint="Описова метрика періоду"
                icon={<TrendingUp className="h-5 w-5" />}
              />
              <StatCard
                label="Результат"
                value={formatR(analysis.totalR)}
                hint={
                  analysis.averageR !== null
                    ? `avg ${analysis.averageR >= 0 ? "+" : ""}${analysis.averageR}R / trade`
                    : "Недостатньо даних"
                }
                icon={<Target className="h-5 w-5" />}
                valueTone={metricTone(analysis.totalR)}
              />
              <StatCard
                label="Середній ризик"
                value={
                  analysis.averageRisk !== null
                    ? `${analysis.averageRisk.toFixed(1)}%`
                    : "—"
                }
                hint="На одну угоду"
                icon={<Scale className="h-5 w-5" />}
              />
            </div>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px] 2xl:grid-cols-[minmax(0,1.12fr)_380px]">
              <div className="min-w-0 space-y-4">
                <div className="rounded-2xl border border-border bg-card p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-lg font-semibold text-foreground">
                        Правила стратегії: {analysis.strategyName}
                      </div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        Факти, порушення та їхній результат
                      </div>
                    </div>

                    <div className="text-sm text-muted-foreground">
                      {focusFindings.length} потребують уваги
                    </div>
                  </div>
                </div>

                {sortedFindings.map((finding) => {
                  const rule = activeStrategy.rules.find(
                    (item) => item.ruleType === finding.ruleType,
                  );

                  return (
                    <RuleCard
                      key={finding.ruleType}
                      finding={finding}
                      rule={rule}
                      onOpen={() => setSelectedFinding(finding)}
                    />
                  );
                })}
              </div>

              <div className="min-w-0 space-y-4 xl:sticky xl:top-6 xl:self-start">
                <div className="rounded-2xl border border-border bg-card p-5">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                    RR / P&amp;L summary
                  </div>

                  <div className="mt-4 grid gap-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-xl border border-border bg-muted/40 p-4">
                        <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                          Середній RR
                        </div>
                        <div className="mt-2 text-3xl font-semibold text-foreground">
                          {analysis.averagePlannedRR !== null
                            ? `${analysis.averagePlannedRR}R`
                            : "—"}
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          Доступні угоди
                        </div>
                      </div>

                      <div className="rounded-xl border border-border bg-muted/40 p-4">
                        <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                          Медіанний RR
                        </div>
                        <div className="mt-2 text-3xl font-semibold text-foreground">
                          {analysis.medianPlannedRR !== null
                            ? `${analysis.medianPlannedRR}R`
                            : "—"}
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          Плановий
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-xl border border-border bg-muted/40 p-4">
                        <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                          Без порушень
                        </div>
                        <div
                          className={`mt-2 text-3xl font-semibold ${metricTone(analysis.averageR)}`}
                        >
                          {formatR(
                            analysis.findings
                              .filter(
                                (finding) => finding.compliantAvgR !== null,
                              )
                              .reduce(
                                (sum, finding) =>
                                  sum + (finding.compliantAvgR ?? 0),
                                0,
                              ),
                          )}
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          {analysis.cleanTrades} угод
                        </div>
                      </div>

                      <div className="rounded-xl border border-border bg-muted/40 p-4">
                        <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                          З порушеннями
                        </div>
                        <div className="mt-2 text-3xl font-semibold text-foreground">
                          {formatR(
                            analysis.findings.reduce(
                              (sum, finding) => sum + (finding.impactR ?? 0),
                              0,
                            ),
                          )}
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          {analysis.findings.reduce(
                            (sum, finding) => sum + finding.affectedTrades,
                            0,
                          )}{" "}
                          угод
                        </div>
                      </div>
                    </div>
                  </div>

                  <p className="mt-4 text-sm leading-6 text-muted-foreground">
                    Порівняння описове: воно показує зв’язок у цьому періоді,
                    але не доводить причинність.
                  </p>
                </div>

                <div className="rounded-2xl border border-border bg-card p-5">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                    Поточний фокус
                  </div>
                  <div className="mt-3 text-2xl font-semibold text-foreground">
                    Є над чим працювати
                  </div>

                  <div className="mt-4 space-y-3">
                    {analysis.recommendations.length ? (
                      analysis.recommendations
                        .slice(0, 4)
                        .map((recommendation, index) => (
                          <div
                            key={`${index}-${recommendation}`}
                            className="rounded-xl border border-border bg-muted/40 p-4 text-sm leading-6 text-foreground/90"
                          >
                            {recommendation}
                          </div>
                        ))
                    ) : (
                      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm leading-6 text-emerald-700 dark:text-emerald-300">
                        Критичних патернів порушення не виявлено в обраному
                        періоді.
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
                  Період: {formatDateLabel(period.start)} —{" "}
                  {formatDateLabel(period.end)} · Угод у журналі:{" "}
                  {filteredTrades.length}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      <StrategyDetailsModal
        strategy={activeStrategy}
        open={strategyDetailsOpen}
        onClose={() => setStrategyDetailsOpen(false)}
      />

      <FindingModal
        finding={selectedFinding}
        open={!!selectedFinding}
        onClose={() => setSelectedFinding(null)}
      />
    </>
  );
}
