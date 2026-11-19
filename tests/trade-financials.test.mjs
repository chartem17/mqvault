import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const f = require("../.tmp-trade-financials-tests/lib/journal/trade-financials.js");
const s = require("../.tmp-trade-financials-tests/lib/journal/trade-stats.js");

const closed = "2026-11-10T12:00:00Z";

test("R is measured from the initial stop: a stop moved into profit no longer erases a win", () => {
  // XAUUSD short, 0.05 lot: initial stop 4039.73, stop later moved to 4024.30 (in profit), closed there.
  const trade = { direction: "Short", entry_price: 4033.8, exit_price: 4024.25, stop_loss: 4024.3, initial_stop_loss: 4039.73, volume: 0.05, gross_pnl: 47.75, commission: 0.26, swap: 0, fee: 0, closed_at: closed };
  const d = f.derivedFinancials(trade, { initialBalance: 10000 });
  assert.equal(d.risk_basis, "stop");
  assert.equal(d.risk_amount, 29.65, "5.93 × 0.05 lot × 100 per lot (value read from the trade itself)");
  assert.equal(d.risk_percent, 0.2965);
  assert.equal(d.result_r, 1.6017);
  // The old formula measured from the LAST stop: risk ≤ 0 → no R at all.
  assert.equal(f.calcPriceR("Short", 4033.8, 4024.25, 4024.3), null);
});

test("a tightened stop no longer inflates R", () => {
  // EURUSD short 0.15 lot: initial stop 1.16750 (27.8 pips), trailed to 1.16500 (2.8 pips).
  const trade = { direction: "Short", entry_price: 1.16472, exit_price: 1.16068, stop_loss: 1.165, initial_stop_loss: 1.1675, volume: 0.15, gross_pnl: 60.6, commission: 3, swap: 0, fee: 0, closed_at: closed };
  const d = f.derivedFinancials(trade, { initialBalance: 5000 });
  assert.equal(d.risk_amount, 41.7);
  assert.equal(d.result_r, 1.3813);
  assert.equal(f.calcPriceR("Short", 1.16472, 1.16068, 1.165), 14.4286, "what the last stop gave");
});

test("a break-even trade takes the value per lot from the account's other trades of the symbol", () => {
  // GER40 long 1 lot, closed at entry: the trade itself says nothing about the value of a point.
  const peers = [
    { direction: "Long", entry_price: 25593.675, exit_price: 25748.675, volume: 1, gross_pnl: 176.7, closed_at: closed },
    { direction: "Long", entry_price: 25713.425, exit_price: 25748.675, volume: 1.25, gross_pnl: 50.23, closed_at: closed },
    { direction: "Long", entry_price: 25731.52, exit_price: 25748.675, volume: 1.7, gross_pnl: 33.25, closed_at: closed },
  ];
  const value = f.calibrateValuePerLot(peers);
  assert.ok(Math.abs(value - 1.14) < 0.01, `about 1.14 USD per point per lot, got ${value}`);
  const be = { direction: "Long", entry_price: 25600, exit_price: 25600, initial_stop_loss: 25550, volume: 1, gross_pnl: 0, commission: 0.5, swap: 0, fee: 0, closed_at: closed };
  const d = f.derivedFinancials(be, { initialBalance: 10000, valuePerLot: value });
  assert.equal(d.risk_basis, "stop");
  assert.equal(d.risk_amount, Math.round(50 * value * 100) / 100);
  assert.ok(d.result_r < 0 && d.result_r > -0.02, "a small negative R from costs, not null");
  // Without any calibration the trade still gets its price R (0).
  assert.equal(f.derivedFinancials(be).result_r, 0);
});

test("value per lot works for FX, metals, indices and crypto without contract specs", () => {
  const v = (direction, entry, exit, volume, gross) => f.tradeValuePerLot({ direction, entry_price: entry, exit_price: exit, volume, gross_pnl: gross, closed_at: closed });
  assert.ok(Math.abs(v("Long", 1.11978, 1.11759, 0.48, -105.12) - 100000) < 1, "EURUSD: 100 000 per lot");
  assert.ok(Math.abs(v("Long", 4053.33, 4040.41, 0.03, -38.76) - 100) < 0.01, "XAUUSD: 100 oz");
  assert.ok(Math.abs(v("Short", 59.073, 59.437, 0.01, -18.2) - 5000) < 0.5, "XAGUSD: 5 000 oz");
  assert.ok(Math.abs(v("Short", 52562.662, 52631.975, 0.71, -49.21) - 1) < 0.01, "US30: 1 USD per point");
  assert.ok(Math.abs(v("Long", 77403.01, 79433.96, 0.03, 60.93) - 1) < 0.01, "BTCUSD: 1 coin");
  assert.equal(v("Long", 1.1, 1.1, 1, 0), null, "no move, no value");
  assert.equal(v("Long", 1.1, 1.1001, 0.01, 0.1), null, "gross under 1 is too coarse");
  assert.equal(f.tradeValuePerLot({ direction: "Long", entry_price: 1, exit_price: 2, volume: 1, gross_pnl: 5, closed_at: null }), null, "open trade");
  assert.equal(v("Long", 1.1, 1.2, 1, -50), null, "sign that contradicts the move (bad data)");
});

