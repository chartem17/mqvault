"use client";

import { useMemo, useState } from "react";
import { mockTrades } from "@/lib/strategy-control/mock-trades";
import { analyzeTrades } from "@/lib/strategy-control/engine";
import type { RuleFinding, RuleStatus } from "@/lib/strategy-control/types";

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
      </div>
      {finding.recommendation ? <p className="mt-3 rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-2 text-xs leading-5 text-white/65">Фокус: {finding.recommendation}</p> : null}
    </div>
  );
}

export function StrategyControlPage() {
  const [start, setStart] = useState("2026-03-01");
  const [end, setEnd] = useState("2026-06-30");

  const analysis = useMemo(() => {
    const filtered = mockTrades.filter((trade) => trade.date >= start && trade.date <= end);
    return analyzeTrades(filtered, { start, end });
  }, [start, end]);

  const riskLabel = analysis.disciplineRisk >= 60 ? "Високий" : analysis.disciplineRisk >= 30 ? "Середній" : "Низький";
  const riskColor = analysis.disciplineRisk >= 60 ? "text-rose-300" : analysis.disciplineRisk >= 30 ? "text-amber-300" : "text-emerald-300";

  return (
    <main className="min-h-screen bg-[#08090b] px-5 py-8 text-white md:px-8">
      <div className="mx-auto max-w-[1400px]">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <p className="text-[10px] uppercase tracking-[0.24em] text-blue-300/60">Trade Vault · behavioral layer</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">Контроль стратегії</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/45">Не дублює загальний P&amp;L. Показує, наскільки виконувалися правила торгового процесу.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/[0.07] bg-black/30 p-2">
            <label className="text-[10px] uppercase tracking-[0.12em] text-white/35">Від<input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="ml-2 rounded-lg border border-white/10 bg-white/[0.05] px-2 py-1.5 text-xs text-white outline-none" /></label>
            <label className="text-[10px] uppercase tracking-[0.12em] text-white/35">До<input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="ml-2 rounded-lg border border-white/10 bg-white/[0.05] px-2 py-1.5 text-xs text-white outline-none" /></label>
          </div>
        </div>

        <section className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Metric label="Виконання правил" value={`${analysis.compliance}%`} hint={`${analysis.trades} угод у періоді`} />
          <Metric label="Дисциплінарний ризик" value={`${analysis.disciplineRisk}/100`} hint={<span className={riskColor}>{riskLabel}</span> as unknown as string} />
          <Metric label="Winrate" value={`${analysis.winRate}%`} hint="Описова метрика періоду" />
          <Metric label="Результат" value={`${analysis.totalR >= 0 ? "+" : ""}${analysis.totalR}R`} hint={`avg ${analysis.averageR}R / trade`} />
          <Metric label="Середній ризик" value={`${analysis.averageRisk}%`} hint="На одну угоду" />
        </section>

        <section className="mt-5 grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
          <div className="rounded-2xl border border-white/[0.07] bg-black/25">
            <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
              <div><h2 className="text-sm font-medium text-white">Правила стратегії</h2><p className="mt-1 text-xs text-white/35">Факти, порушення та їхній результат</p></div>
              <span className="text-xs text-white/35">{analysis.findings.filter((f) => f.status !== "ok").length} потребують уваги</span>
            </div>
            {analysis.findings.map((finding) => <Finding key={finding.id} finding={finding} />)}
          </div>

          <div className="space-y-5">
            <div className="rounded-2xl border border-white/[0.07] bg-black/25 p-5">
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/40">Поточний фокус</p>
              <h2 className="mt-3 text-xl font-semibold text-white">{analysis.recommendations[0] ? "Є над чим працювати" : "Система виконана чисто"}</h2>
              <div className="mt-4 space-y-3">
                {(analysis.recommendations.length ? analysis.recommendations.slice(0, 4) : ["За активними правилами критичних рекомендацій немає."]).map((recommendation) => <div key={recommendation} className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-3 text-sm leading-5 text-white/65">{recommendation}</div>)}
              </div>
            </div>
            <div className="rounded-2xl border border-blue-300/10 bg-blue-300/[0.04] p-5">
              <p className="text-[10px] uppercase tracking-[0.18em] text-blue-200/55">Примітка прототипу</p>
              <p className="mt-3 text-sm leading-6 text-white/60">Це детермінований тестовий engine. Він не прогнозує майбутній P&amp;L, не радить збільшувати ризик і не замінює твоє рішення.</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
