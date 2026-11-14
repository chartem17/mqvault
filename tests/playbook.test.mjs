import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { DEFAULT_PLAYBOOK, sanitizePlaybook } = require("../.tmp-playbook-tests/lib/playbook/config.js");
const { windowAt, riskState, riskAtEntries, dayStatus, outcomeOf } = require("../.tmp-playbook-tests/lib/playbook/engine.js");
const { planGate, gatePassed, planRR, draftFromInput, matchPlans, sameSymbol, EMPTY_DRAFT } = require("../.tmp-playbook-tests/lib/playbook/plans.js");
const { assessTrades, disciplineSummary, parseDiscipline, disciplineFromInput, disciplinePeriods } = require("../.tmp-playbook-tests/lib/playbook/discipline.js");

const cfg = DEFAULT_PLAYBOOK;
const ACC = "11111111-1111-4111-8111-111111111111";
// 2026-11-16 is a Monday; Kyiv is UTC+2 in November.
const kyiv = (day, time) => new Date(`${day}T${time}:00+02:00`).toISOString();
let seq = 0;
const trade = (over = {}) => ({ id: `t${++seq}`, account_id: ACC, symbol: "EURUSD", direction: "Long", opened_at: kyiv("2026-11-16", "10:00"), closed_at: kyiv("2026-11-16", "11:00"), entry_price: "1.1000", stop_loss: "1.0990", take_profit: "1.1020", risk_percent: 1, result_r: 2, net_pnl: 100, ...over });

test("sanitizePlaybook keeps defaults for broken input and orders windows", () => {
  assert.deepEqual(sanitizePlaybook(null), DEFAULT_PLAYBOOK);
  assert.deepEqual(sanitizePlaybook({ maxTradesPerDay: "9", minRR: -1, timezone: "Mars/Base" }), DEFAULT_PLAYBOOK);
  const custom = sanitizePlaybook({ windows: [{ id: "b", label: "B", start: "14:00", end: "15:00" }, { id: "a", start: "08:00", end: "09:00", entries: false }, { id: "bad", start: "10:00", end: "09:00" }], reducedRiskPct: 5 });
  assert.deepEqual(custom.windows.map(w => w.id), ["a", "b"]);
  assert.equal(custom.windows[0].entries, false);
  assert.equal(custom.reducedRiskPct, custom.baseRiskPct, "reduced risk never exceeds the base");
});

test("windowAt follows the Kyiv clock: morning, lunch, gap, New York, evening, weekend", () => {
  assert.equal(windowAt(kyiv("2026-11-16", "09:00"), cfg).window.id, "morning");
  const lunch = windowAt(kyiv("2026-11-16", "12:30"), cfg);
  assert.equal(lunch.window.id, "lunch"); assert.equal(lunch.entriesAllowed, false);
  assert.equal(lunch.next.window.id, "new-york"); assert.equal(lunch.next.startsAt, kyiv("2026-11-16", "14:30"));
  assert.equal(windowAt(kyiv("2026-11-16", "14:10"), cfg).window, null);
  assert.equal(windowAt(kyiv("2026-11-16", "18:59"), cfg).entriesAllowed, true);
  const evening = windowAt(kyiv("2026-11-16", "19:00"), cfg);
  assert.equal(evening.entriesAllowed, false); assert.equal(evening.next.startsAt, kyiv("2026-11-17", "09:00"));
  const saturday = windowAt(kyiv("2026-11-21", "10:00"), cfg);
  assert.equal(saturday.entriesAllowed, false); assert.equal(saturday.next.startsAt, kyiv("2026-11-23", "09:00"));
  // Summer (UTC+3) — still 09:00 on the Kyiv clock.
  assert.equal(windowAt(new Date("2026-07-06T06:00:00Z"), cfg).window.id, "morning");
});

test("outcome: break-even is neutral, R wins over money", () => {
  assert.equal(outcomeOf({ closed_at: "x", result_r: 0.05, net_pnl: 3 }, 0.1), "breakeven");
  assert.equal(outcomeOf({ closed_at: "x", result_r: -1, net_pnl: 3 }, 0.1), "loss");
  assert.equal(outcomeOf({ closed_at: "x", result_r: null, net_pnl: 5 }, 0.1), "win");
  assert.equal(outcomeOf({ closed_at: null, result_r: 2 }, 0.1), "open");
});

