import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
const require = createRequire(import.meta.url);
const { retiredMt5Response } = require("../.tmp-local-bridge-tests/lib/mt5-retirement.js");
const { useMt5 } = require("../.tmp-local-bridge-tests/hooks/use-mt5.js");
test("legacy endpoints explicitly return gone without fake balances", async () => {
  for (const kind of ["health", "history", "positions"]) {
    const response = retiredMt5Response(kind), body = await response.json();
    assert.equal(response.status, 410); assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.equal(body.connected, false); assert.equal(body.code, "local_bridge_retired");
    assert.equal(Object.hasOwn(body, "balance"), false); assert.equal(Object.hasOwn(body, "equity"), false);
    if (kind === "history") { assert.deepEqual(body.deals, []); assert.equal(body.initialDeposit, null); }
  }
});
test("compatibility hook and refresh never request the network", async () => {
  const original = globalThis.fetch; let calls = 0;
  globalThis.fetch = () => { calls++; throw new Error("Network must not be used"); };
  try {
    const value = useMt5(1); await value.refresh();
    assert.equal(value.health.connected, false); assert.equal(value.loading, false); assert.equal(value.initialDeposit, null);
    assert.deepEqual(value.closedPositions, []); assert.equal(calls, 0);
  } finally { globalThis.fetch = original; }
});
test("active bridge routes and hook contain no transport or timer", () => {
  const hook = readFileSync("src/hooks/use-mt5.ts", "utf8");
  assert.doesNotMatch(hook, /fetch\s*\(|setInterval|useEffect/);
  for (const kind of ["health", "history", "positions"]) {
    const source = readFileSync(`src/app/api/mt5/${kind}/route.ts`, "utf8");
    assert.match(source, /retiredMt5Response/); assert.doesNotMatch(source, /fetch\s*\(|127\.0\.0\.1|localhost/);
  }
});
test("account UI has no bridge connection entry point", () => {
  const switcher = readFileSync("src/components/account-switcher.tsx", "utf8");
  assert.doesNotMatch(switcher, /useMt5|Mt5Panel|linkCurrentMt5/);
  const form = readFileSync("src/components/accounts/new-account-modal.tsx", "utf8");
  assert.doesNotMatch(form, /mt5BridgeConnected|mt5DefaultBalance|MT5 bridge/);
  assert.match(form, /source: "manual"/);
});
