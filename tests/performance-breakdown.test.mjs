import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { breakdown, weekdayHourGrid, symbolKey, openedAt } = require("../.tmp-performance-breakdown-tests/lib/journal/performance-breakdown.js");

const tr = (opened_at, symbol, result_r, net_pnl, setup = null) => ({ opened_at, symbol, result_r, net_pnl, setup });

test("symbols are grouped regardless of separators and case", () => {
  assert.equal(symbolKey("EUR/USD"), "EURUSD");
  assert.equal(symbolKey("eurusd"), "EURUSD");
  const rows = breakdown([tr("2026-10-01T09:00:00Z", "EURUSD", 2, 100), tr("2026-10-01T10:00:00Z", "EUR/USD", -1, -50), tr("2026-10-01T11:00:00Z", "XAUUSD", null, 20)], "symbol", "UTC");
  assert.deepEqual(rows.map(r => [r.key, r.trades, r.withR, r.totalR, r.avgR, r.winRate, r.net]), [["EURUSD", 2, 2, 1, 0.5, 50, 50], ["XAUUSD", 1, 0, 0, null, 100, 20]]);
  assert.equal(rows[0].small, true);
});

test("weekday and hour follow the user's zone", () => {
  // Sunday 22:30 UTC = Monday 00:30 in Kyiv (EET, UTC+2 after 25 Oct).
  assert.deepEqual(openedAt({ opened_at: "2026-11-01T22:30:00Z" }, "Europe/Kyiv"), { weekday: 1, hour: 0 });
  assert.deepEqual(openedAt({ opened_at: "2026-11-01T22:30:00Z" }, "UTC"), { weekday: 7, hour: 22 });
  const trades = [tr("2026-11-01T22:30:00Z", "EURUSD", 1, 10), tr("2026-11-03T08:00:00Z", "EURUSD", -1, -10)];
  assert.deepEqual(breakdown(trades, "weekday", "Europe/Kyiv").map(r => r.key), ["1", "2"]);
  assert.deepEqual(breakdown(trades, "hour", "Europe/Kyiv").map(r => r.key), ["00", "10"]);
});

test("sessions keep market order; setups sort by total R with blanks grouped", () => {
  const trades = [
    tr("2026-11-03T14:00:00Z", "EURUSD", 1, 10, "Retest"), // New York (09:00 NY)
    tr("2026-11-03T08:30:00Z", "EURUSD", 3, 30, "Breakout"), // London
    tr("2026-11-03T02:00:00Z", "EURUSD", -2, -20), // Asia
    tr("2026-11-03T03:00:00Z", "EURUSD", -1, -10, "  "),
  ];
  assert.deepEqual(breakdown(trades, "session", "UTC").map(r => r.key), ["asia", "london", "new_york"]);
  assert.deepEqual(breakdown(trades, "setup", "UTC").map(r => [r.key, r.totalR]), [["Breakout", 3], ["Retest", 1], ["", -3]]);
});

test("weekday × hour grid is sparse and averages only known R", () => {
  const cells = weekdayHourGrid([tr("2026-11-03T08:10:00Z", "EURUSD", 2, 10), tr("2026-11-03T08:50:00Z", "EURUSD", null, 5), tr("2026-11-04T15:00:00Z", "EURUSD", -1, -5)], "UTC");
  assert.deepEqual(cells, [{ weekday: 2, hour: 8, trades: 2, withR: 1, totalR: 2, avgR: 2 }, { weekday: 3, hour: 15, trades: 1, withR: 1, totalR: -1, avgR: -1 }]);
});
