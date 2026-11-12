import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { scrubEvent, scrubBreadcrumb, scrubUrl, scrubText } = require("../.tmp-monitoring-scrub-tests/lib/monitoring/scrub.js");

test("text and URLs lose e-mails, tokens, long numbers and query strings", () => {
  assert.equal(scrubText("user trader@example.com failed on ticket 123456789"), "user [email] failed on ticket [number]");
  assert.equal(scrubText("bearer eyJhbGciOi.eyJzdWIiOiJ4In0.c2ln"), "bearer [token]");
  assert.equal(scrubUrl("https://mqvault.vercel.app/journal?focusTradeIds=1&email=a@b.co#x"), "https://mqvault.vercel.app/journal");
  assert.equal(scrubUrl("/auth/confirm?token_hash=secret&type=email"), "/auth/confirm");
  assert.equal(scrubText("R is 1.5, price 2345.67"), "R is 1.5, price 2345.67", "short numbers stay");
});

test("an event keeps the error and page, nothing personal", () => {
  const event = scrubEvent({
    message: "Failed for trader@example.com",
    user: { id: "u1", email: "trader@example.com", ip_address: "1.2.3.4" },
    extra: { body: "{\"password\":\"x\"}" },
    server_name: "host-1",
    request: { url: "https://mqvault.vercel.app/settings?code=123456", method: "POST", cookies: { "sb-access-token": "secret" },
      headers: { Cookie: "sb=secret", Authorization: "Bearer x", "User-Agent": "Chrome" }, data: { password: "x" }, query_string: "code=123456" },
    exception: { values: [{ type: "Error", value: "account 20624666 not found for a@b.co" }] },
    breadcrumbs: [
      { category: "console", message: "trader@example.com" },
      { category: "fetch", data: { url: "/api/journal/trades?id=5", method: "GET", status_code: 500, body: "x" } },
      { category: "ui.click", message: "button.trade-row > span 1234.56 USD" },
    ],
  });
  assert.equal(event.user, undefined);
  assert.equal(event.extra, undefined);
  assert.equal(event.server_name, undefined);
  assert.deepEqual(event.request, { url: "https://mqvault.vercel.app/settings", method: "POST", headers: { "User-Agent": "Chrome" } });
  assert.equal(event.message, "Failed for [email]");
  assert.equal(event.exception.values[0].value, "account [number] not found for [email]");
  assert.deepEqual(event.breadcrumbs, [
    { category: "fetch", data: { url: "/api/journal/trades", method: "GET", status_code: 500 } },
    { category: "ui.click", message: "[click]" },
  ]);
  assert.equal(scrubBreadcrumb({ category: "ui.input", message: "typed" }), null);
});
