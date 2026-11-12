import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { traderSummary } = require("../.tmp-trader-summary-tests/lib/journal/trader-summary.js");

const t = (opened, net, extra = {}) => ({ symbol: "EUR/USD", opened_at: opened, closed_at: opened, net_pnl: net, ...extra });

test("empty journal", () => {
  const s = traderSummary([], "Europe/Kyiv");
  assert.equal(s.closed, 0); assert.equal(s.winRate, null); assert.equal(s.firstDay, null); assert.equal(s.bestDay, null);
});

test("win rate, R, days in the user's zone, top symbol, best and worst day", () => {
  const trades = [
    t("2026-11-02T21:30:00Z", 50, { result_r: 1 }),            // Kyiv: 2026-11-02 23:30
    t("2026-11-02T22:30:00Z", -20, { result_r: -0.5 }),        // Kyiv: 2026-11-03 00:30 — next day
    t("2026-11-03T09:00:00Z", -40, { symbol: "XAUUSD", setup: "Retest" }),
    { symbol: "EURUSD", opened_at: "2026-11-04T09:00:00Z", closed_at: null, net_pnl: null }, // still open
  ];
  const s = traderSummary(trades, "Europe/Kyiv");
  assert.equal(s.closed, 3);
  assert.equal(s.winRate, 33.33);
  assert.equal(s.averageR, 0.25);
  assert.equal(s.tradingDays, 3);
  assert.equal(s.firstDay, "2026-11-02");
  assert.deepEqual(s.topSymbol, { symbol: "EURUSD", count: 3 }, "EUR/USD and EURUSD are one instrument");
  assert.equal(s.reviewedShare, 33.33);
  assert.deepEqual(s.bestDay, { day: "2026-11-02", net: 50 });
  assert.deepEqual(s.worstDay, { day: "2026-11-03", net: -60 });
});
