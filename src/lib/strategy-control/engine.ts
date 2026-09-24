import { ruleEvaluators, ruleLibrary } from "./rule-library";
import type { RuleFinding, StrategyAnalysis, StrategyProfile, Trade } from "./types";

const round = (value: number, digits = 2) => Number(value.toFixed(digits));

function resolveStatus(violations: number, sampleSize: number, impactR: number) {
  const impactStatus = violations === 0 ? "unknown" : impactR < 0 ? "negative" : impactR > 0 ? "positive" : "neutral";
  if (violations === 0) return { status: "ok", confidence: "high", impactStatus } as const;
  if (sampleSize < 5) return { status: "insufficient", confidence: "low", impactStatus } as const;
  const confidence = sampleSize >= 20 ? "high" : sampleSize >= 10 ? "medium" : "low";
  const status = impactR < 0 && violations >= 3 ? "critical" : "warning";
  return { status, confidence, impactStatus } as const;
}

function buildRecommendation(title: string, status: RuleFinding["status"], impactStatus: RuleFinding["impactStatus"], confidence: RuleFinding["confidence"], compliantAvgR: number | null, violatedAvgR: number | null) {
  if (status === "ok" || status === "insufficient") return null;
  const comparison = compliantAvgR !== null && violatedAvgR !== null ? ` Дотримання: ${compliantAvgR >= 0 ? "+" : ""}${compliantAvgR}R, порушення: ${violatedAvgR >= 0 ? "+" : ""}${violatedAvgR}R.` : "";
  const note = confidence === "high" ? "Вибірка достатня, але це кореляція, а не доказ причини." : confidence === "medium" ? "Вибірка середня — спостерігай далі." : "Вибірка невелика — висновок орієнтовний.";
  if (impactStatus === "positive" || impactStatus === "neutral") return `Правило "${title}" порушувалось, але негативного впливу не виявлено.${comparison} ${note} Не скасовуй правило на основі одного періоду.`;
  if (status === "critical") return `Правило "${title}" систематично порушується і дає негативний результат.${comparison} ${note} Посиль контроль до наступного звіту.`;
  return `Правило "${title}" порушується, вплив негативний, але ще не критичний.${comparison} ${note}`;
}

export function analyzeTrades(trades: Trade[], strategy: StrategyProfile, period: { start: string; end: string }): StrategyAnalysis {
  const totalR = round(trades.reduce((sum, t) => sum + t.resultR, 0));
  const wins = trades.filter((t) => t.resultR > 0).length;
  const averageRisk = trades.length ? round(trades.reduce((sum, t) => sum + t.riskPct, 0) / trades.length) : 0;
  const rrValues = trades.map((t) => t.plannedRR).filter((value): value is number => typeof value === "number").sort((a, b) => a - b);
  const findings: RuleFinding[] = strategy.rules.filter((rule) => rule.enabled).map((rule) => {
    const definition = ruleLibrary[rule.ruleType];
    const evaluated = ruleEvaluators[rule.ruleType]({ trades, params: rule.params });
    const { status, confidence, impactStatus } = resolveStatus(evaluated.violations, evaluated.sampleSize, evaluated.impactR);
    const compliantAvgR = evaluated.compliantCount ? round(evaluated.compliantImpactR / evaluated.compliantCount) : null;
    const violatedAvgR = evaluated.affectedTrades ? round(evaluated.impactR / evaluated.affectedTrades) : null;
    return {
      ruleType: rule.ruleType,
      title: definition.title,
      category: definition.category,
      complianceStatus: evaluated.violations > 0 ? "violated" : "passed",
      impactStatus,
      confidence,
      status,
      violations: evaluated.violations,
      affectedTrades: evaluated.affectedTrades,
      impactR: evaluated.impactR,
      sampleSize: evaluated.sampleSize,
      compliantCount: evaluated.compliantCount,
      compliantAvgR,
      violatedAvgR,
      evidenceTradeIds: evaluated.evidenceTrades.map((trade) => trade.id),
      evidenceTrades: evaluated.evidenceTrades,
      message: evaluated.violations === 0 ? `Порушень немає: правило "${definition.title}" виконувалось повністю.` : `Правило "${definition.title}" порушено у ${evaluated.violations} випадках (${evaluated.affectedTrades} угод).`,
      recommendation: buildRecommendation(definition.title, status, impactStatus, confidence, compliantAvgR, violatedAvgR),
    } satisfies RuleFinding;
  });

  const violatedIds = new Set(findings.flatMap((finding) => finding.evidenceTradeIds));
  const checkedTrades = trades.filter((trade) => findings.some((finding) => finding.evidenceTradeIds.includes(trade.id)) || trades.some((item) => item.id === trade.id));
  const cleanTrades = checkedTrades.filter((trade) => !violatedIds.has(trade.id));
  const compliance = checkedTrades.length ? Math.round((cleanTrades.length / checkedTrades.length) * 100) : 0;
  const disciplineRisk = Math.min(100, Math.round(findings.filter((f) => f.impactStatus === "negative").reduce((sum, f) => sum + Math.max(0, -f.impactR) * 10, 0)));

  return {
    strategyId: strategy.id,
    strategyName: strategy.name,
    period,
    trades: trades.length,
    checkedTrades: checkedTrades.length,
    cleanTrades: cleanTrades.length,
    compliance,
    winRate: trades.length ? round((wins / trades.length) * 100, 1) : 0,
    totalR,
    averageR: trades.length ? round(totalR / trades.length) : 0,
    averageRisk,
    averagePlannedRR: rrValues.length ? round(rrValues.reduce((sum, value) => sum + value, 0) / rrValues.length) : null,
    medianPlannedRR: rrValues.length ? round(rrValues[Math.floor(rrValues.length / 2)]) : null,
    disciplineRisk,
    findings,
    recommendations: findings.filter((f) => f.recommendation).map((f) => f.recommendation as string),
  };
}
