"use client";

import { useMemo, useState } from "react";
import { mockTrades } from "@/lib/strategy-control/mock-trades";
import { mockStrategies } from "@/lib/strategy-control/mock-strategies";
import { analyzeTrades } from "@/lib/strategy-control/engine";
import type { RuleFinding, RuleStatus, StrategyProfile } from "@/lib/strategy-control/types";
import { StrategyBuilder } from "./strategy-builder";

const statusLabel: Record<RuleStatus, string> = {
  ok: "В нормі",
  warning: "Потребує уваги",
  critical: "Критично",
  insufficient: "Мала вибірка",
};

const statusClass: Record<RuleStatus, string> = {
  ok: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
  warning: "border-amber-400/20 bg-amber-400/10 text-amber-300",
  critical: "border-rose-400/20 bg-rose-400/10 text-rose-300",
  insufficient: "border-slate-400/20 bg-slate-400/10 text-slate-300",
};

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-black/30 p-5">
      <p className="text-[10px] uppercase tracking-[0.18em] text-white/40">{label}</p>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-white">{value}</p>
      {hint ? <p className="mt-1 text-xs text-white/35">{hint}</p> : null}
    </div>
  );
}

function Finding({ finding }: { finding: RuleFinding }) {
  return (
    <div className="border-b border-white/[0.06] px-5 py-4 last:border-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-white">{finding.title}</p>
          <p className="mt-1 text-xs text-white/40">{finding.category}</p>
        </div>
        <span className={`rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] ${statusClass[finding.status]}`}>
          {statusLabel[finding.status]}
        </span>
      </div>
      <p className="mt-3 text-sm text-white/65">{finding.message}</p>
      <div className="mt-3 flex flex-wrap gap-5 text-xs text-white/45">
        <span>Порушень: <b className="text-white/80">{finding.violations}</b></span>
        <span>Угод: <b className="text-white/80">{finding.affectedTrades}</b></span>
        <span>Вплив: <b className={finding.impactR < 0 ? "text-rose-300" : "text-emerald-300"}>{finding.impactR > 0 ? "+" : ""}{finding.impactR}R</b></span>
        <span>Надійність: <b className="text-white/80">{finding.confidence}</b></span>
      </div>
      {finding.compliantAvgR !== null && finding.violatedAvgR !== null ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-emerald-300/15 bg-emerald-300/[0.05] px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.1em] text-emerald-300/60">за дотримання ({finding.compliantCount})</p>
            <p className="mt-1 text-sm font-medium text-emerald-200">{finding.compliantAvgR >= 0 ? "+" : ""}{finding.compliantAvgR}R</p>
          </div>
          <div className="rounded-lg border border-rose-300/15 bg-rose-300/[0.05] px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.1em] text-rose-300/60">за порушення ({finding.affectedTrades})</p>
            <p className="mt-1 text-sm font-medium text-rose-200">{finding.violatedAvgR >= 0 ? "+" : ""}{finding.violatedAvgR}R</p>
          </div>
        </div>
      ) : null}
      {finding.recommendation ? (
        <p className="mt-3 rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-2 text-xs leading-5 text-white/65">{finding.recommendation}</p>
      ) : null}
    </div>
  );
}

