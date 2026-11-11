import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { monthProgress, goalStatus, reviewStreak } = require("../.tmp-goals-tests/lib/dashboard/goals.js");

const done = { setup: "Retest", emotion: "Calm", review: null };
const todo = { setup: null, emotion: null, review: null };
const t = (closed, net, r, mark = done) => ({ opened_at: closed, closed_at: closed, net_pnl: net, result_r: r, ...mark });
const NOW = Date.parse("2026-11-11T12:00:00Z");

test("month progress in the user's zone", () => {
  const trades = [
    t("2026-10-31T22:30:00Z", 10, 1),          // Kyiv: 1 Nov 00:30 — belongs to November
    t("2026-11-03T10:00:00Z", -30, -1, todo),
    t("2026-11-03T11:00:00Z", 10, 0.5),        // same day: net −20 → red day
    t("2026-11-05T10:00:00Z", 5, null),
    t("2026-10-30T10:00:00Z", 100, 5),         // October
    { opened_at: "2026-11-06T10:00:00Z", closed_at: null, net_pnl: null, result_r: null, ...todo },
  ];
  const p = monthProgress(trades, "Europe/Kyiv", NOW);
  assert.deepEqual(p, { month: "2026-11", r: 0.5, rCount: 3, closed: 4, redDays: 1, tradingDays: 3, reviewShare: 75 });
  const s = goalStatus(p, { targetR: 10, maxRedDays: 0, reviewShare: 90 });
  assert.equal(s.r.share, 0.05); assert.equal(s.r.done, false);
  assert.equal(s.redDays.done, false);
  assert.equal(s.review.done, false);
  assert.equal(goalStatus(p, { targetR: null, maxRedDays: 2, reviewShare: null }).redDays.done, true);
});

test("review streak skips empty days and stops at an unreviewed day", () => {
  const trades = [
    t("2026-11-10T10:00:00Z", 1, 1), t("2026-11-07T10:00:00Z", 1, 1), t("2026-11-06T10:00:00Z", 1, 1),
    t("2026-11-05T10:00:00Z", 1, 1, todo), t("2026-11-04T10:00:00Z", 1, 1),
  ];
  assert.equal(reviewStreak(trades, "Europe/Kyiv", NOW), 3);
  assert.equal(reviewStreak([...trades, t("2026-11-11T09:00:00Z", 1, 1, todo)], "Europe/Kyiv", NOW), 3, "today's open review does not break it yet");
  assert.equal(reviewStreak([...trades, t("2026-11-11T09:00:00Z", 1, 1)], "Europe/Kyiv", NOW), 4);
  assert.equal(reviewStreak([], "Europe/Kyiv", NOW), 0);
});
