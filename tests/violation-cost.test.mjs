import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { violationCost, overDailyLimit } = require("../.tmp-violation-cost-tests/lib/strategy-control/violation-cost.js");

const tr = (id, date, time, resultR, extra = {}) => ({ id, date, openedAt: `${date}T${time}:00Z`, pair: "EUR/USD", direction: "Long", resultR, ...extra });
const none = () => [];

test("daily trade limit drops only trades after the limit, in opening order", () => {
  const trades = [tr("c", "2026-08-18", "12:00", -1), tr("a", "2026-08-18", "08:00", 2), tr("b", "2026-08-18", "10:00", -1), tr("d", "2026-08-19", "09:00", 1)];
  assert.deepEqual(overDailyLimit("max_trades_per_day", trades, 2).map(t => t.id), ["c"]);
  const cost = violationCost(trades, [{ ruleType: "max_trades_per_day", enabled: true, params: { limit: 2 } }], none);
  assert.deepEqual(cost.points.map(p => [p.tradeId, p.actualR, p.cleanR, p.violated]), [["a", 2, 2, false], ["b", 1, 1, false], ["c", 0, 1, true], ["d", 1, 2, false]]);
  assert.equal(cost.actualR, 1); assert.equal(cost.cleanR, 2); assert.equal(cost.costR, 1);
  assert.deepEqual(cost.byRule, [{ ruleType: "max_trades_per_day", trades: 1, resultR: -1 }]);
});

test("daily loss limit counts trades opened after the limit-th loss", () => {
  const trades = [tr("1", "2026-08-18", "08:00", -1), tr("2", "2026-08-18", "09:00", 3), tr("3", "2026-08-18", "10:00", -1), tr("4", "2026-08-18", "11:00", -1), tr("5", "2026-08-18", "12:00", 2)];
  assert.deepEqual(overDailyLimit("max_losses_per_day", trades, 2).map(t => t.id), ["4", "5"]);
});

test("a trade breaking two rules is removed once; per-rule totals may overlap", () => {
  const trades = [tr("x", "2026-08-18", "08:00", -2), tr("y", "2026-08-18", "09:00", 1)];
  const offenders = { emotion_filter: ["x"], allowed_sessions: ["x"] };
  const evaluate = (ruleType, list) => list.filter(t => (offenders[ruleType] ?? []).includes(t.id));
  const cost = violationCost(trades, [{ ruleType: "emotion_filter", enabled: true, params: {} }, { ruleType: "allowed_sessions", enabled: true, params: {} }, { ruleType: "risk_range", enabled: false, params: {} }], evaluate);
  assert.equal(cost.violatingTrades, 1); assert.equal(cost.costR, 2); assert.equal(cost.byRule.length, 2);
});

test("trades without R are left out and reported; sample size is flagged", () => {
  const trades = [tr("a", "2026-08-18", "08:00", 1), tr("b", "2026-08-18", "09:00", null)];
  const cost = violationCost(trades, [{ ruleType: "max_trades_per_day", enabled: true, params: { limit: 1 } }], none);
  assert.equal(cost.unknownR, 1); assert.equal(cost.points.length, 1); assert.equal(cost.violatingTrades, 0); assert.equal(cost.sample, "small");
  assert.equal(violationCost(trades, [], none).sample, "none");
  const many = Array.from({ length: 30 }, (_, i) => tr(`t${i}`, `2026-08-${String(10 + Math.floor(i / 3)).padStart(2, "0")}`, `0${i % 3 + 7}:00`, i % 2 ? 1 : -1));
  assert.equal(violationCost(many, [{ ruleType: "max_trades_per_day", enabled: true, params: { limit: 1 } }], none).sample, "ok");
});

test("displayed totals always add up after rounding", () => {
  const trades = [tr("a", "2026-08-18", "08:00", -2.0025), tr("b", "2026-08-18", "09:00", 1.3325), tr("c", "2026-08-18", "10:00", -2.1625), tr("d", "2026-08-19", "09:00", -4.0025)];
  const cost = violationCost(trades, [{ ruleType: "max_trades_per_day", enabled: true, params: { limit: 2 } }], none);
  assert.equal(Math.round((cost.cleanR - cost.actualR) * 100), Math.round(cost.costR * 100));
  assert.equal(cost.costR, -cost.byRule[0].resultR);
});
