import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { formatNumber, setDisplayOptions, isPrivacyOn } = require("../.tmp-number-format-tests/lib/journal/number-format.js");

test("plain, grouped and european formats", () => {
  assert.equal(formatNumber(1234567.891, 2, "plain"), "1234567.89");
  assert.equal(formatNumber(1234567.891, 2, "grouped"), "1,234,567.89");
  assert.equal(formatNumber(1234567.891, 2, "european"), "1 234 567,89");
  assert.equal(formatNumber(-1234.5, 1, "grouped"), "-1,234.5");
  assert.equal(formatNumber(999, 0, "grouped"), "999");
  assert.equal(formatNumber(-0.004, 2, "plain"), "0.00", "no negative zero");
});

test("display options drive the default format and privacy", () => {
  setDisplayOptions({ numberFormat: "grouped", privacy: true });
  assert.equal(formatNumber(1000), "1,000.00");
  assert.equal(isPrivacyOn(), true);
  setDisplayOptions({ numberFormat: "plain", privacy: false });
  assert.equal(formatNumber(1000), "1000.00");
  assert.equal(isPrivacyOn(), false);
});