test("risk ladder: 3 losses in a row → 0.5 %, 2 wins at 0.5 % → back to 1 %", () => {
  const at = h => ({ opened_at: kyiv("2026-11-16", `${String(h).padStart(2, "0")}:00`), closed_at: kyiv("2026-11-16", `${String(h).padStart(2, "0")}:30`) });
  const losses = [trade({ ...at(1), result_r: -1 }), trade({ ...at(2), result_r: -1 }), trade({ ...at(3), result_r: 0.02 }), trade({ ...at(4), result_r: -1 })];
  assert.equal(riskState(losses.slice(0, 2), cfg).riskPct, 1);
  const reduced = riskState(losses, cfg);
  assert.equal(reduced.level, "reduced"); assert.equal(reduced.riskPct, 0.5); assert.equal(reduced.changedBy, losses[3].id);
  const winLoss = [...losses, trade({ ...at(5), result_r: 2 }), trade({ ...at(6), result_r: -1 })];
  assert.equal(riskState(winLoss, cfg).winsAtReduced, 1, "a loss at 0.5 % does not reset the wins");
  const back = riskState([...winLoss, trade({ ...at(7), result_r: 1.5 })], cfg);
  assert.equal(back.level, "base"); assert.equal(back.riskPct, 1);
  // A win in the middle breaks the losing streak.
  assert.equal(riskState([losses[0], trade({ ...at(2), result_r: 2 }), losses[1], losses[3]], cfg).level, "base");
  const entries = riskAtEntries([...losses, trade({ ...at(5), result_r: 2 })], cfg);
  assert.equal(entries.get(losses[3].id).riskPct, 1, "risk at the third loss's own entry was still 1 %");
  assert.equal([...entries.values()].at(-1).riskPct, 0.5);
});

test("dayStatus counts pending plans and blocks after 2 stops", () => {
  const now = Date.parse(kyiv("2026-11-16", "15:00"));
  const day = [trade({ result_r: -1 }), trade({ result_r: 1 })];
  assert.deepEqual([dayStatus(day, 0, now, cfg).entries, dayStatus(day, 0, now, cfg).blockedBy], [2, null]);
  assert.equal(dayStatus(day, 1, now, cfg).blockedBy, "trades");
  assert.equal(dayStatus([...day, trade({ result_r: -1 })], 0, now, cfg).blockedBy, "losses");
  assert.equal(dayStatus(day, 0, Date.parse(kyiv("2026-11-17", "09:00")), cfg).entries, 0, "a new Kyiv day starts clean");
});

const goodDraft = () => ({ ...EMPTY_DRAFT, account_id: ACC, symbol: "EURUSD", direction: "Long", at_desk: true, context: "4H bullish order flow to 1.1100", poi_type: "fvg", poi_note: "4H FVG 1.0980", poi_swept: true, reaction: "fvg", bos_timeframe: "M5", bos_body_close: true, limit_on_fvg: true, entry: 1.1, stop: 1.099, target: 1.103, screenshot_url: "https://www.tradingview.com/x/abc/", reason: "Sweep of Asia low, M5 BOS, limit on the FVG" });
const ctx = (over = {}) => ({ now: Date.parse(kyiv("2026-11-16", "10:00")), day: dayStatus([], 0, Date.parse(kyiv("2026-11-16", "10:00")), cfg), risk: riskState([], cfg), config: cfg, ...over });

test("planGate passes a complete plan and names every blocker", () => {
  assert.equal(planRR("Long", 1.1, 1.099, 1.103), 3);
  assert.equal(planRR("Short", 1.1, 1.099, 1.103), null);
  assert.equal(gatePassed(planGate(goodDraft(), ctx())), true);
  const failing = ids => planGate(ids.draft ?? goodDraft(), ctx(ids.ctx)).filter(c => !c.ok).map(c => c.id);
  assert.deepEqual(failing({ draft: EMPTY_DRAFT }), ["basics", "at_desk", "context", "poi", "reaction", "bos", "limit", "prices", "rr", "why"]);
  assert.deepEqual(failing({ ctx: { now: Date.parse(kyiv("2026-11-16", "12:30")) } }), ["window"]);
  assert.deepEqual(failing({ draft: { ...goodDraft(), target: 1.1015 } }), ["rr"]);
  const blocked = dayStatus([trade({ result_r: -1 }), trade({ result_r: -1 })], 0, Date.parse(kyiv("2026-11-16", "10:00")), cfg);
  assert.deepEqual(failing({ ctx: { day: blocked } }), ["limits"]);
  assert.deepEqual(failing({ draft: { ...goodDraft(), risk_exception: "add_on", risk_pct: null } }), ["risk"]);
  assert.deepEqual(failing({ draft: { ...goodDraft(), risk_exception: "metal_lot", risk_pct: 1.5 } }), []);
  assert.deepEqual(failing({ draft: { ...goodDraft(), screenshot_url: "javascript:alert(1)" } }), ["why"]);
});

test("draftFromInput drops anything malformed", () => {
  const draft = draftFromInput({ ...goodDraft(), direction: "Up", at_desk: "yes", entry: "1,1", bos_timeframe: "M3", risk_exception: "yolo", __proto__: { at_desk: true } });
  assert.equal(draft.direction, null); assert.equal(draft.at_desk, false); assert.equal(draft.entry, 1.1); assert.equal(draft.bos_timeframe, null); assert.equal(draft.risk_exception, "none");
  assert.equal(draftFromInput("nope").account_id, "");
});

