import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

// Static safety net for user isolation (ADR 0017): a new API route cannot ship without saying who may call it.
// Every route handler must resolve the signed-in user, or be listed here with the reason it does not.

const USER_RESOLVER = /\bresolveUser\(/;
const EXEMPT = {
  "api/accounts/route.ts": { reason: "re-exports handlers that resolve the user", proof: /from "@\/lib\/accounts\/account-api"/, file: "src/lib/accounts/account-api.ts" },
  "api/auth/login/route.ts": { reason: "creates the session", proof: /signInWithPassword\(/ },
  "api/auth/signup/route.ts": { reason: "creates the account", proof: /auth\.signUp\(/ },
  "api/auth/reset/route.ts": { reason: "sends a reset e-mail", proof: /resetPasswordForEmail\(/ },
  "api/auth/logout/route.ts": { reason: "ends the session", proof: /auth\.signOut\(/ },
  "api/auth/google/route.ts": { reason: "starts OAuth", proof: /signInWithOAuth\(/ },
  "api/auth/password/route.ts": { reason: "acts on the verified session's own Auth user", proof: /auth\.getClaims\(\)/ },
  "api/auth/verify/route.ts": { reason: "confirms an e-mail with its one-time code, then admits the session", proof: /verifyOtp\(/ },
  "api/auth/resend/route.ts": { reason: "re-sends the confirmation letter, rate-limited", proof: /auth\.resend\(/ },
  "auth/callback/route.ts": { reason: "finishes a PKCE flow", proof: /exchangeCodeForSession\(/ },
  "auth/confirm/route.ts": { reason: "verifies a one-time e-mail token", proof: /verifyOtp\(/ },
  "api/bridge/device/deals/route.ts": { reason: "device signature", proof: /authenticateDevice\(/ },
  "api/bridge/device/heartbeat/route.ts": { reason: "device signature", proof: /authenticateDevice\(/ },
  "api/bridge/pairings/route.ts": { reason: "public pairing request, rate-limited, stores only a code hash", proof: /bridge_rate_limit_hit/ },
  "api/bridge/pairings/[id]/route.ts": { reason: "device signature over its own pairing", proof: /verifySignedRequest\(/ },
  "api/economic-calendar/sync/route.ts": { reason: "bearer token (ADR 0015)", proof: /safeEqual\(/ },
  "api/mt5/health/route.ts": { reason: "retired, static answer", proof: /retiredMt5Response\(/ },
  "api/mt5/history/route.ts": { reason: "retired, static answer", proof: /retiredMt5Response\(/ },
  "api/mt5/positions/route.ts": { reason: "retired, static answer", proof: /retiredMt5Response\(/ },
};

function routes(dir) {
  return readdirSync(dir).flatMap(name => { const path = join(dir, name); return statSync(path).isDirectory() ? routes(path) : name === "route.ts" ? [path] : []; });
}
const key = path => relative(join("src", "app"), path).split(sep).join("/");
const all = routes(join("src", "app"));

test("every route handler resolves the signed-in user or is an explained exception", () => {
  const unguarded = [];
  for (const path of all) {
    const source = readFileSync(path, "utf8");
    const exempt = EXEMPT[key(path)];
    if (exempt) {
      assert.match(source, exempt.proof, `${key(path)} no longer matches its exemption (${exempt.reason})`);
      if (exempt.file) assert.match(readFileSync(exempt.file, "utf8"), USER_RESOLVER, `${exempt.file} must resolve the user`);
      continue;
    }
    // One resolver call per exported handler.
    const handlers = (source.match(/export (?:async )?function (?:GET|POST|PUT|PATCH|DELETE)\b/g) ?? []).length;
    const resolved = (source.match(new RegExp(USER_RESOLVER, "g")) ?? []).length;
    if (handlers === 0 || resolved < handlers) unguarded.push(`${key(path)}: ${handlers} handlers, ${resolved} user checks`);
  }
  assert.deepEqual(unguarded, []);
});

test("the exemption list has no stale entries", () => {
  const existing = new Set(all.map(key));
  assert.deepEqual(Object.keys(EXEMPT).filter(path => !existing.has(path)), []);
});

test("the user id never comes from the request", () => {
  const offenders = [];
  for (const path of [...all, join("src", "lib", "accounts", "account-api.ts")]) {
    const source = readFileSync(path, "utf8");
    // body.user_id / searchParams.get("user_id") / params.user_id style reads.
    if (/\b(?:body|payload|params|query|row|raw)\??\.(?:user_id|ownerId|owner_id)\b/.test(source) || /get\(\s*["'](?:user_id|owner_id|ownerId)["']\s*\)/.test(source)) offenders.push(key(path));
  }
  assert.deepEqual(offenders, []);
});

test("the service-role client is not reachable from client components", () => {
  const offenders = [];
  const walk = dir => readdirSync(dir).flatMap(name => { const path = join(dir, name); return statSync(path).isDirectory() ? walk(path) : /\.tsx?$/.test(name) ? [path] : []; });
  for (const path of walk("src")) {
    const source = readFileSync(path, "utf8");
    if (!/^\s*["']use client["']/.test(source)) continue;
    if (/@\/lib\/supabase\/(?:server|auth-server)|@\/lib\/auth\/(?:current-user|sign-in|auth-api)|SUPABASE_SECRET_KEY|@supabase\//.test(source)) offenders.push(path);
  }
  assert.deepEqual(offenders, []);
});
