import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { checkPrivateAccess, TOKEN_PATHS } = require("../.tmp-private-access-tests/lib/auth/private-access.js");

process.env.VAULT_ACCESS_PASSWORD = "a-very-long-test-password-123";
const req = (path, method = "GET", headers = {}) => new Request(`https://vault.test${path}`, { method, headers });

test("only POST to a token path skips the session check (the route checks its own token)", async () => {
  assert.deepEqual([...TOKEN_PATHS], ["/api/economic-calendar/sync"]);
  assert.equal(await checkPrivateAccess(req("/api/economic-calendar/sync", "POST")), null);
  assert.equal((await checkPrivateAccess(req("/api/economic-calendar/sync", "GET"))).status, 401);
  assert.equal((await checkPrivateAccess(req("/api/economic-calendar/sync", "DELETE"))).status, 403);
  assert.equal((await checkPrivateAccess(req("/api/economic-calendar/sync/", "POST"))).status, 403, "no prefix matching");
  assert.equal((await checkPrivateAccess(req("/api/economic-calendar", "POST"))).status, 403);
  assert.equal((await checkPrivateAccess(req("/api/journal/trades", "POST", { origin: "https://vault.test", "content-type": "application/json" }))).status, 401);
  assert.equal((await checkPrivateAccess(req("/api/economic-calendar"))).status, 401);
});
