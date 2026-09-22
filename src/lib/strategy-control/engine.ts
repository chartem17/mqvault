import type { RuleFinding, StrategyAnalysis, Trade } from "./types";

const CORE_PAIRS = ["EUR/USD", "XAU/USD", "BTC/USDT"];
const ALLOWED_SESSIONS = ["NY", "London"];

const round = (value: number, digits = 2) => Number(value.toFixed(digits));

const daysWithMoreThan = (trades: Trade[], limit: number) => {
  const counts = new Map<string, number>();
  trades.forEach((trade) => counts.set(trade.date, (counts.get(trade.date) ?? 0) + 1));
  return [...counts.entries()].filter(([, count]) => count > limit);
};

const findingStatus = (violations: number, sampleSize: number, impactR: number): RuleFinding["status"] => {
  if (sampleSize < 5) return "insufficient";
  if (violations >= 3 && impactR < 0) return "critical";
  if (violations > 0) return "warning";
  return "ok";
};

export function analyzeTrades(
  trades: Trade[],
  period: { start: string; end: string },
): StrategyAnalysis {
  const totalR = trades.reduce((sum, trade) => sum + trade.resultR, 0);
  const wins = trades.filter((trade) => trade.resultR > 0).length;
  const averageRisk = trades.length ? trades.reduce((sum, trade) => sum + trade.riskPct, 0) / trades.length : 0;
  const days = new Set(trades.map((trade) => trade.date)).size;

  const overtradeDays = daysWithMoreThan(trades, 3);
  const overtradeDates = new Set(overtradeDays.map(([date]) => date));
  const overtradeTrades = trades.filter((trade) => overtradeDates.has(trade.date));
  const overtradeImpact = overtradeTrades.reduce((sum, trade) => sum + trade.resultR, 0);

  const lossesPerDay = new Map<string, number>();
  trades.filter((trade) => trade.resultR < 0).forEach((trade) => {
    lossesPerDay.set(trade.date, (lossesPerDay.get(trade.date) ?? 0) + 1);
  });
  const stopDays = [...lossesPerDay.entries()].filter(([, losses]) => losses >= 2);
  const stopDates = new Set(stopDays.map(([date]) => date));
  const stopDayTrades = trades.filter((trade) => stopDates.has(trade.date));
  const stopImpact = stopDayTrades.reduce((sum, trade) => sum + trade.resultR, 0);

  const asiaTrades = trades.filter((trade) => !ALLOWED_SESSIONS.includes(trade.session));
  const nonCoreTrades = trades.filter((trade) => !CORE_PAIRS.includes(trade.pair));
  const noModelTrades = trades.filter((trade) => trade.modelConfirmed === false);
  const angryTrades = trades.filter((trade) => trade.emotion === "Angry");
  const highRiskTrades = trades.filter((trade) => trade.riskPct > 1);

  const findings: RuleFinding[] = [
    {
      id: "max-trades",
      title: "Максимум 3 угоди за день",
      category: "Дисципліна обсягу",
      violations: overtradeDays.length,
      affectedTrades: overtradeTrades.length,
      impactR: round(overtradeImpact),
      sampleSize: overtradeDays.length,
      status: findingStatus(overtradeDays.length, days, overtradeImpact),
      message: overtradeDays.length ? `Ліміт перевищено у ${overtradeDays.length} днях.` : "Перевищень ліміту немає.",
      recommendation: overtradeDays.length ? "На наступний період залишити максимум 3 входи за день." : null,
    },
    {
      id: "stop-after-losses",
      title: "Зупинка після 2 збиткових угод",
      category: "Захист рахунку",
      violations: stopDays.length,
      affectedTrades: stopDayTrades.length,
      impactR: round(stopImpact),
      sampleSize: stopDays.length,
      status: findingStatus(stopDays.length, days, stopImpact),
      message: stopDays.length ? `${stopDays.length} днів мали щонайменше 2 збитки.` : "Серійних стоп-днів не знайдено.",
      recommendation: stopDays.length ? "Після другого збитку завершувати торгівлю до наступного дня." : null,
    },
    {
      id: "allowed-sessions",
      title: "Торгівля у дозволені сесії",
      category: "Час торгівлі",
      violations: asiaTrades.length,
      affectedTrades: asiaTrades.length,
      impactR: round(asiaTrades.reduce((sum, trade) => sum + trade.resultR, 0)),
      sampleSize: asiaTrades.length,
      status: asiaTrades.length < 5 ? "insufficient" : asiaTrades.some((trade) => trade.resultR < 0) ? "warning" : "ok",
      message: asiaTrades.length ? `${asiaTrades.length} угод поза NY/London.` : "Усі угоди у дозволених сесіях.",
      recommendation: asiaTrades.length >= 5 ? "До наступного звіту торгувати лише у дозволені сесії." : null,
    },
    {
      id: "core-instruments",
      title: "Інструменти з ядра стратегії",
      category: "Вибір інструмента",
      violations: nonCoreTrades.length,
      affectedTrades: nonCoreTrades.length,
      impactR: round(nonCoreTrades.reduce((sum, trade) => sum + trade.resultR, 0)),
      sampleSize: nonCoreTrades.length,
      status: nonCoreTrades.length >= 5 ? "warning" : "insufficient",
      message: nonCoreTrades.length ? `${nonCoreTrades.length} угод поза ядром.` : "Усі угоди в ядрі.",
      recommendation: nonCoreTrades.length >= 5 ? "Зосередитися на EUR/USD, XAU/USD і BTC/USDT." : null,
    },
    {
      id: "model-confirmation",
      title: "Підтверджена модель входу",
      category: "Якість сетапу",
      violations: noModelTrades.length,
      affectedTrades: noModelTrades.length,
      impactR: round(noModelTrades.reduce((sum, trade) => sum + trade.resultR, 0)),
      sampleSize: noModelTrades.length,
      status: noModelTrades.length < 5 ? "insufficient" : noModelTrades.some((trade) => trade.resultR < 0) ? "warning" : "ok",
      message: noModelTrades.length ? `${noModelTrades.length} угод позначені без підтвердженої моделі.` : "Усі моделі підтверджені.",
      recommendation: noModelTrades.length >= 5 ? "Не відкривати угоду без підтвердження моделі у чеклісті." : null,
    },
    {
      id: "emotion",
      title: "Емоційний стан",
      category: "Психологія",
      violations: angryTrades.length,
      affectedTrades: angryTrades.length,
      impactR: round(angryTrades.reduce((sum, trade) => sum + trade.resultR, 0)),
      sampleSize: angryTrades.length,
      status: angryTrades.length < 5 ? "insufficient" : angryTrades.some((trade) => trade.resultR < 0) ? "warning" : "ok",
      message: angryTrades.length ? `${angryTrades.length} угод у стані Angry.` : "Угод у стані Angry немає.",
      recommendation: angryTrades.length >= 5 ? "Перед входом у стані Angry робити паузу і не збільшувати ризик." : null,
    },
  ];

  const activeFindings = findings.filter((finding) => finding.status !== "ok");
  const weightedViolations = activeFindings.reduce((sum, finding) => sum + finding.violations, 0);
  const compliance = trades.length ? Math.max(0, Math.round(100 - (weightedViolations / trades.length) * 100)) : 0;
  const disciplineRisk = Math.min(100, Math.round(activeFindings.reduce((sum, finding) => sum + Math.max(0, -finding.impactR) * 10, 0)));

  return {
    period,
    trades: trades.length,
    winRate: trades.length ? round((wins / trades.length) * 100, 1) : 0,
    totalR: round(totalR),
    averageR: trades.length ? round(totalR / trades.length) : 0,
    averageRisk: round(averageRisk, 2),
    compliance,
    disciplineRisk,
    findings,
    recommendations: findings.filter((finding) => finding.recommendation).map((finding) => finding.recommendation as string),
  };
}
