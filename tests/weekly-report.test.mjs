import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const w = require("../.tmp-weekly-report-tests/lib/dashboard/weekly-report.js");

const tr = (id, opened_at, result_r, net_pnl, extra = {}) => ({ id, opened_at, symbol: "EURUSD", direction: "Long", result_r, net_pnl, ...extra });

test("weeks start on Monday", () => {
  assert.equal(w.weekStart("2026-11-08"), "2026-11-02"); // Sunday
  assert.equal(w.weekStart("2026-11-02"), "2026-11-02"); // Monday
  assert.equal(w.weekStart("2026-11-04"), "2026-11-02");
});

test("trades are attributed by opening day in the user's zone", () => {
  // Sunday 22:30 UTC = Monday 00:30 in Kyiv: next week there, this week in UTC.
  const trades = [tr("a", "2026-11-01T22:30:00Z", 1, 10)];
  assert.equal(w.weeklyReport(trades, "2026-11-02", "Europe/Kyiv").totals.trades, 1);
  assert.equal(w.weeklyReport(trades, "2026-11-02", "UTC").totals.trades, 0);
  assert.equal(w.weeklyReport(trades, "2026-10-26", "UTC").totals.trades, 1);
});

test("totals, days, best/worst and the previous week", () => {
  const trades = [
    tr("a", "2026-11-02T09:00:00Z", 2, 100), tr("b", "2026-11-02T11:00:00Z", -1, -50), tr("c", "2026-11-04T09:00:00Z", null, 20),
    tr("p", "2026-10-28T09:00:00Z", -1, -40),
  ];
  const report = w.weeklyReport(trades, "2026-11-05", "UTC");
  assert.equal(report.start, "2026-11-02"); assert.equal(report.end, "2026-11-08");
  assert.deepEqual(report.totals, { trades: 3, net: 70, withR: 2, totalR: 1, avgR: 0.5, winRate: 66.7 });
  assert.deepEqual(report.previous, { trades: 1, net: -40, withR: 1, totalR: -1, avgR: -1, winRate: 0 });
  assert.deepEqual(report.days.map(d => [d.day.slice(8), d.trades, d.totalR]), [["02", 2, 1], ["03", 0, 0], ["04", 1, 0], ["05", 0, 0], ["06", 0, 0], ["07", 0, 0], ["08", 0, 0]]);
  assert.equal(report.best.id, "a"); assert.equal(report.worst.id, "b");
});

test("no best without a winner, no worst without a loser", () => {
  const report = w.weeklyReport([tr("a", "2026-11-02T09:00:00Z", -1, -10)], "2026-11-02", "UTC");
  assert.equal(report.best, null); assert.equal(report.worst.id, "a");
});

test("discipline: review state, plan, mistakes by cost, emotions", () => {
  const reviewed = { reviewed_at: "2026-11-08T00:00:00Z" };
  const trades = [
    tr("a", "2026-11-02T09:00:00Z", -1, -10, { mistake: "Moved stop", review: { ...reviewed, followed_plan: false } }),
    tr("b", "2026-11-03T09:00:00Z", -2, -20, { mistake: "moved stop", emotion: "Angry" }),
    tr("c", "2026-11-03T10:00:00Z", -0.5, -5, { mistake: "Early entry", setup: "Retest", emotion: "Calm" }),
    tr("d", "2026-11-04T09:00:00Z", 3, 30, { review: { ...reviewed, followed_plan: true } }),
  ];
  const { discipline } = w.weeklyReport(trades, "2026-11-02", "UTC");
  assert.equal(discipline.reviewed, 3); assert.equal(discipline.waiting, 1); // c has setup+emotion
  assert.equal(discipline.followed, 1); assert.equal(discipline.broken, 1);
  assert.deepEqual(discipline.mistakes, [{ mistake: "Moved stop", trades: 2, totalR: -3 }, { mistake: "Early entry", trades: 1, totalR: -0.5 }]);
  assert.deepEqual(discipline.emotions.map(e => e.emotion), ["Angry", "Calm"]);
});

test("latest week with trades, or the current week when empty", () => {
  assert.equal(w.latestWeekWithTrades([tr("a", "2026-10-01T12:00:00Z", 1, 1)], "UTC"), "2026-09-28");
  assert.equal(w.latestWeekWithTrades([], "UTC", new Date("2026-11-08T12:00:00Z")), "2026-11-02");
});
