import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { contentSecurityPolicy, createNonce, STATIC_SECURITY_HEADERS } = require("../.tmp-security-headers-tests/lib/security/headers.js");

const parse = csp => Object.fromEntries(csp.split("; ").map(part => { const [name, ...rest] = part.split(" "); return [name, rest.join(" ")]; }));

test("production CSP: nonce scripts only, no framing, no eval", () => {
  const policy = parse(contentSecurityPolicy("abc123=="));
  assert.equal(policy["script-src"], "'self' 'nonce-abc123==' 'strict-dynamic' https://challenges.cloudflare.com");
  assert.equal(policy["frame-ancestors"], "'none'");
  assert.equal(policy["object-src"], "'none'");
  assert.equal(policy["base-uri"], "'self'");
  assert.equal(policy["form-action"], "'self'");
  assert.equal(policy["connect-src"], "'self' https://challenges.cloudflare.com");
  assert.equal(policy["frame-src"], "https://challenges.cloudflare.com", "only the Turnstile widget may be framed");
  assert.ok("upgrade-insecure-requests" in policy);
  assert.ok(!contentSecurityPolicy("x").includes("unsafe-eval"));
  assert.ok(!policy["script-src"].includes("unsafe-inline"));
});

test("development CSP allows eval and the reload socket only", () => {
  const policy = parse(contentSecurityPolicy("n", { dev: true }));
  assert.ok(policy["script-src"].includes("'unsafe-eval'"));
  assert.equal(policy["connect-src"], "'self' https://challenges.cloudflare.com ws:");
  assert.ok(!("upgrade-insecure-requests" in policy));
});

test("nonces are random and base64", () => {
  const a = createNonce(), b = createNonce();
  assert.notEqual(a, b);
  assert.match(a, /^[A-Za-z0-9+/]{22}==$/);
});

test("static headers cover HSTS, sniffing, framing, referrer and permissions", () => {
  const names = STATIC_SECURITY_HEADERS.map(header => header.key);
  for (const name of ["Strict-Transport-Security", "X-Content-Type-Options", "X-Frame-Options", "Referrer-Policy", "Permissions-Policy", "Cross-Origin-Opener-Policy"]) assert.ok(names.includes(name), name);
  assert.match(STATIC_SECURITY_HEADERS.find(header => header.key === "Strict-Transport-Security").value, /max-age=63072000/);
});
