import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { createRecoveryTicket, verifyRecoveryTicket, RECOVERY_MAX_AGE_SECONDS } = require("../.tmp-recovery-ticket-tests/lib/auth/recovery-ticket.js");

const secret = "a-server-only-secret-of-decent-length";
const user = "7b1d5a0e-1111-4222-8333-444455556666";

test("a fresh ticket is valid only for its user, secret and lifetime", async () => {
  const now = 1_800_000_000_000;
  const ticket = await createRecoveryTicket(secret, user, now);
  assert.equal(await verifyRecoveryTicket(secret, ticket, user, now + 1000), true);
  assert.equal(await verifyRecoveryTicket(secret, ticket, "another-user", now + 1000), false);
  assert.equal(await verifyRecoveryTicket("another-server-secret-of-decent-length", ticket, user, now + 1000), false);
  assert.equal(await verifyRecoveryTicket(secret, ticket, user, now + RECOVERY_MAX_AGE_SECONDS * 1000), false, "expired");
});

test("forged, altered and malformed tickets are rejected", async () => {
  const now = 1_800_000_000_000;
  const ticket = await createRecoveryTicket(secret, user, now);
  const [subject, expires, mac] = ticket.split(".");
  assert.equal(await verifyRecoveryTicket(secret, `${subject}.${Number(expires) + 3_600_000}.${mac}`, user, now), false, "extended lifetime");
  assert.equal(await verifyRecoveryTicket(secret, `${subject}.${expires}.${mac.slice(0, -1)}${mac.endsWith("0") ? "1" : "0"}`, user, now), false);
  assert.equal(await verifyRecoveryTicket(secret, `${user}.${expires}.`, user, now), false);
  for (const bad of [undefined, null, "", "a.b", `${user}.abc.def`, "x".repeat(300)]) assert.equal(await verifyRecoveryTicket(secret, bad, user, now), false);
  assert.equal(await verifyRecoveryTicket(undefined, ticket, user, now), false, "no secret configured");
  assert.equal(await verifyRecoveryTicket("short", await createRecoveryTicket("short", user, now), user, now), false, "weak secret");
});