export function StrategyControlPage() {
  const [strategies, setStrategies] = useState<StrategyProfile[]>(mockStrategies);
  const [strategyId, setStrategyId] = useState(mockStrategies[0].id);
  const [start, setStart] = useState("2026-03-01");
  const [end, setEnd] = useState("2026-06-30");
  const [showBuilder, setShowBuilder] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const activeStrategy = strategies.find((s) => s.id === strategyId) ?? strategies[0];

  const analysis = useMemo(() => {
    const filtered = mockTrades.filter((trade) => trade.date >= start && trade.date <= end);
    return analyzeTrades(filtered, activeStrategy, { start, end });
  }, [activeStrategy, start, end]);

  const riskLabel = analysis.disciplineRisk >= 60 ? "Високий" : analysis.disciplineRisk >= 30 ? "Середній" : "Низький";

  const duplicateStrategy = () => {
    const copy: StrategyProfile = {
      ...activeStrategy,
      id: `${activeStrategy.id}-copy-${Date.now()}`,
      name: `${activeStrategy.name} (копія)`,
      createdAt: new Date().toISOString().slice(0, 10),
      rules: activeStrategy.rules.map((rule) => ({ ...rule, params: { ...rule.params } })),
    };
    setStrategies((prev) => [...prev, copy]);
    setStrategyId(copy.id);
  };

  const handleCreate = (strategy: StrategyProfile) => {
    setStrategies((prev) => [...prev, strategy]);
    setStrategyId(strategy.id);
    setShowBuilder(false);
  };

  const handleDelete = (id: string) => {
    if (strategies.length <= 1) return;
    const remaining = strategies.filter((s) => s.id !== id);
    setStrategies(remaining);
    if (strategyId === id) setStrategyId(remaining[0].id);
    setConfirmDeleteId(null);
  };

  if (showBuilder) {
    return (
      <main className="min-h-screen bg-[#08090b] px-5 py-8 text-white md:px-8">
        <div className="mx-auto max-w-[900px]">
          <p className="text-[10px] uppercase tracking-[0.24em] text-blue-300/60">Trade Vault · конструктор стратегій</p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">Нова стратегія</h1>
          <p className="mt-2 text-sm text-white/45">Створення нової стратегії не впливає на раніше створені — редагувати існуючі стратегії не використовується, щоб не ламати попередній аналіз.</p>
          <div className="mt-5">
            <StrategyBuilder onSave={handleCreate} onCancel={() => setShowBuilder(false)} />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#08090b] px-5 py-8 text-white md:px-8">
      <div className="mx-auto max-w-[1400px]">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <p className="text-[10px] uppercase tracking-[0.24em] text-blue-300/60">Trade Vault · behavioral layer</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">Контроль стратегії</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/45">Не дублює загальний P&amp;L. Показує, наскільки виконувались правила саме обраної стратегії.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/[0.07] bg-black/30 p-2">
            <label className="text-[10px] uppercase tracking-[0.12em] text-white/35">Від
              <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="ml-2 rounded-lg border border-white/10 bg-white/[0.05] px-2 py-1.5 text-xs text-white outline-none" />
            </label>
            <label className="text-[10px] uppercase tracking-[0.12em] text-white/35">До
              <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="ml-2 rounded-lg border border-white/10 bg-white/[0.05] px-2 py-1.5 text-xs text-white outline-none" />
            </label>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl border border-white/[0.07] bg-black/25 p-4">
          <label className="text-[10px] uppercase tracking-[0.12em] text-white/35">Стратегія
            <select
              value={strategyId}
              onChange={(e) => setStrategyId(e.target.value)}
              className="ml-2 rounded-lg border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs text-white outline-none"
            >
              {strategies.map((s) => (
                <option key={s.id} value={s.id} className="bg-black">
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <p className="text-xs text-white/40">{activeStrategy.description}</p>

          <div className="ml-auto flex flex-wrap gap-2">
            <button
              onClick={() => setShowBuilder(true)}
              className="rounded-lg border border-emerald-300/25 bg-emerald-300/[0.1] px-3 py-1.5 text-xs text-emerald-200 transition hover:bg-emerald-300/[0.18]"
            >
              + Створити стратегію
            </button>
            <button
              onClick={duplicateStrategy}
              className="rounded-lg border border-blue-300/20 bg-blue-300/[0.08] px-3 py-1.5 text-xs text-blue-200 transition hover:bg-blue-300/[0.14]"
            >
              Дублювати як нову
            </button>
            {confirmDeleteId === activeStrategy.id ? (
              <button
                onClick={() => handleDelete(activeStrategy.id)}
                className="rounded-lg border border-rose-400/40 bg-rose-400/[0.16] px-3 py-1.5 text-xs text-rose-200"
              >
                Підтвердити видалення?
              </button>
            ) : (
              <button
                onClick={() => setConfirmDeleteId(activeStrategy.id)}
                disabled={strategies.length <= 1}
                className="rounded-lg border border-rose-300/20 bg-rose-300/[0.06] px-3 py-1.5 text-xs text-rose-300 transition hover:bg-rose-300/[0.12] disabled:cursor-not-allowed disabled:opacity-30"
              >
                Видалити
              </button>
            )}
          </div>
        </div>

        <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Metric label="Виконання правил" value={`${analysis.compliance}%`} hint={`${analysis.trades} угод у періоді`} />
          <Metric label="Дисциплінарний ризик" value={`${analysis.disciplineRisk}/100`} hint={riskLabel} />
          <Metric label="Winrate" value={`${analysis.winRate}%`} hint="Описова метрика періоду" />
          <Metric label="Результат" value={`${analysis.totalR >= 0 ? "+" : ""}${analysis.totalR}R`} hint={`avg ${analysis.averageR}R / trade`} />
          <Metric label="Середній ризик" value={`${analysis.averageRisk}%`} hint="На одну угоду" />
        </section>

        <section className="mt-5 grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
          <div className="rounded-2xl border border-white/[0.07] bg-black/25">
            <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
              <div>
                <h2 className="text-sm font-medium text-white">Правила стратегії: {activeStrategy.name}</h2>
                <p className="mt-1 text-xs text-white/35">Факти, порушення та їхній результат</p>
              </div>
              <span className="text-xs text-white/35">{analysis.findings.filter((f) => f.status !== "ok").length} потребують уваги</span>
            </div>
            {analysis.findings.length ? (
              analysis.findings.map((finding) => <Finding key={finding.ruleType} finding={finding} />)
            ) : (
              <p className="px-5 py-6 text-sm text-white/40">У цій стратегії не увімкнено жодного правила.</p>
            )}
          </div>

          <div className="space-y-5">
            <div className="rounded-2xl border border-white/[0.07] bg-black/25 p-5">
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/40">Поточний фокус</p>
              <h2 className="mt-3 text-xl font-semibold text-white">{analysis.recommendations[0] ? "Є над чим працювати" : "Система виконана чисто"}</h2>
              <div className="mt-4 space-y-3">
                {(analysis.recommendations.length ? analysis.recommendations.slice(0, 4) : ["За активними правилами критичних рекомендацій немає."]).map((recommendation) => (
                  <div key={recommendation} className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-3 text-sm leading-5 text-white/65">{recommendation}</div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-blue-300/10 bg-blue-300/[0.04] p-5">
              <p className="text-[10px] uppercase tracking-[0.18em] text-blue-200/55">Стратегій усього: {strategies.length}</p>
              <p className="mt-3 text-sm leading-6 text-white/60">Редагування видалено навувиче — це ламалоб історичного аналізу. Щоб спробувати інші змінні — створи нову стратегію або дублюй існуючу і зміни параметри в копії.</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
