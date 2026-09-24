import type { RuleDefinition, RuleType, Trade } from "./types";

type EvaluationInput = { trades: Trade[]; params: Record<string, unknown> };
export type EvaluationOutput = { violations: number; affectedTrades: number; impactR: number; sampleSize: number; compliantImpactR: number; compliantCount: number; evidenceTrades: Trade[] };

const round = (value: number, digits = 2) => Number(value.toFixed(digits));
const sumR = (trades: Trade[]) => round(trades.reduce((sum, t) => sum + t.resultR, 0));
const result = (violations: number, affected: Trade[], compliant: Trade[], sampleSize = affected.length): EvaluationOutput => ({ violations, affectedTrades: affected.length, impactR: sumR(affected), sampleSize, compliantImpactR: sumR(compliant), compliantCount: compliant.length, evidenceTrades: affected });

function groupByDay(trades: Trade[]): Map<string, Trade[]> {
  const map = new Map<string, Trade[]>();
  trades.forEach((trade) => map.set(trade.date, [...(map.get(trade.date) ?? []), trade]));
  return map;
}

function evaluateMaxTradesPerDay({ trades, params }: EvaluationInput): EvaluationOutput {
  const limit = Number(params.limit ?? 3);
  const days = [...groupByDay(trades).entries()].filter(([, list]) => list.length > limit);
  const dates = new Set(days.map(([date]) => date));
  return result(days.length, trades.filter((t) => dates.has(t.date)), trades.filter((t) => !dates.has(t.date)), days.length);
}

function evaluateMaxLossesPerDay({ trades, params }: EvaluationInput): EvaluationOutput {
  const limit = Number(params.limit ?? 2);
  const days = [...groupByDay(trades).entries()].filter(([, list]) => list.filter((t) => t.resultR < 0).length > limit);
  const dates = new Set(days.map(([date]) => date));
  return result(days.length, trades.filter((t) => dates.has(t.date)), trades.filter((t) => !dates.has(t.date)), days.length);
}

function evaluateAllowedSessions({ trades, params }: EvaluationInput): EvaluationOutput {
  const allowed = (params.sessions as string[]) ?? ["NY", "London"];
  return result(trades.filter((t) => !allowed.includes(t.session)).length, trades.filter((t) => !allowed.includes(t.session)), trades.filter((t) => allowed.includes(t.session)));
}

function evaluateCoreInstruments({ trades, params }: EvaluationInput): EvaluationOutput {
  const core = (params.pairs as string[]) ?? ["EUR/USD", "XAU/USD", "BTC/USDT"];
  return result(trades.filter((t) => !core.includes(t.pair)).length, trades.filter((t) => !core.includes(t.pair)), trades.filter((t) => core.includes(t.pair)));
}

function evaluateModelConfirmation({ trades }: EvaluationInput): EvaluationOutput {
  const known = trades.filter((t) => typeof t.modelConfirmed === "boolean");
  const affected = known.filter((t) => t.modelConfirmed === false);
  return result(affected.length, affected, known.filter((t) => t.modelConfirmed === true));
}

function evaluateEmotionFilter({ trades, params }: EvaluationInput): EvaluationOutput {
  const badStates = (params.states as string[]) ?? ["Angry"];
  const affected = trades.filter((t) => t.emotion && badStates.includes(t.emotion));
  return result(affected.length, affected, trades.filter((t) => !t.emotion || !badStates.includes(t.emotion)));
}

function evaluateRiskRange({ trades, params }: EvaluationInput): EvaluationOutput {
  const minPct = Number(params.min_pct ?? 0.5);
  const maxPct = Number(params.max_pct ?? 2);
  const affected = trades.filter((t) => t.riskPct < minPct || t.riskPct > maxPct);
  return result(affected.length, affected, trades.filter((t) => t.riskPct >= minPct && t.riskPct <= maxPct));
}

function evaluateMinPlannedRR({ trades, params }: EvaluationInput): EvaluationOutput {
  const minRR = Number(params.min_rr ?? 2);
  const known = trades.filter((t) => typeof t.plannedRR === "number");
  const affected = known.filter((t) => (t.plannedRR as number) < minRR);
  return result(affected.length, affected, known.filter((t) => (t.plannedRR as number) >= minRR));
}

function evaluateHighRiskRequiresRR({ trades, params }: EvaluationInput): EvaluationOutput {
  const threshold = Number(params.risk_threshold_pct ?? 1);
  const minRR = Number(params.min_rr ?? 2.5);
  const eligible = trades.filter((t) => t.riskPct > threshold && typeof t.plannedRR === "number");
  const affected = eligible.filter((t) => (t.plannedRR as number) < minRR);
  return result(affected.length, affected, eligible.filter((t) => (t.plannedRR as number) >= minRR));
}

function evaluateRiskEscalationAfterLoss({ trades, params }: EvaluationInput): EvaluationOutput {
  const factor = Number(params.escalation_factor ?? 1.2);
  const sorted = [...trades].sort((a, b) => `${a.date}`.localeCompare(`${b.date}`));
  const affected: Trade[] = [];
  const compliant: Trade[] = [];
  for (let i = 1; i < sorted.length; i += 1) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    if (prev.date === curr.date && prev.resultR < 0) {
      if (curr.riskPct > prev.riskPct * factor) affected.push(curr);
      else compliant.push(curr);
    }
  }
  return result(affected.length, affected, compliant);
}

