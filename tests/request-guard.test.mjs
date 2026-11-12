import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { guardRequest, unauthenticatedResponse, safeNextPath, normalizeEmail, passwordProblem, TOKEN_PATHS, PUBLIC_PAGES, PUBLIC_API } = require("../.tmp-request-guard-tests/lib/auth/request-guard.js");

const req = (path, method = "GET", headers = {}) => new Request(`https://vault.test${path}`, { method, headers });
const sameOrigin = { origin: "https://vault.test", "content-type": "application/json" };
const access = (...args) => guardRequest(req(...args)).access;

test("only POST to a token path skips the session check (the route checks its own token)", () => {
  assert.deepEqual([...TOKEN_PATHS], ["/api/economic-calendar/sync"]);
  assert.equal(access("/api/economic-calendar/sync", "POST"), "machine");
  assert.equal(access("/api/economic-calendar/sync", "GET"), "session");
  assert.equal(access("/api/economic-calendar/sync", "DELETE"), "denied");
  assert.equal(access("/api/economic-calendar/sync/", "POST"), "denied", "no prefix matching");
  assert.equal(access("/api/economic-calendar", "POST"), "denied");
});

test("Bridge device endpoints are machine-authenticated; everything else under /api/bridge needs a session", () => {
  assert.equal(access("/api/bridge/device/heartbeat", "POST"), "machine");
  assert.equal(access("/api/bridge/device/deals", "POST"), "machine");
  assert.equal(access("/api/bridge/pairings", "POST"), "machine");
  assert.equal(access("/api/bridge/devices", "GET"), "session");
  assert.equal(access("/api/bridge/pairings/approve", "POST", sameOrigin), "session");
});

test("writes must be same-origin JSON, including the public sign-in endpoints", () => {
  for (const path of ["/api/journal/trades", "/api/accounts", ...PUBLIC_API]) {
    assert.equal(access(path, "POST"), "denied", `${path} without Origin`);
    assert.equal(access(path, "POST", { origin: "https://evil.test", "content-type": "application/json" }), "denied", `${path} cross-origin`);
    assert.equal(access(path, "POST", { origin: "https://vault.test", "content-type": "text/plain" }), "denied", `${path} form-like body`);
    assert.equal(access(path, "POST", { origin: "null", "content-type": "application/json" }), "denied", `${path} opaque origin`);
  }
  assert.equal(access("/api/journal/trades", "POST", sameOrigin), "session");
  assert.equal(access("/api/journal/trades", "DELETE", sameOrigin), "session");
  assert.equal(access("/api/auth/login", "POST", sameOrigin), "public");
  assert.equal(access("/api/auth/signup", "POST", { ...sameOrigin, "content-type": "application/json; charset=utf-8" }), "public");
  assert.equal(access("/api/auth/password", "POST", sameOrigin), "session", "changing the password needs a session");
});

test("the configured site origin wins over the request host", () => {
  process.env.VAULT_SITE_ORIGIN = "https://app.example";
  try {
    assert.equal(access("/api/accounts", "POST", sameOrigin), "denied");
    assert.equal(access("/api/accounts", "POST", { origin: "https://app.example", "content-type": "application/json" }), "session");
  } finally { delete process.env.VAULT_SITE_ORIGIN; }
});

test("only the listed pages and callbacks are public; data and the app are not", () => {
  for (const path of [...PUBLIC_PAGES, "/auth/confirm", "/auth/callback", "/api/auth/google"]) assert.equal(access(path), "public", path);
  for (const path of ["/", "/journal", "/bridge/connect", "/reset-password", "/api/me", "/api/journal/trades", "/api/auth/login", "/login/", "/LOGIN", "/login/x", "/api/auth"]) assert.equal(access(path), "session", path);
});

test("signed-out pages go to the sign-in form and back; APIs get 401 JSON", async () => {
  const page = unauthenticatedResponse(req("/journal?review=1"));
  assert.equal(page.status, 307);
  assert.equal(page.headers.get("location"), "https://vault.test/login?next=%2Fjournal%3Freview%3D1");
  assert.equal(unauthenticatedResponse(req("/")).headers.get("location"), "https://vault.test/login");
  const api = unauthenticatedResponse(req("/api/accounts"));
  assert.equal(api.status, 401);
  assert.equal((await api.json()).error, "Authentication required");
  assert.equal(unauthenticatedResponse(req("/journal", "POST", sameOrigin)).status, 401);
});

test("post-login destination stays on this site and off the sign-in pages", () => {
  assert.equal(safeNextPath("/journal?review=1"), "/journal?review=1");
  assert.equal(safeNextPath("/reset-password"), "/reset-password");
  for (const bad of [null, undefined, "", "journal", "https://evil.test", "//evil.test", "/\\evil.test", "/a\\b", "/login", "/login?next=/x", "/signup", "/auth/callback?code=1", "/x\n/y"]) assert.equal(safeNextPath(bad), "/", String(bad));
});

test("e-mail and password checks", () => {
  assert.equal(normalizeEmail("  Trader@Example.COM "), "trader@example.com");
  for (const bad of [null, 5, "", "a", "a@", "@b", "a b@c.d", "a@b@c", `${"x".repeat(250)}@a.io`]) assert.equal(normalizeEmail(bad), null, String(bad));
  assert.equal(passwordProblem("long enough phrase"), null);
  assert.ok(passwordProblem("short"));
  assert.ok(passwordProblem(undefined));
  assert.ok(passwordProblem("x".repeat(201)));
});

test("oversized bodies are refused before anything else (package 3)", () => {
  const { guardRequest: guard } = require("../.tmp-request-guard-tests/lib/auth/request-guard.js");
  const post = (path, length) => new Request(`https://vault.test${path}`, { method: "POST", headers: { origin: "https://vault.test", "content-type": "application/json", "content-length": String(length) } });
  assert.equal(guard(post("/api/journal/trades", 2_000_000)).response?.status, 413);
  assert.equal(guard(post("/api/journal/trades", 900_000)).access, "session");
  assert.equal(guard(post("/api/journal/import", 5_000_000)).access, "session", "CSV import has a larger limit");
  assert.equal(guard(post("/api/journal/import", 9_000_000)).response?.status, 413);
});
