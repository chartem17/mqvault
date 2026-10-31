import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { parseDeletionResult } = require("../.tmp-deletion-tests/deletion-result.js");

test("accepts confirmed trade and strategy deletion", () => {
  assert.deepEqual(parseDeletionResult({ deleted: true }), { deleted: true });
});
test("accepts account deletion with validated counts", () => {
  assert.deepEqual(parseDeletionResult({ deleted: true, trades_deleted: 4, strategies_deleted: 0 }), { deleted: true, trades_deleted: 4, strategies_deleted: 0 });
});
test("rejects unconfirmed deletion rather than reporting success", () => {
  assert.throws(() => parseDeletionResult({ deleted: false }));
});
test("rejects malformed RPC responses", () => {
  for (const value of [null, undefined, [], true, "success", {}, { deleted: "true" }, { success: true }]) assert.throws(() => parseDeletionResult(value));
});
test("rejects invalid deletion counts", () => {
  for (const key of ["trades_deleted", "strategies_deleted"]) {
    for (const count of [-1, 1.5, NaN, Infinity, "4", null, Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => parseDeletionResult({ deleted: true, [key]: count }));
  }
});
test("does not forward unexpected RPC properties", () => {
  assert.deepEqual(parseDeletionResult({ deleted: true, success: false, extra: "ignored" }), { deleted: true });
});
