import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chainOf, linkError, summarizeChain } = require("../.tmp-account-chain-tests/account-chain.js");
const prop = (id, parentAccountId = null) => ({ id, accountType: "prop", parentAccountId });
const accounts = [prop("p1"), prop("p2", "p1"), prop("f", "p2"), prop("solo"), { id: "me", accountType: "personal" }];

test("chain is ordered from first stage regardless of the starting account", () => {
  for (const id of ["p1", "p2", "f"]) assert.deepEqual(chainOf(id, accounts).map(a => a.id), ["p1", "p2", "f"]);
  assert.deepEqual(chainOf("solo", accounts).map(a => a.id), ["solo"]);
  assert.deepEqual(chainOf("missing", accounts), []);
});
test("a corrupted loop cannot hang chain building", () => {
  const loop = [prop("a", "b"), prop("b", "a")];
  assert.equal(chainOf("a", loop).length, 2);
});
test("link validation: self, cycle, personal, second child, unknown", () => {
  assert.equal(linkError("solo", "p2", accounts) !== null, true);  // p2 already has child f
  assert.equal(linkError("solo", "f", accounts), null);            // tail is free
  assert.equal(linkError("p1", "f", accounts) !== null, true);     // would close a loop
  assert.equal(linkError("p1", "p1", accounts) !== null, true);
  assert.equal(linkError("solo", "me", accounts) !== null, true);
  assert.equal(linkError("me", "solo", accounts) !== null, true);
  assert.equal(linkError("solo", "ghost", accounts) !== null, true);
  assert.equal(linkError("p2", null, accounts), null);             // unlink is always allowed
  assert.equal(linkError("p2", "p1", accounts), null);             // keeping the same parent is fine
});
test("summary combines stages, counts distinct days in the given zone and never guesses missing PnL", () => {
  const trades = [
    { account_id: "p1", opened_at: "2026-11-01T22:30:00Z", net_pnl: 100 },   // 02.11 in Kyiv
    { account_id: "p2", opened_at: "2026-11-02T08:00:00Z", net_pnl: -40 },   // same Kyiv day
    { account_id: "f", opened_at: "2026-11-03T08:00:00Z", net_pnl: 10 },
    { account_id: "solo", opened_at: "2026-11-04T08:00:00Z", net_pnl: 9999 },
  ];
  const chain = chainOf("p2", accounts);
  assert.deepEqual(summarizeChain(chain, trades, "Europe/Kyiv"), { tradeCount: 3, tradingDays: 2, netPnl: 70, missingPnlCount: 0 });
  assert.equal(summarizeChain(chain, trades, "UTC").tradingDays, 3);
  const partial = summarizeChain(chain, [...trades, { account_id: "p1", opened_at: "2026-11-03T09:00:00Z", net_pnl: null }], "UTC");
  assert.equal(partial.netPnl, null); assert.equal(partial.missingPnlCount, 1);
});
