import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { WORKSPACE_TABS, tabPath, tabFromPath, journalFocusPath, legacyTabDestination } = require("../.tmp-workspace-routes-tests/lib/navigation/workspace-routes.js");
const { parseJournalFocus } = require("../.tmp-workspace-routes-tests/lib/journal/journal-focus.js");

const A = "aaaaaaaa-0000-4000-8000-000000000001", B = "bbbbbbbb-0000-4000-8000-000000000002";
const legacy = query => legacyTabDestination("/", new URLSearchParams(query));

test("every section has its own address and maps back to itself", () => {
  for (const tab of WORKSPACE_TABS) { assert.equal(tabPath(tab), `/${tab}`); assert.equal(tabFromPath(`/${tab}`), tab); }
  assert.equal(tabPath("journal", { review: "1", gallery: null }), "/journal?review=1");
  assert.equal(tabFromPath("/"), "home");
  for (const path of ["/settings", "/help", "/journalx", "/api/journal/trades"]) assert.equal(tabFromPath(path), null, path);
});

test("old ?tab= links move to the new address and keep their other parameters", () => {
  assert.equal(legacy("tab=overview"), "/overview");
  assert.equal(legacy("tab=strategy-control"), "/strategy-control");
  assert.equal(legacy("tab=playbook"), "/playbook");
  assert.equal(legacy("tab=journal&review=1"), "/journal?review=1");
  assert.equal(legacy("tab=home&report=week&week=2026-11-09"), "/home?report=week&week=2026-11-09");
  assert.equal(legacy("tab=unknown"), "/home");
});

test("a focus link always opens the journal and keeps the restriction intact", () => {
  for (const query of [`focusTradeIds=${A},${B}`, `tab=home&focusTradeIds=${A},${B}`]) {
    const url = new URL(legacy(query), "https://example.invalid");
    assert.equal(url.pathname, "/journal");
    assert.deepEqual(parseJournalFocus(url.searchParams), { kind: "ids", ids: [A, B] });
  }
  // Two focus parameters stay two: the journal then refuses the link instead of showing every trade.
  const twice = new URL(legacy(`focusTradeIds=${A}&focusTradeIds=${B}`), "https://example.invalid");
  assert.equal(parseJournalFocus(twice.searchParams).kind, "invalid");
  assert.equal(new URL(journalFocusPath([A, B]), "https://example.invalid").searchParams.get("focusTradeIds"), `${A},${B}`);
});

test("only the bare root with a tab or focus is redirected", () => {
  assert.equal(legacy(""), null);
  assert.equal(legacy("utm=1"), null);
  assert.equal(legacyTabDestination("/journal", new URLSearchParams("tab=overview")), null);
});
