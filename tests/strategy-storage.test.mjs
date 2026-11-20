import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { parseStrategyRules, toStrategyProfile, StrategyInputError } = require("../.tmp-strategy-storage-tests/lib/strategy-control/strategy-storage.js");

const ID = "11111111-2222-4333-8444-555555555555";

test("defaults fill missing parameters and the saved ones are kept", () => {
  const [rule] = parseStrategyRules([{ ruleType: "risk_range", enabled: true, params: { max_pct: 1.5 } }]);
  assert.deepEqual(rule, { ruleType: "risk_range", enabled: true, params: { min_pct: 0.5, max_pct: 1.5 } });
});

test("unknown, duplicated or malformed rules are refused", () => {
  const bad = [
    "not a list",
    [{ ruleType: "no_such_rule", enabled: true }],
    [{ ruleType: "risk_range", enabled: "yes" }],
    [{ ruleType: "risk_range", enabled: true }, { ruleType: "risk_range", enabled: false }],
    [{ ruleType: "risk_range", enabled: true, params: { evil: 1 } }],
  ];
  for (const value of bad) assert.throws(() => parseStrategyRules(value), StrategyInputError, JSON.stringify(value));
});

test("numbers respect the schema: range, integer steps, min below max", () => {
  assert.throws(() => parseStrategyRules([{ ruleType: "max_trades_per_day", enabled: true, params: { limit: 0 } }]), StrategyInputError);
  assert.throws(() => parseStrategyRules([{ ruleType: "max_trades_per_day", enabled: true, params: { limit: 2.5 } }]), StrategyInputError);
  assert.throws(() => parseStrategyRules([{ ruleType: "risk_range", enabled: true, params: { min_pct: 3, max_pct: 1 } }]), StrategyInputError);
  assert.equal(parseStrategyRules([{ ruleType: "max_trades_per_day", enabled: true, params: { limit: 4 } }])[0].params.limit, 4);
});

test("lists are bounded, de-duplicated and checked against their options", () => {
  const [pairs] = parseStrategyRules([{ ruleType: "core_instruments", enabled: true, params: { pairs: ["EUR/USD", "EUR/USD", "XAU/USD"] } }]);
  assert.deepEqual(pairs.params.pairs, ["EUR/USD", "XAU/USD"]);
  assert.throws(() => parseStrategyRules([{ ruleType: "core_instruments", enabled: true, params: { pairs: Array(201).fill("X") } }]), StrategyInputError);
  assert.throws(() => parseStrategyRules([{ ruleType: "emotion_filter", enabled: true, params: { states: ["Furious"] } }]), StrategyInputError);
});

test("a stored row becomes a profile; a broken row is refused", () => {
  const profile = toStrategyProfile({ id: ID, account_id: ID, name: "TS", description: null, created_at: "2026-11-20T10:00:00Z", definition: { rules: [{ ruleType: "model_confirmation", enabled: true }], review: { setups: ["Retest"], mistakes: [] } } });
  assert.equal(profile.createdAt, "2026-11-20");
  assert.equal(profile.description, "");
  assert.deepEqual(profile.rules, [{ ruleType: "model_confirmation", enabled: true, params: {} }]);
  assert.deepEqual(profile.reviewChips.setups, ["Retest"]);
  assert.throws(() => toStrategyProfile({ id: "bad", account_id: ID, name: "x", description: null, created_at: "2026-11-20", definition: {} }), StrategyInputError);
});
