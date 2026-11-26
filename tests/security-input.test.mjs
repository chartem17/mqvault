import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { boundedText, httpUrl, TRADE_TEXT_LIMITS, MAX_URL_LENGTH } = require("../.tmp-security-input-tests/lib/security/input.js");

test("boundedText trims, caps and drops empty values", () => {
  assert.equal(boundedText("  hello  ", 10), "hello");
  assert.equal(boundedText("abcdef", 3), "abc");
  assert.equal(boundedText("   ", 10), null);
  assert.equal(boundedText("", 10), null);
  assert.equal(boundedText(null, 10), null);
  assert.equal(boundedText(undefined, 10), null);
  assert.equal(boundedText({ toString: () => "x" }, 10), null);
  assert.equal(boundedText(42, 10), "42");
});

test("httpUrl keeps plain http(s) links only", () => {
  assert.equal(httpUrl("https://www.tradingview.com/x/AbC123/"), "https://www.tradingview.com/x/AbC123/");
  assert.equal(httpUrl("  http://example.com/a.png  "), "http://example.com/a.png");
  for (const bad of ["javascript:alert(1)", "JavaScript:alert(1)", "data:text/html,<script>1</script>", "vbscript:x", "file:///etc/passwd", "//example.com", "example.com", "https://user:pass@example.com/", "https://exa mple.com", "https://example.com/\u0000", "", null, 12]) {
    assert.equal(httpUrl(bad), null, String(bad));
  }
  assert.equal(httpUrl(`https://example.com/${"a".repeat(MAX_URL_LENGTH)}`), null);
});

test("trade text limits cover every stored free-text field", () => {
  assert.deepEqual(Object.keys(TRADE_TEXT_LIMITS).sort(), ["emotion", "entry_reason", "exit_reason", "external_id", "htf_bias", "market", "mistake", "notes", "session", "setup"]);
  for (const max of Object.values(TRADE_TEXT_LIMITS)) assert.ok(Number.isInteger(max) && max > 0);
});
