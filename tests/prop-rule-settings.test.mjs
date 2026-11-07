import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { parsePropRuleSettings, legacyRuleCondition } = require("../.tmp-prop-rule-tests/lib/accounts/prop-rule-settings.js");
const unset = () => ({ state: "unknown", value: null });
const settings = () => ({ target: unset(), maxLoss: { state: "configured", value: 5 }, dailyLoss: unset(), minTradingDays: unset() });
test("legacy null remains unknown and existing values remain configured", () => {
  assert.deepEqual(legacyRuleCondition(null), { state: "unknown", value: null });
  assert.deepEqual(legacyRuleCondition(5), { state: "configured", value: 5 });
  assert.deepEqual(legacyRuleCondition(0, true), { state: "configured", value: 0 });
});
test("inactive condition may retain its value without becoming active", () => {
  const input = settings(); input.target = { state: "not_applicable", value: 8 };
  assert.deepEqual(parsePropRuleSettings(input).target, input.target);
});
test("configured values are validated", () => {
  for (const extra of [{ target: { state: "configured", value: null } }, { maxLoss: { state: "configured", value: 101 } }, { maxLoss: { state: "configured", value: 0 } }, { dailyLoss: { state: "configured", value: -1 } }, { minTradingDays: { state: "configured", value: 1.5 } }, { minTradingDays: { state: "configured", value: -1 } }, { target: { state: "maybe", value: 1 } }]) assert.throws(() => parsePropRuleSettings({ ...settings(), ...extra }));
  assert.deepEqual(parsePropRuleSettings({ ...settings(), minTradingDays: { state: "configured", value: 0 } }).minTradingDays, { state: "configured", value: 0 });
});
test("removed trailing/EOD fields and unknown fields are rejected", () => {
  for (const extra of [{ maxLossMode: "eod_trailing_percent" }, { dayTimezone: "Europe/Kyiv" }, { dayClose: "23:00" }, { lossControlBasis: "equity" }, { notes: "x" }, { unknownField: true }]) assert.throws(() => parsePropRuleSettings({ ...settings(), ...extra }));
});
