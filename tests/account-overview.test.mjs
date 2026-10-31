import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { buildAccountOverview, accountOverviewLabel } = require("../.tmp-account-overview-tests/account-overview.js");
const account = { id: "a", accountType: "prop", phase: "phase-3", initialBalance: 10000, targetPercent: 8, maxLossPercent: 10, dailyLossPercent: 5, minTradingDays: 4 };
const trade = value => ({ account_id: "a", net_pnl: value });
test("configured target uses only this account journal PnL", () => {
  const result = buildAccountOverview(account, [trade(600), trade(-100), { account_id: "other", net_pnl: 90000 }]);
  assert.equal(result.netPnl, 500); assert.equal(result.journalBalance, 10500); assert.equal(result.pnlPercent, 5);
  assert.equal(result.targetAmount, 800); assert.equal(result.progressPercent, 62.5); assert.equal(result.tradeCount, 2);
});
test("personal accounts never expose legacy prop settings", () => {
  const result = buildAccountOverview({ ...account, accountType: "personal" }, [trade(50)]);
  assert.equal(result.isProp, false);
  for (const key of ["targetPercent", "targetAmount", "progressPercent", "maxLossPercent", "dailyLossPercent", "minTradingDays"]) assert.equal(result[key], null);
  assert.equal(accountOverviewLabel({ ...account, accountType: "personal" }), "Особистий рахунок");
});
test("empty journal is zero PnL, not completed target", () => {
  const result = buildAccountOverview(account, []);
  assert.equal(result.netPnl, 0); assert.equal(result.journalBalance, 10000); assert.equal(result.progressPercent, 0);
});
test("missing target does not become zero percent target", () => {
  const result = buildAccountOverview({ ...account, targetPercent: undefined }, [trade(100)]);
  assert.equal(result.targetAmount, null); assert.equal(result.progressPercent, null);
});
test("negative return remains visible and bar stays within bounds", () => {
  const result = buildAccountOverview(account, [trade(-500)]);
  assert.equal(result.pnlPercent, -5); assert.equal(result.progressPercent, 0);
  const over = buildAccountOverview(account, [trade(1600)]);
  assert.equal(over.pnlPercent, 16); assert.equal(over.progressPercent, 100);
  assert.equal(Object.hasOwn(over, "passed"), false); assert.equal(Object.hasOwn(over, "breached"), false);
});
test("missing and nonfinite PnL never manufacture a complete total", () => {
  for (const value of [null, undefined, NaN, Infinity, -Infinity]) {
    const result = buildAccountOverview(account, [trade(100), trade(value)]);
    assert.equal(result.netPnl, null); assert.equal(result.journalBalance, null); assert.equal(result.progressPercent, null); assert.equal(result.missingPnlCount, 1);
  }
});
test("zero invalid and overflowing capital calculations stay finite or unavailable", () => {
  for (const initialBalance of [0, -1, NaN, Infinity]) {
    const result = buildAccountOverview({ ...account, initialBalance }, [trade(10)]);
    assert.equal(result.pnlPercent, null); assert.equal(result.targetAmount, null); assert.equal(result.progressPercent, null);
  }
  assert.equal(buildAccountOverview(account, [trade(1e308), trade(1e308)]).netPnl, null);
});
test("configured limits are metadata rather than a fabricated used limit", () => {
  const result = buildAccountOverview({ ...account, minTradingDays: 0 }, [trade(-100)]);
  assert.equal(result.maxLossPercent, 10); assert.equal(result.dailyLossPercent, 5); assert.equal(result.minTradingDays, 0);
  assert.equal(Object.hasOwn(result, "dailyLossUsed"), false); assert.equal(Object.hasOwn(result, "maxLossUsed"), false);
});
test("phase and account type are never inferred from manual or MT5", () => {
  assert.equal(accountOverviewLabel(account), "Проп · Phase 3");
  assert.equal(accountOverviewLabel({ ...account, phase: "manual" }), "Проп · Не задано");
  assert.equal(accountOverviewLabel({ ...account, accountType: undefined }), "Тип рахунку не задано");
});
