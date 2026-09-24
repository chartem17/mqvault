import type { RuleDefinition, RuleType, Trade } from "./types";

type EvaluationInput = {
  trades: Trade[];
  params: Record<string, unknown>;
};

type EvaluationOutput = {
  violations: number;
  affectedTrades: number;
  impactR: number;
  sampleSize: number;
  compliantImpactR: number;
  compliantCount: number;
};

const round = (value: number, digits = 2) => Number(value.toFixed(digits));
const sumR = (trades: Trade[]) => round(trades.reduce((sum, t) => sum + t.resultR, 0));

function groupByDay(trades: Trade[]): Map<string, Trade[]> {
  const map = new Map<string, Trade[]>();
  trades.forEach((trade) => {
    const list = map.get(trade.date) ?? [];
    list.push(trade);
    map.set(trade.date, list);
  });
  return map;
}

function evaluateMaxTradesPerDay({ trades, params }: EvaluationInput): EvaluationOutput {
  const limit = Number(params.limit ?? 3);
  const byDay = groupByDay(trades);
  const violatedDays = [...byDay.entries()].filter(([, list]) => list.length > limit);
  const violatedDates = new Set(violatedDays.map(([date]) => date));
  const affected = trades.filter((t) => violatedDates.has(t.date));
  const compliant = trades.filter((t) => !violatedDates.has(t.date));
  return {
    violations: violatedDays.length,
    affectedTrades: affected.length,
    impactR: sumR(affected),
    sampleSize: violatedDays.length,
    compliantImpactR: sumR(compliant),
    compliantCount: compliant.length,
  };
}

function evaluateMaxLossesPerDay({ trades, params }: EvaluationInput): EvaluationOutput {
  const limit = Number(params.limit ?? 2);
  const byDay = groupByDay(trades);
  const violatedDays = [...byDay.entries()].filter(
    ([, list]) => list.filter((t) => t.resultR < 0).length > limit,
  );
  const violatedDates = new Set(violatedDays.map(([date]) => date));
  const affected = trades.filter((t) => violatedDates.has(t.date));
  const compliant = trades.filter((t) => !violatedDates.has(t.date));
  return {
    violations: violatedDays.length,
    affectedTrades: affected.length,
    impactR: sumR(affected),
    sampleSize: violatedDays.length,
    compliantImpactR: sumR(compliant),
    compliantCount: compliant.length,
  };
}

function evaluateAllowedSessions({ trades, params }: EvaluationInput): EvaluationOutput {
  const allowed = (params.sessions as string[]) ?? ["NY", "London"];
  const violated = trades.filter((t) => !allowed.includes(t.session));
  const compliant = trades.filter((t) => allowed.includes(t.session));
  return {
    violations: violated.length,
    affectedTrades: violated.length,
    impactR: sumR(violated),
    sampleSize: violated.length,
    compliantImpactR: sumR(compliant),
    compliantCount: compliant.length,
  };
}

function evaluateCoreInstruments({ trades, params }: EvaluationInput): EvaluationOutput {
  const core = (params.pairs as string[]) ?? ["EUR/USD", "XAU/USD", "BTC/USDT"];
  const violated = trades.filter((t) => !core.includes(t.pair));
  const compliant = trades.filter((t) => core.includes(t.pair));
  return {
    violations: violated.length,
    affectedTrades: violated.length,
    impactR: sumR(violated),
    sampleSize: violated.length,
    compliantImpactR: sumR(compliant),
    compliantCount: compliant.length,
  };
}

function evaluateModelConfirmation({ trades }: EvaluationInput): EvaluationOutput {
  const known = trades.filter((t) => typeof t.modelConfirmed === "boolean");
  const violated = known.filter((t) => t.modelConfirmed === false);
  const compliant = known.filter((t) => t.modelConfirmed === true);
  return {
    violations: violated.length,
    affectedTrades: violated.length,
    impactR: sumR(violated),
    sampleSize: violated.length,
    compliantImpactR: sumR(compliant),
    compliantCount: compliant.length,
  };
}

function evaluateEmotionFilter({ trades, params }: EvaluationInput): EvaluationOutput {
  const badStates = (params.states as string[]) ?? ["Angry"];
  const violated = trades.filter((t) => t.emotion && badStates.includes(t.emotion));
  const compliant = trades.filter((t) => !t.emotion || !badStates.includes(t.emotion));
  return {
    violations: violated.length,
    affectedTrades: violated.length,
    impactR: sumR(violated),
    sampleSize: violated.length,
    compliantImpactR: sumR(compliant),
    compliantCount: compliant.length,
  };
}

export const ruleEvaluators: Record<RuleType, (input: EvaluationInput) => EvaluationOutput> = {
  max_trades_per_day: evaluateMaxTradesPerDay,
  max_losses_per_day: evaluateMaxLossesPerDay,
  allowed_sessions: evaluateAllowedSessions,
  core_instruments: evaluateCoreInstruments,
  model_confirmation: evaluateModelConfirmation,
  emotion_filter: evaluateEmotionFilter,
};

export const ruleLibrary: Record<RuleType, RuleDefinition> = {
  max_trades_per_day: {
    ruleType: "max_trades_per_day",
    title: "Максимум угод за день",
    category: "discipline",
    description: "Перевіряє, чи не перевищено денний ліміт входів.",
    paramsSchema: [{ key: "limit", label: "Максимальна кількість угод", type: "number", min: 1, max: 50, step: 1 }],
    defaultParams: { limit: 3 },
  },
  max_losses_per_day: {
    ruleType: "max_losses_per_day",
    title: "Стоп після збиткових угод",
    category: "risk",
    description: "Перевіряє, чи торгівля зупинялась після заданої кількості збитків за день.",
    paramsSchema: [{ key: "limit", label: "Максимум збитків за день", type: "number", min: 1, max: 20, step: 1 }],
    defaultParams: { limit: 2 },
  },
  allowed_sessions: {
    ruleType: "allowed_sessions",
    title: "Дозволені сесії",
    category: "session",
    description: "Перевіряє, чи угоди відкривались лише в дозволені торгові сесії.",
    paramsSchema: [{ key: "sessions", label: "Дозволені сесії", type: "session_list", options: ["Asia", "London", "NY"] }],
    defaultParams: { sessions: ["NY", "London"] },
  },
  core_instruments: {
    ruleType: "core_instruments",
    title: "Ядро інструментів",
    category: "session",
    description: "Перевіряє, чи торгівля велась лише обраними інструментами.",
    paramsSchema: [
      {
        key: "pairs",
        label: "Дозволені інструменти",
        type: "pair_list",
        options: ["EUR/USD", "XAU/USD", "BTC/USDT", "GBP/USD", "ETH/USDT", "XAG/USD", "US30", "GER40"],
      },
    ],
    defaultParams: { pairs: ["EUR/USD", "XAU/USD", "BTC/USDT"] },
  },
  model_confirmation: {
    ruleType: "model_confirmation",
    title: "Підтверджена модель входу",
    category: "setup",
    description: "Перевіряє угоди, позначені як такі, що не відповідають чіткій моделі входу.",
    paramsSchema: [],
    defaultParams: {},
  },
  emotion_filter: {
    ruleType: "emotion_filter",
    title: "Емоційний стан",
    category: "psychology",
    description: "Відстежує угоди, відкриті у визначених емоційних станах.",
    paramsSchema: [{ key: "states", label: "Стани для контролю", type: "session_list", options: ["Angry", "Neutral", "Tired"] }],
    defaultParams: { states: ["Angry"] },
  },
};
