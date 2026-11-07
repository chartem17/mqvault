import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const r = require("../.tmp-trade-review-tests/lib/journal/trade-review.js");

const trade = (id, opened_at, extra = {}) => ({ id, account_id: "a", opened_at, net_pnl: 10, ...extra });

test("review mark is read from meta and malformed marks are ignored", () => {
  assert.deepEqual(r.parseTradeReview({ review: { reviewed_at: "2026-11-07T10:00:00Z", followed_plan: false } }), { reviewed_at: "2026-11-07T10:00:00Z", followed_plan: false });
  assert.deepEqual(r.parseTradeReview({ review: { reviewed_at: "2026-11-07T10:00:00Z", followed_plan: "yes" } }), { reviewed_at: "2026-11-07T10:00:00Z", followed_plan: null });
  assert.equal(r.parseTradeReview({ review: { reviewed_at: "soon" } }), null);
  assert.equal(r.parseTradeReview({ tz_fixed: true }), null);
  assert.equal(r.parseTradeReview(null), null);
});

test("PATCH review input: object marks reviewed now, null clears, anything else is rejected", () => {
  const now = new Date("2026-11-07T12:00:00Z");
  assert.deepEqual(r.reviewFromInput({ followed_plan: true }, now), { reviewed_at: "2026-11-07T12:00:00.000Z", followed_plan: true });
  assert.deepEqual(r.reviewFromInput({}, now), { reviewed_at: "2026-11-07T12:00:00.000Z", followed_plan: null });
  assert.equal(r.reviewFromInput(null, now), null);
  assert.equal(r.reviewFromInput({ followed_plan: "no" }, now), undefined);
  assert.equal(r.reviewFromInput("yes", now), undefined);
});

test("needs review until reviewed or both setup and emotion are filled", () => {
  assert.equal(r.needsReview(trade("1", "2026-10-01T10:00:00Z")), true);
  assert.equal(r.needsReview(trade("2", "2026-10-01T10:00:00Z", { setup: "Retest" })), true);
  assert.equal(r.needsReview(trade("3", "2026-10-01T10:00:00Z", { setup: "Retest", emotion: "Calm" })), false);
  assert.equal(r.needsReview(trade("4", "2026-10-01T10:00:00Z", { setup: "  ", emotion: "Calm" })), true);
  assert.equal(r.needsReview(trade("5", "2026-10-01T10:00:00Z", { review: { reviewed_at: "2026-11-07T10:00:00Z", followed_plan: null } })), false);
});

test("queue groups by the user's day, newest day first, trades of a day in opening order", () => {
  const trades = [
    trade("a", "2026-10-01T09:00:00Z"),
    trade("b", "2026-09-30T22:30:00Z"), // 01.10 01:30 in Kyiv, 30.09 in UTC
    trade("c", "2026-10-02T08:00:00Z", { net_pnl: null }),
    trade("d", "2026-10-02T07:00:00Z"),
    trade("e", "2026-10-02T06:00:00Z", { setup: "Retest", emotion: "Calm" }),
  ];
  const kyiv = r.reviewQueue(trades, "Europe/Kyiv");
  assert.deepEqual(kyiv.map(day => [day.day, day.trades.map(t => t.id)]), [["2026-10-02", ["d", "c"]], ["2026-10-01", ["b", "a"]]]);
  assert.equal(kyiv[0].net, null);
  assert.equal(kyiv[1].net, 20);
  const utc = r.reviewQueue(trades, "UTC");
  assert.deepEqual(utc.map(day => day.day), ["2026-10-02", "2026-10-01", "2026-09-30"]);
});

test("chip lists: strategy first, then used by frequency, then defaults; duplicates ignore case", () => {
  const used = r.usedValues(["Retest", "retest", "Sweep", null, "", "Sweep", "Sweep"]);
  assert.deepEqual(used, ["Sweep", "Retest"]);
  assert.deepEqual(r.chipOptions(["London open"], used, ["Retest", "Breakout"]), ["London open", "Sweep", "Retest", "Breakout"]);
  assert.deepEqual(r.parseReviewChips({ setups: [" A  b ", "a b", 5, "x".repeat(61)], mistakes: "nope" }), { setups: ["A b"], mistakes: [] });
  assert.deepEqual(r.parseReviewChips(undefined), { setups: [], mistakes: [] });
});

test("review patch keeps empty fields empty and marks the trade reviewed", () => {
  const draft = r.draftFor(trade("1", "2026-10-01T10:00:00Z", { setup: "Retest", notes: "old" }));
  assert.deepEqual(draft, { setup: "Retest", emotion: "", mistake: "", followedPlan: null, notes: "old" });
  assert.deepEqual(r.reviewPatch("1", { ...draft, emotion: "Calm", followedPlan: false, notes: "  " }), { id: "1", setup: "Retest", emotion: "Calm", mistake: null, notes: null, review: { followed_plan: false } });
  assert.deepEqual(r.markReviewedPatch(trade("2", "2026-10-01T10:00:00Z")), { id: "2", review: { followed_plan: null } });
});

const { financialsChanged } = require("../.tmp-trade-review-tests/lib/journal/trade-financials.js");

test("PATCH keeps reconciled P/L: only a changed financial input triggers a recompute", () => {
  // Shape of an imported, reconciled trade as Supabase returns it (numerics as strings).
  const current = { direction: "Long", entry_price: "1.16500", exit_price: "1.17200", stop_loss: "1.16350", gross_pnl: "225.60", commission: "12.00", swap: "0.00", fee: "0.00", net_pnl: "213.60" };
  assert.equal(financialsChanged({ setup: "Retest", emotion: "Calm", notes: null }, current), false);
  // The edit modal resends every field with the same values (numbers, positive costs).
  assert.equal(financialsChanged({ direction: "Long", entry_price: 1.165, exit_price: 1.172, stop_loss: 1.1635, gross_pnl: 225.6, commission: 12, swap: 0, fee: 0 }, current), false);
  assert.equal(financialsChanged({ commission: -12 }, current), false);
  assert.equal(financialsChanged({ exit_price: 1.173 }, current), true);
  assert.equal(financialsChanged({ direction: "Short" }, current), true);
  assert.equal(financialsChanged({ stop_loss: null }, current), true);
});

test("server formulas: net treats costs as costs whatever the sign, R needs a valid stop", () => {
  const { derivedFinancials } = require("../.tmp-trade-review-tests/lib/journal/trade-financials.js");
  assert.deepEqual(derivedFinancials({ gross_pnl: -53.1, commission: -4.5, swap: 0, fee: 0, direction: "Long", entry_price: "1.16723", exit_price: 1.16669, stop_loss: 1.16669 }), { net_pnl: -57.6, result_r: -1 });
  assert.deepEqual(derivedFinancials({ gross_pnl: 10, commission: 2, swap: -0.5, fee: 1, direction: "Short", entry_price: 100, exit_price: 98, stop_loss: 101 }), { net_pnl: 6.5, result_r: 2 });
  assert.equal(derivedFinancials({ gross_pnl: 1, direction: "Long", entry_price: 1, exit_price: 2, stop_loss: 1.5 }).result_r, null);
});
