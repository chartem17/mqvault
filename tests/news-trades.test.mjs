import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const m = require("../.tmp-news-trades-tests/lib/news/news-trades.js");

const T = Date.parse("2026-09-04T12:30:00Z"); // NFP
const at = (min) => new Date(T + min * 60_000).toISOString();
const nfp = { id: "nfp", title: "Nonfarm Payrolls", event_code: "nonfarm-payrolls", currency: "USD", impact: "high", event_time: at(0) };
const ecb = { id: "ecb", title: "ECB Rate Decision", event_code: "ecb-rate", currency: "EUR", impact: "high", event_time: at(105) };
const pmi = { id: "pmi", title: "ISM PMI", event_code: "ism", currency: "USD", impact: "medium", event_time: at(-20) };
const holiday = { id: "hol", title: "Labor Day", currency: "USD", impact: "holiday", event_type: "holiday", all_day: true, event_time: at(5) };
const low = { id: "low", title: "Low", currency: "USD", impact: "low", event_time: at(1) };
const trade = (id, symbol, open, close, net = 10, r = 1, extra = {}) => ({ id, symbol, opened_at: at(open), closed_at: close === null ? null : at(close), net_pnl: net, result_r: r, ...extra });

test("symbols map to calendar currencies", () => {
  const f = m.newsCurrenciesForSymbol;
  assert.deepEqual(f("EURUSD"), ["USD", "EUR"]);
  assert.deepEqual(f("eurusd.m"), ["USD", "EUR"]);
  assert.deepEqual(f("GBP/JPY"), ["GBP", "JPY"]);
  assert.deepEqual(f("XAUUSD"), ["USD"]);
  assert.deepEqual(f("BTCUSDT"), ["USD"]);
  assert.deepEqual(f("NDX100"), ["USD"]);
  assert.deepEqual(f("DJI30cash"), ["USD"]);
  assert.deepEqual(f("GER40"), ["EUR"]);
  assert.deepEqual(f("UK100-ecn"), ["GBP"]);
  assert.deepEqual(f("USDCNH"), ["USD"]);
  assert.deepEqual(f("SOMETHING"), []);
  assert.deepEqual(f("X", "eur", "chf"), ["EUR", "CHF"]);
});

test("relation windows and their priority", () => {
  const c = (o, cl, e) => m.classifyTradeEvent(T + o * 60_000, cl === null ? null : T + cl * 60_000, T + e * 60_000);
  assert.equal(c(-10, 40, 0), "open_at_release");
  assert.equal(c(0, 40, 0), "open_at_release", "opened exactly at release");
  assert.equal(c(-30, 30, 0), "open_at_release");
  assert.equal(c(25, 60, 0), "opened_near", "entry 25 min after release");
  assert.equal(c(-30, -20, 0), "opened_near", "opened 30 min before, closed before release");
  assert.equal(c(-90, -25, 0), "closed_near");
  assert.equal(c(-200, -100, 0), "within_2h");
  assert.equal(c(80, 150, 0), "within_2h");
  assert.equal(c(-300, -121, 0), null);
  assert.equal(c(121, 200, 0), null);
  assert.equal(c(10, null, 0), "opened_near", "open trade");
  assert.equal(c(100, null, 0), "within_2h");
});

test("trade summaries: currency filter, impact filter, buckets, nearest red release, tags", () => {
  const trades = [
    trade("eu-through", "EURUSD", -15, 20),        // through NFP, ECB 105 min after entry is outside ±30 but within 2h
    trade("gbpjpy", "GBPJPY", -15, 20),            // no USD leg: clear
    trade("gold-after", "XAUUSD", 60, 90),         // NFP 60 min before entry: within_2h only
    trade("index-pmi", "NDX100", -10, -5),         // only medium PMI near, NFP 10 min after entry → opened_near
    trade("far", "EURUSD", 600, 700),              // nothing within 4h
    trade("bad", "EURUSD", 0, 0, 1, 1, { opened_at: "nope" }),
  ];
  const s = Object.fromEntries(m.summarizeTradesNews(trades, [nfp, ecb, pmi, holiday, low]).map(x => [x.tradeId, x]));
  assert.equal(s.bad, undefined, "invalid open time skipped");

  assert.equal(s["eu-through"].bucket, "near_high");
  assert.deepEqual(s["eu-through"].links.map(l => [l.eventId, l.relation, l.minutesFromOpen]), [["pmi", "opened_near", -5], ["nfp", "open_at_release", 15], ["ecb", "within_2h", 120]]);
  assert.equal(s["eu-through"].nearestHighMinutes, 15);
  assert.deepEqual(s["eu-through"].tags, ["news:high", "news:open_at_release"]);

  assert.equal(s.gbpjpy.bucket, "clear");
  assert.equal(s.gbpjpy.nearestHighMinutes, null);
  assert.deepEqual(s.gbpjpy.tags, []);

  assert.equal(s["gold-after"].bucket, "around_high");
  assert.equal(s["gold-after"].nearestHighMinutes, -60);
  assert.deepEqual(s["gold-after"].tags, []);

  assert.equal(s["index-pmi"].bucket, "near_high");
  assert.deepEqual(s["index-pmi"].tags, ["news:high", "news:opened_near"]);
  assert.equal(s["index-pmi"].nearestHighMinutes, 10);

  assert.equal(s.far.bucket, "clear");
  assert.equal(s.far.nearestHighMinutes, null);
  assert.ok(!Object.values(s).some(x => x.links.some(l => l.eventId === "hol" || l.eventId === "low")), "holidays and low impact never link");
});