const plan = (over = {}) => ({ ...goodDraft(), id: `p${++seq}`, risk_pct: 1, rr: 3, status: "active", trade_id: null, created_at: kyiv("2026-11-16", "09:55"), ...over });

test("matchPlans pairs by symbol suffix, direction, time and price; manual links win", () => {
  assert.equal(sameSymbol("EURUSD.raw", "EUR/USD"), true);
  assert.equal(sameSymbol("XAUUSDm", "XAUUSD"), true);
  assert.equal(sameSymbol("EURUSD", "EURGBP"), false);
  const p1 = plan(), p2 = plan({ direction: "Short" }), p3 = plan({ status: "cancelled" });
  const near = trade({ symbol: "EURUSD.raw", entry_price: "1.10002" }), far = trade({ entry_price: "1.1008" }), late = trade({ opened_at: kyiv("2026-11-16", "19:30") });
  const result = matchPlans([p1, p2, p3], [near, far, late], cfg);
  assert.equal(result.byPlan.get(p1.id), near.id);
  assert.equal(result.byPlan.has(p2.id), false); assert.equal(result.byPlan.has(p3.id), false);
  const manual = matchPlans([plan({ trade_id: far.id })], [near, far], cfg);
  assert.equal([...manual.byPlan.values()][0], far.id);
});

test("assessTrades finds data-visible violations and merges manual ones", () => {
  const p = plan();
  const ok = trade({ entry_price: "1.1", take_profit: "1.103" });
  const noPlan = trade({ opened_at: kyiv("2026-11-16", "12:30"), closed_at: kyiv("2026-11-16", "13:00"), result_r: -1, risk_percent: 0.7 });
  const moved = trade({ symbol: "GBPUSD", entry_price: "1.3", stop_loss: "1.299", take_profit: "1.301", result_r: 0.02, close_reason: "manual", discipline: { violations: ["partial_close"], stagnation: true, exception: null, note: "", updated_at: "" } });
  const fourth = trade({ opened_at: kyiv("2026-11-16", "15:00"), closed_at: kyiv("2026-11-16", "16:00") });
  const trades = [ok, noPlan, moved, fourth];
  const assessed = assessTrades(trades, [p], matchPlans([p], trades, cfg), cfg);
  assert.equal(assessed.get(ok.id).onPlan, true);
  assert.deepEqual(assessed.get(noPlan.id).violations.map(v => v.code).sort(), ["no_plan", "outside_window", "risk_rule"]);
  assert.deepEqual(assessed.get(moved.id).violations.map(v => `${v.code}:${v.auto}`).sort(), ["low_rr:true", "manual_close_be:true", "no_plan:true", "partial_close:false"]);
  assert.equal(assessed.get(moved.id).stagnation, true);
  assert.ok(assessed.get(fourth.id).violations.some(v => v.code === "trade_limit"));
  const movedTarget = trade({ id: "mt", opened_at: kyiv("2026-11-17", "10:00"), closed_at: kyiv("2026-11-17", "11:00"), entry_price: "1.1", take_profit: "1.106" });
  const p2 = plan({ created_at: kyiv("2026-11-17", "09:58") });
  const a2 = assessTrades([movedTarget], [p2], matchPlans([p2], [movedTarget], cfg), cfg);
  assert.deepEqual(a2.get("mt").violations.map(v => v.code), ["moved_target"]);
  const summary = disciplineSummary(trades, assessed, 0, Infinity);
  assert.deepEqual([summary.trades, summary.onPlan, summary.onPlanPct, summary.onPlanR, summary.stagnation, summary.stagnationR], [4, 1, 25, 2, 1, 0.02]);
});

test("meta.discipline input is validated", () => {
  assert.equal(disciplineFromInput({ violations: ["hack"] }), undefined);
  assert.equal(disciplineFromInput(null), null);
  const value = disciplineFromInput({ violations: ["moved_target", "moved_target"], stagnation: true, exception: "add_on" }, new Date("2026-11-16T00:00:00Z"));
  assert.deepEqual(value, { violations: ["moved_target"], stagnation: true, exception: "add_on", note: "", updated_at: "2026-11-16T00:00:00.000Z" });
  assert.equal(parseDiscipline({ discipline: "x" }), null);
});

test("discipline periods: Kyiv week and month", () => {
  const { week, month } = disciplinePeriods(Date.parse(kyiv("2026-11-18", "10:00")), "Europe/Kyiv");
  assert.equal(new Date(week.from).toISOString(), kyiv("2026-11-16", "00:00"));
  assert.equal(new Date(month.from).toISOString(), kyiv("2026-11-01", "00:00"));
  assert.equal(new Date(month.to).toISOString(), kyiv("2026-12-01", "00:00"));
});
