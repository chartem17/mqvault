import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { parseJournalFocus, applyJournalFocus, journalAliasDestination, MAX_JOURNAL_FOCUS_IDS } = require("../.tmp-journal-focus-tests/journal-focus.js");
const A = "aaaaaaaa-0000-4000-8000-000000000001", B = "bbbbbbbb-0000-4000-8000-000000000002", C = "cccccccc-0000-4000-8000-000000000003";
const parse = value => parseJournalFocus(new URLSearchParams(value));
test("absent focus preserves normal journal mode", () => { assert.equal(parse("").kind, "none"); });
test("legacy encoded IDs normalize and deduplicate", () => { assert.deepEqual(parse(`focusTradeIds=${encodeURIComponent(`${A.toUpperCase()}, ${B},${A}`)}`), { kind: "ids", ids: [A, B] }); });
test("explicit empty focus stays empty rather than becoming all trades", () => { const focus = parse("focusTradeIds="); assert.deepEqual(focus, { kind: "ids", ids: [] }); assert.deepEqual(applyJournalFocus([{ id: A }], focus), []); });
test("bad IDs empty fragments duplicate parameters and double encoding fail closed", () => {
  for (const value of ["focusTradeIds=not-an-id", `focusTradeIds=${A},,${B}`, `focusTradeIds=${A}&focusTradeIds=${B}`, "focusTradeIds=%252F"]) {
    const focus = parse(value); assert.equal(focus.kind, "invalid"); assert.deepEqual(applyJournalFocus([{ id: A }], focus), []);
  }
});
test("oversized selections are rejected without silent truncation", () => {
  assert.equal(parse(`focusTradeIds=${Array(MAX_JOURNAL_FOCUS_IDS + 1).fill(A).join(",")}`).kind, "invalid");
  assert.equal(parse(`focusTradeIds=${"x".repeat(6001)}`).kind, "invalid");
});
test("selection intersects already scoped records without mutation or copies", () => {
  const first = { id: A, account_id: "current" }, second = { id: B, account_id: "current" };
  const input = [first, second], result = applyJournalFocus(input, { kind: "ids", ids: [B, C] });
  assert.deepEqual(result, [second]); assert.equal(result[0], second); assert.deepEqual(input, [first, second]);
});
test("missing IDs do not broaden selection and no-focus returns a new array", () => {
  const input = [{ id: A }]; assert.deepEqual(applyJournalFocus(input, { kind: "ids", ids: [C] }), []);
  const result = applyJournalFocus(input, { kind: "none" }); assert.deepEqual(result, input); assert.notEqual(result, input);
});
test("journal alias leads to existing root workspace and retains exact IDs", () => {
  const url = new URL(journalAliasDestination(`${A},${B}`), "https://example.invalid");
  assert.equal(url.pathname, "/"); assert.equal(url.searchParams.get("tab"), "journal"); assert.deepEqual(parseJournalFocus(url.searchParams), { kind: "ids", ids: [A, B] });
  assert.equal(parseJournalFocus(new URL(journalAliasDestination(undefined), "https://example.invalid").searchParams).kind, "none");
});
test("ambiguous alias parameters never remove the focus restriction", () => { const url = new URL(journalAliasDestination([A, B]), "https://example.invalid"); assert.equal(parseJournalFocus(url.searchParams).kind, "invalid"); });
