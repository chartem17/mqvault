import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const guard = require("../.tmp-request-guard-tests/lib/auth/request-guard.js");
const { guardRequest, unauthenticatedResponse, safeNextPath, parseBasicCredentials, passwordProblem, passwordStrength, normalizeOtp, isEmail, safeEqual, TOKEN_PATHS, PUBLIC_PATHS } = guard;

const req = (path, method = "GET", headers = {}) => new Request(`https://vault.test${path}`, { method, headers });
const sameOrigin = { origin: "https://vault.test", "content-type": "application/json" };
const kind = (...args) => guardRequest(req(...args)).kind;
const status = (...args) => guardRequest(req(...args)).response?.status;

test("only POST to a token path skips the session (the route checks its own token)", () => {
  assert.deepEqual([...TOKEN_PATHS], ["/api/economic-calendar/sync"]);
  assert.equal(kind("/api/economic-calendar/sync", "POST"), "open");
  assert.equal(kind("/api/economic-calendar/sync", "GET"), "session");
  assert.equal(status("/api/economic-calendar/sync", "DELETE"), 403);
  assert.equal(status("/api/economic-calendar/sync/", "POST"), 403, "no prefix matching");
  assert.equal(status("/api/economic-calendar", "POST"), 403);
});

test("Bridge device paths skip the session only for their exact method", () => {
  assert.equal(kind("/api/bridge/device/heartbeat", "POST"), "open");
  assert.equal(kind("/api/bridge/device/deals", "POST"), "open");
  assert.equal(kind("/api/bridge/pairings", "POST"), "open");
  assert.equal(kind("/api/bridge/pairings/00000000-0000-4000-8000-000000000001", "GET"), "open");
  assert.equal(kind("/api/bridge/device/heartbeat", "GET"), "session");
  assert.equal(kind("/api/bridge/devices", "GET"), "session");
  assert.equal(kind("/api/bridge/pairings/approve", "POST", sameOrigin), "session");
  assert.equal(status("/api/bridge/pairings/approve", "POST"), 403);
});

test("every change must be a same-origin JSON request, public auth endpoints included", () => {
  assert.equal(kind("/api/journal/trades", "POST", sameOrigin), "session");
  assert.equal(status("/api/journal/trades", "POST", { origin: "https://evil.test", "content-type": "application/json" }), 403);
  assert.equal(status("/api/journal/trades", "POST", { origin: "https://vault.test", "content-type": "text/plain" }), 403);
  assert.equal(status("/api/journal/trades", "DELETE", { "content-type": "application/json" }), 403, "missing Origin");
  assert.equal(status("/api/auth/login", "POST", { origin: "https://evil.test", "content-type": "application/json" }), 403);
  assert.equal(status("/api/auth/logout", "POST"), 403);
  assert.equal(kind("/api/auth/login", "POST", sameOrigin), "public");
  // Basic credentials do not lift the same-origin rule for changes.
  assert.equal(status("/api/journal/trades", "POST", { authorization: "Basic YUBiLmNvOnBhc3N3b3Jk" }), 403);
});

test("public paths are exact; everything else needs a session", () => {
  for (const path of PUBLIC_PATHS) assert.equal(kind(path), "public", path);
  for (const path of ["/", "/journal", "/bridge/connect", "/api/accounts", "/api/auth/password", "/api/auth/logout", "/login/x", "/api/auth/login/x", "/auth/callback/x", "/API/AUTH/LOGIN"]) assert.equal(kind(path), "session", path);
});

test("Basic credentials are passed to the route only for API paths", () => {
  const authorization = "Basic YUBiLmNvOnBhc3N3b3Jk";
  assert.equal(kind("/api/accounts", "GET", { authorization }), "basic");
  assert.equal(kind("/", "GET", { authorization }), "session");
  assert.equal(kind("/api/accounts", "GET", { authorization: "Bearer x" }), "session");
  assert.equal(kind("/api/accounts", "GET", { authorization: "Basic " + "x".repeat(5000) }), "session");
});

test("unauthenticated pages go to /login with a way back; API calls get 401", () => {
  const page = unauthenticatedResponse(req("/journal?tab=x"));
  assert.equal(page.status, 307);
  assert.equal(page.headers.get("location"), "https://vault.test/login?next=%2Fjournal%3Ftab%3Dx");
  assert.equal(unauthenticatedResponse(req("/")).headers.get("location"), "https://vault.test/login");
  assert.equal(unauthenticatedResponse(req("/api/accounts")).status, 401);
  assert.equal(unauthenticatedResponse(req("/journal", "POST", sameOrigin)).status, 401);
});

test("safeNextPath only allows local application paths", () => {
  assert.equal(safeNextPath("/journal"), "/journal");
  assert.equal(safeNextPath("/?tab=journal&focusTradeIds=1"), "/?tab=journal&focusTradeIds=1");
  assert.equal(safeNextPath("/bridge/connect?code=AB"), "/bridge/connect?code=AB");
  for (const bad of [null, undefined, "", "https://evil.com", "//evil.com", "/\\evil.com", "/a\\b", "/login", "/login?next=/x", "/login/", "/auth/callback?code=1", "/api/auth/logout", "journal", "/a\nb", "/" + "a".repeat(3000)]) assert.equal(safeNextPath(bad), "/", String(bad));
});

test("Basic credentials: email, password with colons, nothing malformed", () => {
  const basic = value => "Basic " + Buffer.from(value, "utf8").toString("base64");
  assert.deepEqual(parseBasicCredentials(basic("Me@Example.com:pa:ss:word")), { email: "me@example.com", password: "pa:ss:word" });
  for (const bad of [null, "", "Bearer x", "Basic ???", basic("owner:secret"), basic("me@example.com:"), basic("me@example.com"), basic(":x")]) assert.equal(parseBasicCredentials(bad), null, String(bad));
});

test("password rules and strength meter", () => {
  assert.equal(passwordProblem("1234567"), "Password must be at least 8 characters");
  assert.equal(passwordProblem(12345678), "Password must be at least 8 characters");
  assert.equal(passwordProblem("x".repeat(73)), "Password is too long");
  assert.equal(passwordProblem("я".repeat(37)), "Password is too long", "72 bytes, not characters");
  assert.equal(passwordProblem("correct horse"), null);
  assert.equal(passwordStrength(""), 0);
  assert.equal(passwordStrength("abc"), 1);
  assert.equal(passwordStrength("password123456"), 1);
  assert.equal(passwordStrength("aaaaaaaaaaaaaa"), 1);
  assert.equal(passwordStrength("abcdefgh"), 1);
  assert.equal(passwordStrength("abcdefg1"), 2);
  assert.equal(passwordStrength("abcdefghijk1"), 3);
  assert.equal(passwordStrength("Abcdefghijk1!"), 4);
});

test("codes, emails and constant-time comparison", async () => {
  assert.equal(normalizeOtp(" 123 456 "), "123456");
  assert.equal(normalizeOtp("12345678"), "12345678");
  for (const bad of ["12345", "12345a", "", null, 123456, "1".repeat(11)]) assert.equal(normalizeOtp(bad), null);
  assert.equal(isEmail("a@b.co"), true);
  for (const bad of ["a@b", "a b@c.d", "@b.co", "", null, "a@" + "b".repeat(260) + ".co"]) assert.equal(isEmail(bad), false);
  assert.equal(await safeEqual("token", "token"), true);
  assert.equal(await safeEqual("token", "tokem"), false);
});
