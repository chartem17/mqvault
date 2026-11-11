import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { findOrProvisionUser, signupMode } = require("../.tmp-user-provision-tests/lib/auth/provision.js");

/** In-memory stand-in for app_users / beta_invites with the same uniqueness rules as the database. */
function fakeStore({ users = [], invites = [] } = {}) {
  const rows = users.map(user => ({ authUserId: null, isOwner: false, ...user }));
  const view = row => (row ? { id: row.id, isOwner: row.isOwner, email: row.email } : null);
  return {
    rows,
    findByAuthId: async authUserId => view(rows.find(row => row.authUserId === authUserId)),
    findUnlinkedByEmail: async email => view(rows.find(row => row.email === email && row.authUserId === null)),
    link: async (userId, authUserId) => {
      const row = rows.find(item => item.id === userId);
      if (!row || row.authUserId !== null || rows.some(item => item.authUserId === authUserId)) return false;
      row.authUserId = authUserId; return true;
    },
    isInvited: async email => invites.includes(email),
    create: async identity => {
      const existing = rows.find(row => row.authUserId === identity.authUserId);
      if (existing) return view(existing);
      if (rows.some(row => row.email === identity.email)) return null;
      const row = { id: `user-${rows.length + 1}`, email: identity.email, isOwner: false, authUserId: identity.authUserId };
      rows.push(row); return view(row);
    },
  };
}
const identity = (authUserId, email, emailConfirmed = true) => ({ authUserId, email, emailConfirmed });

test("sign-up mode defaults to invitation only", () => {
  assert.equal(signupMode(undefined), "invite");
  assert.equal(signupMode("OPEN"), "invite");
  assert.equal(signupMode("open"), "open");
});

test("a linked user always resolves to their own workspace", async () => {
  const store = fakeStore({ users: [{ id: "owner", email: "owner@x.io", isOwner: true, authUserId: "auth-owner" }, { id: "second", email: "second@x.io", authUserId: "auth-second" }] });
  assert.equal((await findOrProvisionUser(store, identity("auth-owner", "owner@x.io"), "invite")).user.id, "owner");
  assert.equal((await findOrProvisionUser(store, identity("auth-second", "second@x.io"), "invite")).user.id, "second");
  // The link, not the e-mail in the token, decides: an Auth user that later changes its e-mail keeps its own workspace.
  assert.equal((await findOrProvisionUser(store, identity("auth-second", "owner@x.io"), "invite")).user.id, "second");
});

test("the pre-existing owner is claimed only by a confirmed session of the same e-mail, once", async () => {
  const store = fakeStore({ users: [{ id: "owner", email: "owner@x.io", isOwner: true }] });
  assert.deepEqual(await findOrProvisionUser(store, identity("auth-fake", "owner@x.io", false), "open"), { user: null, reason: "unconfirmed" });
  assert.equal(store.rows[0].authUserId, null, "an unconfirmed address must not claim the owner's journal");
  const claimed = await findOrProvisionUser(store, identity("auth-owner", "owner@x.io"), "invite");
  assert.deepEqual(claimed.user, { id: "owner", isOwner: true, email: "owner@x.io" });
  // A second Auth identity with the same address cannot take over or get a duplicate workspace.
  const second = await findOrProvisionUser(store, identity("auth-other", "owner@x.io"), "open");
  assert.equal(second.user, null);
  assert.equal(store.rows.length, 1);
  assert.equal(store.rows[0].authUserId, "auth-owner");
});

test("closed beta: no invitation, no workspace", async () => {
  const store = fakeStore({ users: [{ id: "owner", email: "owner@x.io", isOwner: true, authUserId: "auth-owner" }], invites: ["friend@x.io"] });
  assert.deepEqual(await findOrProvisionUser(store, identity("auth-stranger", "stranger@x.io"), "invite"), { user: null, reason: "not_invited" });
  assert.deepEqual(await findOrProvisionUser(store, identity("auth-friend", "friend@x.io", false), "invite"), { user: null, reason: "unconfirmed" });
  assert.deepEqual(await findOrProvisionUser(store, identity("auth-none", null), "open"), { user: null, reason: "unconfirmed" });
  assert.equal(store.rows.length, 1);
  const friend = await findOrProvisionUser(store, identity("auth-friend", "friend@x.io"), "invite");
  assert.equal(friend.user.isOwner, false);
  assert.notEqual(friend.user.id, "owner", "a new user never lands in somebody else's workspace");
  assert.equal((await findOrProvisionUser(store, identity("auth-friend", "friend@x.io"), "invite")).user.id, friend.user.id, "repeat visits reuse the same workspace");
  assert.equal(store.rows.length, 2);
});

test("open mode creates a workspace for any confirmed e-mail; parallel first requests end in one workspace", async () => {
  const store = fakeStore();
  const [a, b] = await Promise.all([findOrProvisionUser(store, identity("auth-1", "new@x.io"), "open"), findOrProvisionUser(store, identity("auth-1", "new@x.io"), "open")]);
  assert.equal(a.user.id, b.user.id);
  assert.equal(store.rows.length, 1);
});

test("losing the race for an unclaimed row does not leak it", async () => {
  const store = fakeStore({ users: [{ id: "owner", email: "owner@x.io", isOwner: true }] });
  const realLink = store.link;
  store.link = async (userId, authUserId) => { await realLink(userId, "auth-winner"); return realLink(userId, authUserId); };
  assert.deepEqual(await findOrProvisionUser(store, identity("auth-loser", "owner@x.io"), "invite"), { user: null, reason: "unavailable" });
  assert.equal(store.rows[0].authUserId, "auth-winner");
});