test("without a usable stop the owner's risk is used: amount, or % of the starting balance", () => {
  const base = { direction: "Long", entry_price: 1.1, exit_price: 1.105, volume: 1, gross_pnl: 500, commission: 0, swap: 0, fee: 0, closed_at: closed };
  assert.deepEqual(f.calcRisk({ ...base, risk_percent: 1 }, { initialBalance: 5000 }), { risk_amount: 50, risk_percent: 1, risk_basis: "entered" });
  assert.deepEqual(f.calcRisk({ ...base, risk_amount: 40 }, { initialBalance: 5000 }), { risk_amount: 40, risk_percent: 0.8, risk_basis: "entered" });
  assert.equal(f.derivedFinancials({ ...base, risk_percent: 1 }, { initialBalance: 5000 }).result_r, 10);
  // The stop beats a typed risk: it is the broker's fact.
  assert.equal(f.calcRisk({ ...base, initial_stop_loss: 1.098, risk_percent: 1 }, { initialBalance: 5000 }).risk_amount, 200);
  // A risk derived earlier is never mistaken for a typed one once the stop is gone.
  assert.deepEqual(f.calcRisk({ ...base, risk_amount: 200, risk_percent: 4, risk_basis: "stop" }, { initialBalance: 5000 }), { risk_amount: null, risk_percent: null, risk_basis: null });
  // The planned estimate keeps its label.
  assert.equal(f.calcRisk({ ...base, risk_percent: 1, risk_basis: "planned" }, { initialBalance: 5000 }).risk_basis, "planned");
  assert.deepEqual(f.calcRisk(base), { risk_amount: null, risk_percent: null, risk_basis: null });
});

test("an open trade has a risk but no R yet", () => {
  const open = { direction: "Long", entry_price: 1.1, exit_price: null, initial_stop_loss: 1.098, volume: 0.5, gross_pnl: 0, closed_at: null };
  const d = f.derivedFinancials(open, { initialBalance: 5000, valuePerLot: 100000 });
  assert.equal(d.risk_amount, 100);
  assert.equal(d.result_r, null);
});

test("partial closes: one volume-weighted exit gives the same value per lot as the sum of the parts", () => {
  // XAUUSD short 4 lots at 2003: 2 closed at 1990 (+2600), 2 at 1996 (+1400) → VWAP exit 1993, gross 4000.
  const value = f.tradeValuePerLot({ direction: "Short", entry_price: 2003, exit_price: 1993, volume: 4, gross_pnl: 4000, closed_at: closed });
  assert.equal(value, 100);
  const d = f.derivedFinancials({ direction: "Short", entry_price: 2003, exit_price: 1993, initial_stop_loss: 2008, volume: 4, gross_pnl: 4000, closed_at: closed });
  assert.equal(d.risk_amount, 2000);
  assert.equal(d.result_r, 2);
});

test("symbol keys and per-symbol calibration", () => {
  assert.equal(f.valueKey("EURUSD.raw"), "EURUSD");
  assert.equal(f.valueKey(" eurusd "), "EURUSD");
  assert.equal(f.valueKey("US30.cash"), "US30");
  const map = f.valuesBySymbol([
    { symbol: "EURUSD", direction: "Long", entry_price: 1.1, exit_price: 1.101, volume: 1, gross_pnl: 100, closed_at: closed },
    { symbol: "EURUSD.raw", direction: "Short", entry_price: 1.1, exit_price: 1.102, volume: 0.5, gross_pnl: -100, closed_at: closed },
    { symbol: "XAUUSD", direction: "Long", entry_price: 2000, exit_price: 2000, volume: 1, gross_pnl: 0, closed_at: closed },
  ]);
  assert.ok(Math.abs(map.get("EURUSD") - 100000) < 1e-6);
  assert.equal(map.has("XAUUSD"), false);
  assert.equal(f.calibrateValuePerLot([]), null);
});

// ---------- aggregates ----------
const t = (net, r, fields = {}) => ({ opened_at: "2026-11-01T10:00:00Z", closed_at: "2026-11-01T12:00:00Z", net_pnl: net, result_r: r, ...fields });

test("dashboard stats: a missing R is not 0R, and open trades do not count", () => {
  const trades = [t(100, 2), t(-50, -1), t(30, null), t(0, 0), t(0, null, { closed_at: null })];
  const stats = s.computeStats(trades);
  assert.equal(stats.total, 4);
  assert.equal(stats.winRate, 50);
  assert.equal(stats.be, 1);
  assert.equal(stats.rCount, 3);
  assert.equal(stats.avgR, 1 / 3, "(2 − 1 + 0) / 3, not / 5");
  assert.equal(stats.expectancy, 20);
  assert.equal(stats.profitFactor, 130 / 50);
  const buckets = Object.fromEntries(s.rDistribution(trades).map(b => [b.range, b.count]));
  assert.equal(buckets["-2..-1R"], 1);
  assert.equal(buckets["-1..0R"], 1, "only the 0R trade: trades without R (closed or open) are not counted as 0R");
  assert.equal(buckets["1..2R"], 1);
});

test("drawdown is measured from balance + profit, a losing start included", () => {
  const trades = [
    t(-100, -1, { closed_at: "2026-11-01T10:00:00Z" }),
    t(300, 3, { closed_at: "2026-11-02T10:00:00Z" }),
    t(-120, -1, { closed_at: "2026-11-03T10:00:00Z" }),
  ];
  assert.deepEqual(s.maxDrawdown(trades, 5000), { amount: -120, pct: -2.31 }, "−120 from the 5 200 peak");
  assert.deepEqual(s.maxDrawdown(trades.slice(0, 1), 5000), { amount: -100, pct: -2 }, "the old formula showed 0 % here");
  assert.deepEqual(s.maxDrawdown(trades), { amount: -120, pct: null }, "no balance: money only");
  // Order of closing, not of opening.
  const reordered = [t(-120, -1, { opened_at: "2026-10-01T00:00:00Z", closed_at: "2026-11-03T10:00:00Z" }), ...trades.slice(0, 2)];
  assert.equal(s.maxDrawdown(reordered, 5000).amount, -120);
});
