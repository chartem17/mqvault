import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { parsePropRuleSettings, legacyRuleCondition, eodTrailingReference } = require("../.tmp-prop-rule-tests/prop-rule-settings.js");
const unset = () => ({ state: "unknown", value: null });
const settings = () => ({ target: unset(), maxLoss: { state: "configured", value: 5 }, dailyLoss: unset(), minTradingDays: unset(), maxLossMode: "eod_trailing_percent", dayTimezone: null, dayClose: null, lossControlBasis: null, notes: null });
const snapshot = (balance, closedAt = "2026-10-29T20:00:00.000Z") => ({ accountId: "a", closedAt, balance });
const history = () => ({ accountId: "a", initialBalance: "10000", percent: "5", asOf: "2026-10-30T20:00:00.000Z", completeThrough: "2026-10-30T20:00:00.000Z", historyComplete: true, cashFlowsReconciled: true, source: "broker", snapshots: [snapshot("10400")] });
test("user example uses percent of EOD high water mark", () => {
  const result = eodTrailingReference(history());
  assert.equal(result.kind, "reference"); assert.equal(result.peakBalance, "10400"); assert.equal(result.floorBalance, "9880");
  assert.equal(Object.hasOwn(result, "passed"), false); assert.equal(Object.hasOwn(result, "breached"), false);
});
test("a lower later EOD balance never lowers the peak", () => {
  const result = eodTrailingReference({ ...history(), snapshots: [snapshot("10400"), snapshot("10200", "2026-10-30T20:00:00.000Z")] });
  assert.equal(result.peakBalance, "10400"); assert.equal(result.floorBalance, "9880");
});
test("decimal arithmetic is exact and does not choose broker rounding", () => {
  const result = eodTrailingReference({ ...history(), snapshots: [snapshot("10400.01")] });
  assert.equal(result.floorBalance, "9880.0095");
});
test("complete empty history explicitly uses the initial balance as baseline", () => {
  assert.equal(eodTrailingReference({ ...history(), snapshots: [] }).floorBalance, "9500");
});
test("incomplete estimated and cash flow histories are unavailable", () => {
  for (const extra of [{ historyComplete: false }, { cashFlowsReconciled: false }, { source: "manual" }, { source: "journal_estimate" }]) {
    const result = eodTrailingReference({ ...history(), ...extra });
    assert.equal(result.kind, "unavailable"); assert.equal(Object.hasOwn(result, "floorBalance"), false);
  }
});
test("foreign account duplicate future and invalid snapshot cutoffs are rejected", () => {
  for (const snapshots of [[{ ...snapshot("10400"), accountId: "other" }], [snapshot("10400"), snapshot("10500")], [snapshot("10400", "2026-10-31T20:00:00.000Z")], [snapshot("10400", "2026-02-30T20:00:00.000Z")]]) assert.throws(() => eodTrailingReference({ ...history(), snapshots }));
});
test("bad decimal inputs fail instead of being coerced or rounded", () => {
  for (const percent of ["0", "100.000001", "-5", "5e0", "NaN", "5.0000001"]) assert.throws(() => eodTrailingReference({ ...history(), percent }));
  for (const initialBalance of ["0", "Infinity", "10000.000000001", 10000]) assert.throws(() => eodTrailingReference({ ...history(), initialBalance }));
});
test("legacy null remains unknown and existing values remain configured", () => {
  assert.deepEqual(legacyRuleCondition(null), { state: "unknown", value: null });
  assert.deepEqual(legacyRuleCondition(5), { state: "configured", value: 5 });
  assert.deepEqual(legacyRuleCondition(0, true), { state: "configured", value: 0 });
});
test("inactive condition may retain its value without becoming active", () => {
  const input = settings(); input.target = { state: "not_applicable", value: 8 };
  assert.deepEqual(parsePropRuleSettings(input).target, input.target);
  assert.equal(parsePropRuleSettings(settings()).dayTimezone, null);
});
test("configured values, day settings and notes are validated", () => {
  const input = settings(); input.dayTimezone = "Europe/Kyiv"; input.dayClose = "23:00"; input.lossControlBasis = "equity"; input.notes = "  User rule  ";
  assert.equal(parsePropRuleSettings(input).notes, "User rule");
  for (const extra of [{ target: { state: "configured", value: null } }, { maxLoss: { state: "configured", value: 101 } }, { minTradingDays: { state: "configured", value: 1.5 } }, { dayTimezone: "Not/AZone" }, { dayClose: "24:00" }, { lossControlBasis: "guess" }, { maxLossMode: "intraday" }, { notes: "x".repeat(2001) }, { unknownField: true }]) assert.throws(() => parsePropRuleSettings({ ...settings(), ...extra }));
});
