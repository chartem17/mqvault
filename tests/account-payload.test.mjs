import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
const require = createRequire(import.meta.url);
const { buildAccountPayload } = require("../.tmp-account-payload-tests/account-payload.js");
const { parseAccountSetup } = require("../.tmp-account-payload-tests/account-setup.js");
const current = { account_type: "prop", platform: "mt5", initial_balance: "10000", phase: "phase-2", target_percent: "8", max_loss_percent: "10", daily_loss_percent: "5", min_trading_days: 4, mt5_login: "12345" };
test("all four creations preserve explicit type and platform", () => {
  for (const accountType of ["personal", "prop"]) for (const platform of ["manual", "mt5"]) {
    const result = buildAccountPayload({ name: "Test", accountType, platform, initialBalance: 10000, mt5Login: platform === "mt5" ? "12345" : null });
    assert.equal(result.account_type, accountType); assert.equal(result.platform, platform);
  }
});
test("name-only update does not overwrite setup or metadata", () => {
  assert.deepEqual(buildAccountPayload({ name: "Renamed" }, current), { name: "Renamed" });
});
test("platform and balance updates preserve omitted prop conditions", () => {
  assert.deepEqual(buildAccountPayload({ platform: "manual", initialBalance: 12000 }, current), { platform: "manual", initial_balance: 12000 });
});
test("changing one condition does not overwrite the others", () => {
  assert.deepEqual(buildAccountPayload({ targetPercent: 9 }, current), { target_percent: 9 });
  assert.deepEqual(buildAccountPayload({ minTradingDays: null }, current), { min_trading_days: null });
});
test("explicit conversion to personal clears prop conditions", () => {
  const result = buildAccountPayload({ accountType: "personal" }, current);
  assert.equal(result.account_type, "personal");
  for (const key of ["phase", "target_percent", "max_loss_percent", "daily_loss_percent", "min_trading_days"]) assert.equal(result[key], null);
});
test("snake aliases are supported without platform inference", () => {
  assert.equal(buildAccountPayload({ name: "Test", account_type: "personal", platform: "mt5", initial_balance: 1000, mt5_login: "1" }).account_type, "personal");
  assert.throws(() => buildAccountPayload({ name: "Test", platform: "mt5", initialBalance: 1000, mt5Login: "1" }));
});
test("conflicts bad metadata hidden personal conditions and oversized days are rejected", () => {
  const base = { name: "Test", accountType: "personal", platform: "manual", initialBalance: 1000 };
  for (const extra of [{ account_type: "prop" }, { platform: "mt5", mt5Login: 42 }, { targetPercent: 5 }, { currency: "invalid" }, { status: "invalid" }]) assert.throws(() => buildAccountPayload({ ...base, ...extra }));
  assert.throws(() => buildAccountPayload({ ...base, accountType: "prop", minTradingDays: 2147483648 }));
});
test("MT5 is an optional profile rather than a connection requirement", () => {
  for (const accountType of ["personal", "prop"]) {
    const result = buildAccountPayload({ name: "Test", accountType, platform: "mt5", initialBalance: 1000 });
    assert.equal(result.platform, "mt5"); assert.equal(result.account_type, accountType);
    assert.equal(Object.hasOwn(result, "mt5_login"), false);
  }
  assert.deepEqual(buildAccountPayload({ platform: "mt5" }, { ...current, mt5_login: null }), { platform: "mt5" });
});
test("phase type is strict rather than string-coerced", () => {
  for (const phase of [["phase-1"], { toString: () => "funded" }, true]) assert.throws(() => parseAccountSetup({ accountType: "prop", platform: "manual", initialBalance: 1000, phase }));
});
test("untrusted owner fields never enter database payload", () => {
  const result = buildAccountPayload({ name: "Test", accountType: "personal", platform: "manual", initialBalance: 1000, user_id: "foreign", id: "foreign" });
  assert.equal(Object.hasOwn(result, "user_id"), false); assert.equal(Object.hasOwn(result, "id"), false);
});
test("integration sources use the explicit setup flow", () => {
  const hook = readFileSync("src/hooks/use-trades.tsx", "utf8");
  assert.match(hook, /account_type: input.accountType/);
  assert.doesNotMatch(hook, /account_type: input.platform ===/);
  assert.match(hook, /minTradingDays: input.minTradingDays/);
  assert.match(readFileSync("src/components/account-switcher.tsx", "utf8"), /components\/accounts\/new-account-modal/);
});
