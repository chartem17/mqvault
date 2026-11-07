import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { createSessionToken, verifySessionToken, safeNextPath, SESSION_MAX_AGE_SECONDS } = require("../.tmp-session-token-tests/lib/auth/session-token.js");

const password = "a-very-long-test-password-123";

test("valid token verifies", async () => {
  assert.equal(await verifySessionToken(password, await createSessionToken(password)), true);
});
test("wrong password, tampering and garbage are rejected", async () => {
  const token = await createSessionToken(password);
  assert.equal(await verifySessionToken("another-very-long-password-456", token), false);
  assert.equal(await verifySessionToken(password, token.slice(0, -1) + (token.endsWith("0") ? "1" : "0")), false);
  const [, mac] = token.split(".");
  assert.equal(await verifySessionToken(password, `99999999999999.${mac}`), false);
  for (const bad of [undefined, null, "", "abc", ".", "1.2", "x".repeat(300)]) assert.equal(await verifySessionToken(password, bad), false);
});
test("expired token is rejected", async () => {
  const past = Date.now() - (SESSION_MAX_AGE_SECONDS + 10) * 1000;
  assert.equal(await verifySessionToken(password, await createSessionToken(password, past)), false);
});
test("safeNextPath only allows local paths", () => {
  assert.equal(safeNextPath("/journal"), "/journal");
  for (const bad of [null, "", "https://evil.com", "//evil.com", "/\\evil.com", "/login", "journal"]) assert.equal(safeNextPath(bad), "/");
});