export const ruleEvaluators: Record<RuleType, (input: EvaluationInput) => EvaluationOutput> = {
  max_trades_per_day: evaluateMaxTradesPerDay,
  max_losses_per_day: evaluateMaxLossesPerDay,
  allowed_sessions: evaluateAllowedSessions,
  core_instruments: evaluateCoreInstruments,
  model_confirmation: evaluateModelConfirmation,
  emotion_filter: evaluateEmotionFilter,
  risk_range: evaluateRiskRange,
  min_planned_rr: evaluateMinPlannedRR,
  high_risk_requires_rr: evaluateHighRiskRequiresRR,
  risk_escalation_after_loss: evaluateRiskEscalationAfterLoss,
};

export const ruleLibrary: Record<RuleType, RuleDefinition> = {
  max_trades_per_day: { ruleType: "max_trades_per_day", title: "Максимум угод за день", category: "discipline", description: "Перевіряє, чи не перевищено денний ліміт входів.", paramsSchema: [{ key: "limit", label: "Максимальна кількість угод", type: "number", min: 1, max: 50, step: 1 }], defaultParams: { limit: 3 } },
  max_losses_per_day: { ruleType: "max_losses_per_day", title: "Стоп після збиткових угод", category: "risk", description: "Перевіряє, чи торгівля зупинялась після заданої кількості збитків за день.", paramsSchema: [{ key: "limit", label: "Максимум збитків за день", type: "number", min: 1, max: 20, step: 1 }], defaultParams: { limit: 2 } },
  allowed_sessions: { ruleType: "allowed_sessions", title: "Дозволені сесії", category: "session", description: "Перевіряє, чи угоди відкривались лише в дозволені торгові сесії.", paramsSchema: [{ key: "sessions", label: "Дозволені сесії", type: "session_list", options: ["Asia", "London", "NY"] }], defaultParams: { sessions: ["NY", "London"] } },
  core_instruments: { ruleType: "core_instruments", title: "Ядро інструментів", category: "session", description: "Перевіряє, чи торгівля велась лише обраними інструментами.", paramsSchema: [{ key: "pairs", label: "Дозволені інструменти", type: "pair_list", options: ["EUR/USD", "XAU/USD", "BTC/USDT", "GBP/USD", "ETH/USDT", "XAG/USD", "US30", "GER40"] }], defaultParams: { pairs: ["EUR/USD", "XAU/USD", "BTC/USDT"] } },
  model_confirmation: { ruleType: "model_confirmation", title: "Підтверджена модель входу", category: "setup", description: "Перевіряє угоди, позначені як такі, що не відповідають чіткій моделі входу.", paramsSchema: [], defaultParams: {} },
  emotion_filter: { ruleType: "emotion_filter", title: "Емоційний стан", category: "psychology", description: "Відстежує угоди, відкриті у визначених емоційних станах.", paramsSchema: [{ key: "states", label: "Стани для контролю", type: "session_list", options: ["Angry", "Neutral", "Tired"] }], defaultParams: { states: ["Angry"] } },
  risk_range: { ruleType: "risk_range", title: "Діапазон ризику на угоду", category: "risk", description: "Перевіряє, чи ризик на угоду залишається в дозволеному діапазоні.", paramsSchema: [{ key: "min_pct", label: "Мінімальний ризик %", type: "number", min: 0.1, max: 5, step: 0.1 }, { key: "max_pct", label: "Максимальний ризик %", type: "number", min: 0.5, max: 10, step: 0.1 }], defaultParams: { min_pct: 0.5, max_pct: 2 } },
  min_planned_rr: { ruleType: "min_planned_rr", title: "Мінімальний плановий RR", category: "setup", description: "Перевіряє, чи планований RR не нижче встановленого мінімуму.", paramsSchema: [{ key: "min_rr", label: "Мінімальний RR", type: "number", min: 0.5, max: 10, step: 0.1 }], defaultParams: { min_rr: 2 } },
  high_risk_requires_rr: { ruleType: "high_risk_requires_rr", title: "Високий ризик вимагає RR", category: "risk", description: "Перевіряє, чи ризик вище порогу використовується лише при відповідному RR.", paramsSchema: [{ key: "risk_threshold_pct", label: "Поріг ризику %", type: "number", min: 0.1, max: 5, step: 0.1 }, { key: "min_rr", label: "Мінімальний RR", type: "number", min: 0.5, max: 10, step: 0.1 }], defaultParams: { risk_threshold_pct: 1, min_rr: 2.5 } },
  risk_escalation_after_loss: { ruleType: "risk_escalation_after_loss", title: "Ескалація ризику після збитку", category: "psychology", description: "Детектує збільшення ризику після збиткової угоди того ж дня.", paramsSchema: [{ key: "escalation_factor", label: "Коефіцієнт зростання", type: "number", min: 1, max: 3, step: 0.1 }], defaultParams: { escalation_factor: 1.2 } },
};
