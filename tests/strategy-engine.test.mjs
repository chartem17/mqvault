import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { analyzeTrades } = require("../.tmp-strategy-engine-tests/lib/strategy-control/engine.js");

const period = { start: "2026-11-01", end: "2026-11-30" };
const strategy = rules => ({ id: "s", name: "S", createdAt: "2026-11-01T00:00:00Z", rules: rules.map(([ruleType, params = {}]) => ({ ruleType, enabled: true, params })) });
let n = 0;
const trade = (fields = {}) => ({ id: `t${++n}`, date: "2026-11-03", pair: "EUR/USD", direction: "Long", resultR: 1, ...fields });

test("a rule with no data is 'no_data', not a small sample, and names what is missing", () => {
  const result = analyzeTrades([trade(), trade()], strategy([["risk_range", { min_pct: 0.5, max_pct: 2 }]]), period);
  const [finding] = result.findings;
  assert.equal(finding.status, "no_data");
  assert.equal(finding.recommendation, null);
  assert.match(finding.message, /risk %/);
});

test("compliance is unknown, not 0 %, when no trade could be checked", () => {
  const result = analyzeTrades([trade(), trade()], strategy([["risk_range"], ["emotion_filter"]]), period);
  assert.equal(result.compliance, null);
  assert.equal(result.checkedTrades, 0);
  assert.equal(result.cleanTrades, 0);
});

test("only trades a rule actually checked count, not every trade of the period", () => {
  const trades = [trade({ riskPct: 1 }), trade({ riskPct: 3 }), trade(), trade()];
  const result = analyzeTrades(trades, strategy([["risk_range", { min_pct: 0.5, max_pct: 2 }]]), period);
  assert.equal(result.checkedTrades, 2);
  assert.equal(result.cleanTrades, 1);
  assert.equal(result.compliance, 50);
});

test("a few violations on a tiny sample stay 'insufficient'", () => {
  const result = analyzeTrades([trade({ riskPct: 3 }), trade({ riskPct: 1 })], strategy([["risk_range", { min_pct: 0.5, max_pct: 2 }]]), period);
  assert.equal(result.findings[0].status, "insufficient");
});

test("a trade over the daily limit breaks the rule even without a known R", () => {
  const day = [trade({ openedAt: "2026-11-03T08:00:00Z" }), trade({ openedAt: "2026-11-03T09:00:00Z" }), trade({ openedAt: "2026-11-03T10:00:00Z", resultR: null })];
  const result = analyzeTrades(day, strategy([["max_trades_per_day", { limit: 2 }]]), period);
  assert.equal(result.checkedTrades, 3);
  assert.equal(result.cleanTrades, 2);
  // R statistics still ignore the trade without R.
  assert.equal(result.findings[0].affectedTrades, 0);
});

test("win rate counts every closed trade with a net, like the journal", () => {
  const trades = [
    trade({ closedAt: "2026-11-03T12:00:00Z", netPnl: 50, resultR: 1 }),
    trade({ closedAt: "2026-11-03T13:00:00Z", netPnl: -20, resultR: -1 }),
    trade({ closedAt: "2026-11-03T14:00:00Z", netPnl: 30, resultR: null }), // no risk known: still a win
    trade({ closedAt: null, netPnl: null, resultR: null }), // still open: not counted
  ];
  assert.equal(analyzeTrades(trades, strategy([]), period).winRate, 66.7);
});
