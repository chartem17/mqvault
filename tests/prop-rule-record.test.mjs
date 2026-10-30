import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { settingsFromColumns, ruleRecordFromColumns, preparePropRuleUpdate, RuleRevisionConflict, parseRuleRecord } = require("../.tmp-prop-rule-tests/prop-rule-record.js");
const row = { id: "a", account_type: "prop", phase: "funded", prop_rules_revision: 2, target_percent: 8, max_loss_percent: 5, daily_loss_percent: null, min_trading_days: null };
test("legacy settings keep values and unknown absence without guessing mode", () => {
  const value = settingsFromColumns(row); assert.equal(value.target.state, "configured"); assert.equal(value.dailyLoss.state, "unknown"); assert.equal(value.maxLossMode, null);
});
test("phase-only update never resets conditions", () => { assert.deepEqual(preparePropRuleUpdate({ expectedRevision: 2, phase: "phase-3" }, row).payload, { phase: "phase-3" }); });
test("state-only update retains stored condition value", () => {
  assert.deepEqual(preparePropRuleUpdate({ expectedRevision: 2, settings: { target: { state: "not_applicable" } } }, row).payload, { prop_target_state: "not_applicable" });
});
test("explicit clear and sparse numeric update stay distinct", () => {
  assert.deepEqual(preparePropRuleUpdate({ expectedRevision: 2, settings: { target: { state: "unknown", value: null } } }, row).payload, { prop_target_state: "unknown", target_percent: null });
  assert.deepEqual(preparePropRuleUpdate({ expectedRevision: 2, settings: { maxLoss: { value: 6 } } }, row).payload, { max_loss_percent: 6 });
});
test("stale missing invalid revisions and injected fields fail", () => {
  assert.throws(() => preparePropRuleUpdate({ expectedRevision: 1, phase: null }, row), RuleRevisionConflict);
  for (const body of [{ phase: null }, { expectedRevision: -1, phase: null }, { expectedRevision: 2, user_id: "other" }, { expectedRevision: 2, settings: { maxLoss: { state: "configured", value: null } } }, { expectedRevision: 2, phase: ["funded"] }, { expectedRevision: 2, settings: {} }]) assert.throws(() => preparePropRuleUpdate(body, row));
});
test("personal accounts and wrong-account responses are rejected", () => {
  assert.throws(() => ruleRecordFromColumns({ ...row, account_type: "personal" }));
  assert.throws(() => parseRuleRecord(ruleRecordFromColumns(row), "other"));
});
test("database time format is normalized without inventing timezone", () => {
  const value = settingsFromColumns({ ...row, prop_day_close: "23:00:00" }); assert.equal(value.dayClose, "23:00"); assert.equal(value.dayTimezone, null);
});
