import { msg, translate, type Vars } from "../i18n/core";
import { ruleEvaluators, ruleLibrary } from "./rule-library";
import type {
  RuleFinding,
  StrategyAnalysis,
  StrategyProfile,
  Trade,
} from "./types";

const round = (value: number, digits = 2) => Number(value.toFixed(digits));

function resolveStatus(
  violations: number,
  sampleSize: number,
  impactR: number,
) {
  const impactStatus =
    violations === 0
      ? "unknown"
      : impactR < 0
        ? "negative"
        : impactR > 0
          ? "positive"
          : "neutral";

  if (sampleSize === 0) {
    return { status: "insufficient", confidence: "low", impactStatus } as const;
  }

  if (violations === 0) {
    return {
      status: "ok",
      confidence: sampleSize >= 5 ? "high" : "low",
      impactStatus,
    } as const;
  }

  if (sampleSize < 5) {
    return { status: "insufficient", confidence: "low", impactStatus } as const;
  }

  const confidence =
    sampleSize >= 20 ? "high" : sampleSize >= 10 ? "medium" : "low";
  const status = impactR < 0 && violations >= 3 ? "critical" : "warning";
  return { status, confidence, impactStatus } as const;
}

type Translate = (text: string, vars?: Vars) => string;
const english: Translate = (text, vars) => translate(null, text, vars);
const signedR = (value: number) => `${value >= 0 ? "+" : ""}${value}R`;

function buildRecommendation(
  tr: Translate,
  title: string,
  status: RuleFinding["status"],
  impactStatus: RuleFinding["impactStatus"],
  confidence: RuleFinding["confidence"],
  compliantAvgR: number | null,
  violatedAvgR: number | null,
) {
  if (status === "ok" || status === "insufficient") return null;

  const comparison =
    compliantAvgR !== null && violatedAvgR !== null
      ? ` ${tr(msg("Followed: {followed}, violated: {violated}."), { followed: signedR(compliantAvgR), violated: signedR(violatedAvgR) })}`
      : "";

  const note =
    confidence === "high"
      ? tr(msg("The sample is large enough, but this is correlation, not proof of cause."))
      : confidence === "medium"
        ? tr(msg("The sample is medium — keep watching."))
        : tr(msg("The sample is small — the conclusion is tentative."));

  if (impactStatus === "positive" || impactStatus === "neutral") {
    return `${tr(msg("Rule “{title}” was broken, but no negative impact was found."), { title })}${comparison} ${note} ${tr(msg("Do not drop the rule based on a single period."))}`;
  }

  if (status === "critical") {
    return `${tr(msg("Rule “{title}” is broken systematically and hurts results."), { title })}${comparison} ${note} ${tr(msg("Tighten control before the next report."))}`;
  }

  return `${tr(msg("Rule “{title}” is being broken; the impact is negative but not critical yet."), { title })}${comparison} ${note}`;
}

export function analyzeTrades(
  trades: Trade[],
  strategy: StrategyProfile,
  period: { start: string; end: string },
  /** UI translator; English when omitted. Rule titles are translated too. */
  tr: Translate = english,
): StrategyAnalysis {
  const knownRTrades = trades.filter((t) => typeof t.resultR === "number");
  const knownRiskTrades = trades.filter((t) => typeof t.riskPct === "number");
  const rrValues = trades
    .map((t) => t.plannedRR)
    .filter((value): value is number => typeof value === "number")
    .sort((a, b) => a - b);

  const totalR = knownRTrades.length
    ? round(knownRTrades.reduce((sum, t) => sum + (t.resultR as number), 0))
    : null;

  const wins = knownRTrades.filter((t) => (t.resultR as number) > 0).length;

  const averageRisk = knownRiskTrades.length
    ? round(
        knownRiskTrades.reduce((sum, t) => sum + (t.riskPct as number), 0) /
          knownRiskTrades.length,
      )
    : null;

  const findings: RuleFinding[] = strategy.rules
    .filter((rule) => rule.enabled)
    .map((rule) => {
      const definition = ruleLibrary[rule.ruleType];
      const evaluated = ruleEvaluators[rule.ruleType]({
        trades,
        params: rule.params,
      });
      const { status, confidence, impactStatus } = resolveStatus(
        evaluated.violations,
        evaluated.sampleSize,
        evaluated.impactR,
      );

      const compliantAvgR = evaluated.compliantCount
        ? round(evaluated.compliantImpactR / evaluated.compliantCount)
        : null;

      const violatedAvgR = evaluated.affectedTrades
        ? round(evaluated.impactR / evaluated.affectedTrades)
        : null;

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
        message:
          evaluated.sampleSize === 0
            ? tr(msg("Not enough data to check rule “{title}” in the selected period."), { title: tr(definition.title) })
            : evaluated.violations === 0
              ? tr(msg("No violations: rule “{title}” was followed fully."), { title: tr(definition.title) })
              : tr(msg("Rule “{title}” was broken {violations} times ({trades} trades)."), { title: tr(definition.title), violations: evaluated.violations, trades: evaluated.affectedTrades }),
        recommendation: buildRecommendation(
          tr,
          tr(definition.title),
          status,
          impactStatus,
          confidence,
          compliantAvgR,
          violatedAvgR,
        ),
      } satisfies RuleFinding;
    });

  const violatedIds = new Set(
    findings.flatMap((finding) => finding.evidenceTradeIds),
  );
  const checkedIds = new Set(
    findings.flatMap((finding) => finding.evidenceTradeIds),
  );
  findings.forEach((finding) => {
    if (finding.sampleSize > 0) {
      finding.evidenceTrades.forEach((trade) => checkedIds.add(trade.id));
    }
  });

  const checkedTrades = trades.filter(
    (trade) =>
      checkedIds.has(trade.id) ||
      findings.some(
        (finding) =>
          finding.sampleSize > 0 &&
          (finding.evidenceTradeIds.includes(trade.id) ||
            finding.compliantCount > 0),
      ),
  );

  const cleanTrades = checkedTrades.filter(
    (trade) => !violatedIds.has(trade.id),
  );
  const compliance = checkedTrades.length
    ? Math.round((cleanTrades.length / checkedTrades.length) * 100)
    : 0;

  const disciplineRisk = Math.min(
    100,
    Math.round(
      findings
        .filter((f) => f.impactStatus === "negative")
        .reduce((sum, f) => sum + Math.max(0, -f.impactR) * 10, 0),
    ),
  );

  return {
    strategyId: strategy.id,
    strategyName: strategy.name,
    period,
    trades: trades.length,
    checkedTrades: checkedTrades.length,
    cleanTrades: cleanTrades.length,
    compliance,
    winRate: knownRTrades.length
      ? round((wins / knownRTrades.length) * 100, 1)
      : null,
    totalR,
    averageR:
      knownRTrades.length && totalR !== null
        ? round(totalR / knownRTrades.length)
        : null,
    averageRisk,
    averagePlannedRR: rrValues.length
      ? round(rrValues.reduce((sum, value) => sum + value, 0) / rrValues.length)
      : null,
    medianPlannedRR: rrValues.length
      ? round(rrValues[Math.floor(rrValues.length / 2)])
      : null,
    disciplineRisk,
    findings,
    recommendations: findings
      .filter((f) => f.recommendation)
      .map((f) => f.recommendation as string),
  };
}
