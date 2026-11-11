/**
 * Maps a Supabase Auth identity to the application user that owns the data (ADR 0017).
 * Pure decision logic over a small store interface, so the rules are unit-tested without a database.
 */

export type AppUser = { id: string; isOwner: boolean; email: string | null };

export type AuthIdentity = {
  authUserId: string;
  /** Lower-cased e-mail as stored by the Auth server. */
  email: string | null;
  /** True only when the Auth server itself confirmed the address (link clicked or a verified OAuth e-mail). */
  emailConfirmed: boolean;
  locale?: "en" | "uk";
  timezone?: string;
};

export type SignupMode = "invite" | "open";

export interface UserStore {
  findByAuthId(authUserId: string): Promise<AppUser | null>;
  /** An application user created before accounts existed (the installation owner) that nobody has claimed yet. */
  findUnlinkedByEmail(email: string): Promise<AppUser | null>;
  /** Links only while the row is still unclaimed; returns false when somebody else got there first. */
  link(userId: string, authUserId: string): Promise<boolean>;
  isInvited(email: string): Promise<boolean>;
  /** Creates the user, or returns the existing one when a parallel request has just created it. */
  create(identity: AuthIdentity & { email: string }): Promise<AppUser | null>;
}

export function signupMode(value: string | undefined): SignupMode {
  return value === "open" ? "open" : "invite";
}

export type ProvisionResult = { user: AppUser } | { user: null; reason: "unconfirmed" | "not_invited" | "unavailable" };

export async function findOrProvisionUser(store: UserStore, identity: AuthIdentity, mode: SignupMode): Promise<ProvisionResult> {
  const existing = await store.findByAuthId(identity.authUserId);
  if (existing) return { user: existing };

  // Everything below hands out a workspace on the strength of the e-mail address alone,
  // so the address must be proven to belong to this person.
  if (!identity.email || !identity.emailConfirmed) return { user: null, reason: "unconfirmed" };
  const email = identity.email;

  const unclaimed = await store.findUnlinkedByEmail(email);
  if (unclaimed) {
    if (await store.link(unclaimed.id, identity.authUserId)) return { user: unclaimed };
    const raced = await store.findByAuthId(identity.authUserId);
    return raced ? { user: raced } : { user: null, reason: "unavailable" };
  }

  if (mode !== "open" && !(await store.isInvited(email))) return { user: null, reason: "not_invited" };
  const created = await store.create({ ...identity, email });
  return created ? { user: created } : { user: null, reason: "unavailable" };
}
