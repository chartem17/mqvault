import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { passwordStrength, normalizeOtp } = require("../.tmp-password-strength-tests/lib/auth/password-strength.js");

test("strength meter: length and variety, obvious passwords capped", () => {
  assert.equal(passwordStrength(""), 0);
  assert.equal(passwordStrength("abc"), 1);
  assert.equal(passwordStrength("abcdefghij"), 1);
  assert.equal(passwordStrength("password123456"), 1);
  assert.equal(passwordStrength("aaaaaaaaaaaaaaaa"), 1);
  assert.equal(passwordStrength("abcdefghi1"), 2);
  assert.equal(passwordStrength("abcdefghijklm1"), 3);
  assert.equal(passwordStrength("Abcdefghijklm1!"), 4);
  assert.equal(passwordStrength("Довга фраза 2026"), 4, "Cyrillic letters count as letters");
});

test("one-time codes: digits only, spaces ignored", () => {
  assert.equal(normalizeOtp(" 123 456 "), "123456");
  assert.equal(normalizeOtp("12345678"), "12345678");
  for (const bad of ["12345", "12345a", "", null, 123456, "1".repeat(11)]) assert.equal(normalizeOtp(bad), null);
});
