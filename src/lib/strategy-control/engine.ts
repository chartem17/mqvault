import { ruleEvaluators, ruleLibrary } from "./rule-library";
import type { RuleFinding, StrategyAnalysis, StrategyProfile, Trade } from "./types";

const round = (value: number, digits = 2) => Number(value.toFixed(digits));

function buildMessage(title: string, violations: number, unit: string): string {
  if (violations === 0) return `Порушень немає: правило "${title}" виконувалось повністю.`;
  return `Правило "${title}" порушено у ${violations} випадках (${unit}).`;
}

function resolveStatus(violations: number, sampleSize: number, impactR: number) {
  const impactStatus = violations === 0 ? "unknown" : impactR < 0 ? "negative" : impactR > 0 ? "positive" : "neutral";
  if (violations === 0) return { status: "ok", confidence: "high", impactStatus } as const;
  if (sampleSize < 5) return { status: "insufficient", confidence: "low", impactStatus } as const;
  const confidence = sampleSize >= 20 ? "high" : sampleSize >= 10 ? "medium" : "low";
  const status = impactR < 0 && violations >= 3 ? "critical" : "warning";
  return { status, confidence, impactStatus } as const;
}

function buildRecommendation(params: {
  title: string;
  status: RuleFinding["status"];
  impactStatus: RuleFinding["impactStatus"];
  confidence: RuleFinding["confidence"];
  compliantAvgR: number | null;
  violatedAvgR: number | null;
}) {
  const { title, status, impactStatus, confidence, compliantAvgR, violatedAvgR } = params;
  if (status === "ok" || status === "insufficient") return null;
  const comparison = compliantAvgR !== null && violatedAvgR !== null
    ? ` За дотримання: ${compliantAvgR >= 0 ? "+" : ""}${compliantAvgR}R в середньому, за порушення: ${violatedAvgR >= 0 ? "+" : ""}${violatedAvgR}R.`
    : "";
  const confidenceNote = confidence === "high"
    ? "Вибірка достатня, але це все ще кореляція, не доказ причини."
    : confidence === "medium"
      ? "Вибірка середня — варто спостерігати далі."
      : "Вибірка невелика — висновок поки орієнтовний.";
  if (impactStatus === "positive" || impactStatus === "neutral") {
    return `Правило "${title}" порушувалось, але негативного впливу в цьому періоді не виявлено.${comparison} ${confidenceNote} Не скасовуй правило на основі одного періоду.`;
  }
  if (status === "critical") {
    return `Правило "${title}" систематично порушується і дає негативний результат.${comparison} ${confidenceNote} Рекомендується посилити контроль до наступного звіту.`;
  }
  return `Правило "${title}" порушується, вплив негативний, але ще не критичний.${comparison} ${confidenceNote} Зверни увагу на наступному періоді.`;
}

export function analyzeTrades(trades: Trade[], strategy: StrategyProfile, period: { start: string; end: string }): StrategyAnalysis {
  const totalR = round(trades.reduce((sum, t) => sum + t.resultR, 0));
  const wins = trades.filter((t) => t.resultR > 0).length;
  const averageRisk = trades.length ? round(trades.reduce((sum, t) => sum + t.riskPct, 0) / trades.length) : 0;
  const rrValues = trades.map((t) => t.plannedRR).filter((value): value is number => typeof value === "number").sort((a, b) => a - b);
  const averagePlannedRR = rrValues.length ? round(rrValues.reduce((sum, value) => sum + value, 0) / rrValues.length) : null;
  const medianPlannedRR = rrValues.length ? round(rrValues[Math.floor(rrValues.length / 2)]) : null;

  const findings: RuleFinding[] = strategy.rules.filter((rule) => rule.enabled).map((rule) => {
    const definition = ruleLibrary[rule.ruleType];
    const result = ruleEvaluators[rule.ruleType]({ trades, params: rule.params });
    const { status, confidence, impactStatus } = resolveStatus(result.violations, result.sampleSize, result.impactR);
    const compliantAvgR = result.compliantCount > 0 ? round(result.compliantImpactR / result.compliantCount) : null;
    const violatedAvgR = result.affectedTrades > 0 ? round(result.impactR / result.affectedTrades) : null;
    const evidenceTradeIds = trades.slice(0, 0).map((t) => t.id);
    const recommendation = buildRecommendation({ title: definition.title, status, impactStatus, confidence, compliantAvgR, violatedAvgR });
    return {
      ruleType: rule.ruleType,
      title: definition.title,
      category: definition.category,
      complianceStatus: result.violations > 0 ? "violated" : "passed",
      impactStatus,
      confidence,
      status,
      violations: result.violations,
      affectedTrades: result.affectedTrades,
      impactR: result.impactR,
      sampleSize: result.sampleSize,
      compliantCount: result.compliantCount,
      compliantAvgR,
      violatedAvgR,
      evidenceTradeIds,
      message: buildMessage(definition.title, result.violations, `${result.affectedTrades} угод`),
      recommendation,
    } satisfies RuleFinding;
  });

  const activeFindings = findings.filter((f) => f.status !== "ok");
  const weightedViolations = activeFindings.reduce((sum, f) => sum + f.violations, 0);
  const compliance = trades.length ? Math.max(0, Math.round(100 - (weightedViolations / trades.length) * 100)) : 0;
  const disciplineRisk = Math.min(100, Math.round(activeFindings.filter((f) => f.impactStatus === "negative").reduce((sum, f) => sum + Math.max(0, -f.impactR) * 10, 0)));

  return {
    strategyId: strategy.id,
    strategyName: strategy.name,
    period,
    trades: trades.length,
    winRate: trades.length ? round((wins / trades.length) * 100, 1) : 0,
    totalR,
    averageR: trades.length ? round(totalR / trades.length) : 0,
    averageRisk,
    averagePlannedRR,
    medianPlannedRR,
    compliance,
    disciplineRisk,
    findings,
    recommendations: findings.filter((f) => f.recommendation).map((f) => f.recommendation as string),
  };
}
