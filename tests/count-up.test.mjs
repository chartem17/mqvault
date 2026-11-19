import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { countUpTarget, countUpText, easeOutCubic } = require("../.tmp-count-up-tests/lib/dashboard/count-up.js");

const at = (text, progress) => countUpText(countUpTarget(text), progress);

test("ends exactly on the formatted value", () => {
  for (const text of ["+1902.00$", "60.0%", "-0.50R", "1 902,00 $", "2.79", "+12,345.67 USD", "0%"]) assert.equal(at(text, 1), text);
});

test("starts from zero with the same shape", () => {
  assert.equal(at("+1902.00$", 0), "+0.00$");
  assert.equal(at("60.0%", 0), "0.0%");
  assert.equal(at("1 902,00 $", 0), "0,00 $");
});

test("keeps separators of the user's number format halfway", () => {
  assert.equal(at("+1902.00$", 0.5), "+951.00$");
  assert.equal(at("1 902,00 $", 0.5), "951,00 $");
  assert.equal(at("+12,345.67 USD", 0.5), "+6,172.84 USD");
});

test("text without digits is not animated", () => {
  assert.equal(countUpTarget("•••"), null);
  assert.equal(countUpTarget("—"), null);
});

test("easing stays within 0..1", () => {
  assert.equal(easeOutCubic(0), 0);
  assert.equal(easeOutCubic(1), 1);
  assert.equal(easeOutCubic(2), 1);
  assert.ok(easeOutCubic(0.5) > 0.5);
});
