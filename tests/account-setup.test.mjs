import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { parseAccountSetup, AccountSetupError } = require("../.tmp-account-tests/account-setup.js");
const base = { accountType: "prop", platform: "manual", initialBalance: 10000 };

test("all four account type and platform combinations are independent", () => {
  for (const accountType of ["personal", "prop"]) for (const platform of ["manual", "mt5"]) {
    const result = parseAccountSetup({ accountType, platform, initialBalance: 10000 });
    assert.equal(result.accountType, accountType);
    assert.equal(result.platform, platform);
  }
});
test("MT5 does not implicitly select prop", () => {
  assert.throws(() => parseAccountSetup({ platform: "mt5", initialBalance: 10000 }), AccountSetupError);
});
test("unspecified prop conditions remain null rather than invented defaults", () => {
  const result = parseAccountSetup(base);
  for (const field of ["phase", "targetPercent", "maxLossPercent", "dailyLossPercent", "minTradingDays"]) assert.equal(result[field], null);
});
test("explicit conditions and zero minimum days are preserved", () => {
  const result = parseAccountSetup({ ...base, phase: "phase-2", targetPercent: 8, maxLossPercent: 10, dailyLossPercent: 5, minTradingDays: 0 });
  assert.equal(result.phase, "phase-2");
  assert.equal(result.targetPercent, 8);
  assert.equal(result.maxLossPercent, 10);
  assert.equal(result.dailyLossPercent, 5);
  assert.equal(result.minTradingDays, 0);
});
test("personal accounts reject hidden prop settings", () => {
  for (const field of ["targetPercent", "maxLossPercent", "dailyLossPercent", "minTradingDays"]) assert.throws(() => parseAccountSetup({ ...base, accountType: "personal", [field]: 5 }), AccountSetupError);
  assert.throws(() => parseAccountSetup({ ...base, accountType: "personal", phase: "funded" }), AccountSetupError);
});
test("all supported phases are properties of a single account", () => {
  for (const phase of ["phase-1", "phase-2", "phase-3", "funded"]) assert.equal(parseAccountSetup({ ...base, phase }).phase, phase);
  assert.throws(() => parseAccountSetup({ ...base, phase: "unknown" }), AccountSetupError);
});
test("numeric strings booleans nonfinite and invalid percentages are rejected", () => {
  for (const field of ["targetPercent", "maxLossPercent", "dailyLossPercent"]) for (const value of ["5", true, NaN, Infinity, -1, 0, 101]) assert.throws(() => parseAccountSetup({ ...base, [field]: value }), AccountSetupError);
});
test("minimum days must be a nonnegative safe integer", () => {
  for (const value of [-1, 1.5, "4", true, Infinity, Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => parseAccountSetup({ ...base, minTradingDays: value }), AccountSetupError);
});
test("prop size is positive and personal zero balance is allowed", () => {
  assert.throws(() => parseAccountSetup({ ...base, initialBalance: 0 }), AccountSetupError);
  assert.equal(parseAccountSetup({ ...base, accountType: "personal", initialBalance: 0 }).initialBalance, 0);
  for (const initialBalance of [-1, "10000", true, NaN, Infinity]) assert.throws(() => parseAccountSetup({ ...base, initialBalance }), AccountSetupError);
});
test("malformed setups and unknown account types or platforms are rejected", () => {
  for (const value of [null, [], "prop", {}, { ...base, accountType: "other" }, { ...base, platform: "other" }]) assert.throws(() => parseAccountSetup(value), AccountSetupError);
});
test("parser does not mutate input or return owner-controlled fields", () => {
  const input = Object.freeze({ ...base, user_id: "untrusted", parentAccountId: "untrusted" });
  const result = parseAccountSetup(input);
  assert.equal(Object.hasOwn(result, "user_id"), false);
  assert.equal(Object.hasOwn(result, "parentAccountId"), false);
  assert.equal(input.accountType, "prop");
});