test("medium-only exposure is tagged as medium", () => {
  const [s] = m.summarizeTradesNews([trade("x", "EURUSD", -25, -22)], [pmi]);
  assert.equal(s.bucket, "clear");
  assert.deepEqual(s.tags, ["news:medium", "news:opened_near"]);
});

test("stats: wins by net, only closed trades with net, R over known values", () => {
  const st = m.newsStats([
    trade("a", "EURUSD", 0, 10, 50, 2),
    trade("b", "EURUSD", 0, 10, -20, null),
    trade("c", "EURUSD", 0, 10, "0", -0.1),
    trade("open", "EURUSD", 0, null, 999, 9),
    trade("nonet", "EURUSD", 0, 10, null, 5),
  ]);
  assert.deepEqual(st, { trades: 3, wins: 1, losses: 1, winRate: 33.33, totalNet: 30, avgNet: 10, rCount: 2, avgR: 0.95 });
  assert.deepEqual(m.newsStats([]), { trades: 0, wins: 0, losses: 0, winRate: null, totalNet: 0, avgNet: null, rCount: 0, avgR: null });
});

test("report: buckets, relations, per currency and per event with n", () => {
  const trades = [
    trade("w1", "EURUSD", -15, 20, 100, 2),
    trade("l1", "GBPUSD", 5, 40, -50, -1),
    trade("w2", "EURUSD", -5, 110, 30, 0.5),  // NFP open_at_release, ECB open_at_release too
    trade("c1", "AUDJPY", 0, 10, 10, 0.2),
    trade("a1", "XAUUSD", 60, 90, -10, -0.5),
  ];
  const report = m.newsImpactReport(trades, m.summarizeTradesNews(trades, [nfp, ecb]));
  assert.equal(report.buckets.near_high.trades, 3);
  assert.equal(report.buckets.near_high.winRate, 66.67);
  assert.equal(report.buckets.around_high.trades, 1);
  assert.equal(report.buckets.clear.trades, 1);
  assert.equal(report.byRelation.open_at_release.trades, 2);
  assert.equal(report.byRelation.opened_near.trades, 1);
  assert.deepEqual(report.byCurrency.map(g => [g.key, g.trades]), [["USD", 3], ["EUR", 1]]);
  assert.deepEqual(report.byEvent.map(g => [g.key, g.label, g.trades]), [["USD:nonfarm-payrolls", "Nonfarm Payrolls", 3], ["EUR:ecb-rate", "ECB Rate Decision", 1]]);
});

test("upcoming releases: future only, soonest first, no all-day", () => {
  const ev = (id, min, extra = {}) => ({ id, title: id, currency: "USD", impact: "high", time: at(min), ...extra });
  const list = [ev("past", -1), ev("later", 90), ev("soon", 5), ev("allday", 1, { allDay: true }), ev("now", 0), ev("bad", 0, { time: "x" })];
  assert.deepEqual(m.upcomingEvents(list, T).map(e => e.id), ["now", "soon", "later"]);
  assert.deepEqual(m.upcomingEvents(list, T, 1).map(e => e.id), ["now"]);
});

test("active red-news window: ±N around high releases only", () => {
  const ev = (id, min, impact = "high") => ({ id, title: id, currency: "USD", impact, time: at(min) });
  assert.equal(m.activeNewsWindow([ev("a", 20)], T, 15), null, "starts 5 min from now");
  assert.equal(m.activeNewsWindow([ev("a", 10, "medium")], T, 15), null);
  const w = m.activeNewsWindow([ev("a", 10), ev("b", -14)], T, 15);
  assert.equal(w.event.id, "a", "latest-ending window wins");
  assert.equal(w.endsAt, at(25));
  assert.equal(m.activeNewsWindow([ev("a", -15)], T, 15).endsAt, at(0), "edge is inside");
});

test("edge news: only red releases within 60 min of entry or exit", () => {
  // A trade held for 28 hours is open during many releases, but only those at its edges are "near".
  const day = (id, min, impact = "high") => ({ id, title: id, currency: "USD", impact, event_time: at(min) });
  const events = [day("entry-15", -15), day("mid", 600), day("exit+40", 28 * 60 + 40), day("exit+90", 28 * 60 + 90), day("entry+50-medium", 50, "medium"), day("entry-70", -70)];
  const [s] = m.summarizeTradesNews([trade("swing", "EURUSD", 0, 28 * 60)], events);
  assert.equal(s.links.find(l => l.eventId === "mid").minutesFromClose, 600 - 28 * 60);
  assert.deepEqual(m.edgeNewsLinks(s.links).map(l => [l.eventId, l.edge, l.edgeMinutes]), [["entry-15", "entry", -15], ["exit+40", "exit", 40]]);
  assert.deepEqual(m.edgeNewsLinks(s.links, 90).map(l => l.eventId), ["entry-70", "entry-15", "exit+40", "exit+90"]);
});

test("nearest trade edge", () => {
  assert.deepEqual(m.nearestTradeEdge(-10, 500), { edge: "entry", minutes: -10 });
  assert.deepEqual(m.nearestTradeEdge(300, 20), { edge: "exit", minutes: 20 });
  assert.deepEqual(m.nearestTradeEdge(5, 5), { edge: "entry", minutes: 5 }, "tie goes to entry");
  assert.equal(m.nearestTradeEdge(61, 120), null);
  assert.deepEqual(m.nearestTradeEdge(-60, null), { edge: "entry", minutes: -60 }, "open trade: entry only, 60 is inside");
  assert.equal(m.nearestTradeEdge(300, null), null);
});
