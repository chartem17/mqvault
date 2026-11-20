import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { summarizeIdea, canJoin, ideaCandidates, ideaTrades, linkProblem, parseIdea } = require("../.tmp-trade-idea-tests/lib/journal/trade-idea.js");

const IDEA = "11111111-2222-4333-8444-555555555555";
const base = { account_id: "a", symbol: "XAUUSD", direction: "Long", closed_at: "2026-11-10T12:00:00Z" };
// The owner's example: main entry 1 % risk at RR 3, add-on a bit higher 0.5 % risk at RR 2.5.
const main = { ...base, id: "m", opened_at: "2026-11-10T08:00:00Z", entry_price: "2000", initial_stop_loss: "1990", take_profit: "2030", volume: 1, risk_amount: 100, risk_percent: 1, net_pnl: 300, idea: { id: IDEA } };
const addOn = { ...base, id: "s", opened_at: "2026-11-10T08:30:00Z", entry_price: "2002", initial_stop_loss: "1998", take_profit: "2012", volume: 1.25, risk_amount: 50, risk_percent: 0.5, net_pnl: 125, idea: { id: IDEA } };

test("idea R is total net over total initial risk, i.e. R weighted by risk", () => {
  const idea = summarizeIdea([main, addOn]);
  assert.equal(idea.net, 425); assert.equal(idea.risk, 150);
  assert.equal(idea.r, 2.83); // (3 × 100 + 2.5 × 50) / 150
  assert.equal(idea.riskPercent, 1.5);
  assert.equal(idea.plannedRR, 2.83); // the 1 % trade weighs twice as much as the 0.5 % add-on
});

test("average entry is volume-weighted, informational only", () => {
  const idea = summarizeIdea([main, addOn]);
  assert.equal(idea.averageEntry, Number(((2000 * 1 + 2002 * 1.25) / 2.25).toFixed(6)));
  assert.equal(idea.volume, 2.25);
});

test("an add-on stopped inside the main trade's profit does not distort the idea", () => {
  // Add-on stop (2001) is above the main entry: a "common stop" would make no sense, but each risk stays its own.
  const stopped = { ...addOn, initial_stop_loss: "2001", take_profit: "2004.5", risk_amount: 50, net_pnl: -50 };
  const idea = summarizeIdea([main, stopped]);
  assert.equal(idea.net, 250); assert.equal(idea.r, 1.67);
  assert.equal(idea.plannedRR, 2.83);
});

test("unknown risk or an open trade make R honest instead of wrong", () => {
  assert.equal(summarizeIdea([main, { ...addOn, risk_amount: null }]).r, null);
  const running = summarizeIdea([main, { ...addOn, closed_at: null }]);
  assert.equal(running.open, true); assert.equal(running.net, 300); assert.equal(running.r, 3);
});

test("only the same account, instrument and direction can join, within 72 hours", () => {
  assert.equal(canJoin(main, { ...addOn, symbol: "XAUUSD.raw" }), true);
  assert.equal(canJoin(main, { ...addOn, direction: "Short" }), false);
  assert.equal(canJoin(main, { ...addOn, account_id: "b" }), false);
  assert.equal(linkProblem([main]), "Pick at least two trades");
  assert.equal(linkProblem([main, { ...addOn, direction: "Short" }]), "Trades of one idea must share the account, instrument and direction");
  assert.equal(linkProblem([main, { ...addOn, opened_at: "2026-11-14T08:00:00Z" }]), "Trades of one idea must be opened within 72 hours");
  assert.equal(linkProblem([main, addOn]), null);
});

test("candidates exclude trades already in the same idea and come nearest first", () => {
  const far = { ...addOn, id: "f", opened_at: "2026-11-11T08:00:00Z", idea: null };
  const near = { ...addOn, id: "n", opened_at: "2026-11-10T09:00:00Z", idea: null };
  assert.deepEqual(ideaCandidates(main, [addOn, far, near]).map(t => t.id), ["n", "f"]);
  assert.deepEqual(ideaTrades(IDEA, [addOn, main, far]).map(t => t.id), ["m", "s"]);
});

test("meta.idea is read defensively", () => {
  assert.deepEqual(parseIdea({ idea: { id: IDEA } }), { id: IDEA });
  for (const bad of [null, [], {}, { idea: "x" }, { idea: { id: "not-a-uuid" } }]) assert.equal(parseIdea(bad), null);
});
