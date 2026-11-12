import { NextResponse } from "next/server";
import { guardRequest } from "./request-guard";
import { findOrProvisionUser, signupMode, type AppUser, type AuthIdentity, type UserStore } from "./provision";
import { isValidTimeZone } from "@/lib/time/timezone";
import { createRouteAuthClient, readSessionIdentity } from "@/lib/supabase/auth-server";
import { createServerSupabase } from "@/lib/supabase/server";

type Db = ReturnType<typeof createServerSupabase>;
const NO_STORE = { "Cache-Control": "no-store" };
const deny = (status: number, error: string, code: string) => NextResponse.json({ error, code }, { status, headers: NO_STORE });
const toUser = (row: { id: unknown; is_owner: unknown; email: unknown }): AppUser => ({ id: String(row.id), isOwner: row.is_owner === true, email: typeof row.email === "string" ? row.email : null });
const COLUMNS = "id, is_owner, email";

function userStore(db: Db): UserStore {
  return {
    async findByAuthId(authUserId) {
      const { data, error } = await db.from("app_users").select(COLUMNS).eq("auth_user_id", authUserId).maybeSingle();
      if (error) throw new Error(`app_users lookup failed: ${error.code}`);
      return data ? toUser(data) : null;
    },
    async findUnlinkedByEmail(email) {
      const { data, error } = await db.from("app_users").select(COLUMNS).eq("email", email).is("auth_user_id", null).maybeSingle();
      if (error) throw new Error(`app_users lookup failed: ${error.code}`);
      return data ? toUser(data) : null;
    },
    async link(userId, authUserId) {
      const { data, error } = await db.from("app_users").update({ auth_user_id: authUserId, updated_at: new Date().toISOString() }).eq("id", userId).is("auth_user_id", null).select("id").maybeSingle();
      if (error && error.code !== "23505") throw new Error(`app_users link failed: ${error.code}`);
      return Boolean(data);
    },
    async isInvited(email) {
      const { data, error } = await db.from("beta_invites").select("email").eq("email", email).maybeSingle();
      if (error) throw new Error(`beta_invites lookup failed: ${error.code}`);
      return Boolean(data);
    },
    async create(identity) {
      const { data, error } = await db.from("app_users").insert({
        auth_user_id: identity.authUserId, email: identity.email, is_owner: false,
        locale: identity.locale ?? "en", ...(identity.timezone ? { timezone: identity.timezone } : {}),
      }).select(COLUMNS).maybeSingle();
      if (data) return toUser(data);
      if (error?.code === "23505") return this.findByAuthId(identity.authUserId);
      throw new Error(`app_users insert failed: ${error?.code}`);
    },
  };
}

/** First visit of a session without a workspace: ask the Auth server (not the token) whether the e-mail is confirmed. */
async function confirmedIdentity(db: Db, authUserId: string): Promise<AuthIdentity | null> {
  const { data, error } = await db.auth.admin.getUserById(authUserId);
  const user = data?.user;
  if (error || !user) return null;
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  return {
    authUserId,
    email: user.email ? user.email.toLowerCase() : null,
    emailConfirmed: Boolean(user.email_confirmed_at),
    locale: meta.locale === "uk" || meta.locale === "en" ? meta.locale : undefined,
    timezone: typeof meta.timezone === "string" && meta.timezone.length <= 64 && isValidTimeZone(meta.timezone) ? meta.timezone : undefined,
  };
}

/**
 * `db` queries as the signed-in user (their own token, role `authenticated`): Postgres row-level security
 * refuses every row of another user even if a query forgets its user_id filter (ADR 0018).
 * `admin` is the service-key client, for the few places ADR 0018 lists (Auth admin API, pairing, sessions list).
 */
export type UserContext = { db: UserDb; admin: Db; ownerId: string; isOwner: boolean; email: string | null };
type UserDb = Awaited<ReturnType<typeof createRouteAuthClient>>;
export type Workspace = { user: AppUser } | { user: null; reason: "unauthenticated" | "unconfirmed" | "not_invited" | "unavailable" };

/** The application user behind an Auth user id; creates or links it on the first visit when the rules allow. */
export async function workspaceFor(db: Db, authUserId: string): Promise<Workspace> {
  try {
    const store = userStore(db);
    const known = await store.findByAuthId(authUserId);
    if (known) return { user: known };
    const identity = await confirmedIdentity(db, authUserId);
    if (!identity) return { user: null, reason: "unauthenticated" };
    return await findOrProvisionUser(store, identity, signupMode(process.env.AUTH_SIGNUP_MODE));
  } catch (error) {
    console.error("User resolution failed", error instanceof Error ? error.message : "Unknown error");
    return { user: null, reason: "unavailable" };
  }
}

/** English dictionary keys for the reasons a signed-in person has no workspace. */
export const WORKSPACE_DENIAL = {
  unauthenticated: { status: 401, error: "Authentication required" },
  unconfirmed: { status: 403, error: "Confirm your e-mail address to continue" },
  not_invited: { status: 403, error: "This e-mail is not on the closed beta list yet" },
  unavailable: { status: 503, error: "Service is temporarily unavailable" },
} as const;

/**
 * The signed-in user for an API route. `ownerId` is the app_users.id every query must be scoped by;
 * it comes from the verified session only — never from the URL, a header or the request body.
 */
export async function resolveUser(request: Request): Promise<UserContext | Response> {
  const guard = guardRequest(request);
  if (guard.access === "denied") return guard.response;
  const auth = await createRouteAuthClient();
  const session = await readSessionIdentity(auth);
  if (!session) return deny(401, "Authentication required", "unauthenticated");
  const admin = createServerSupabase();
  const workspace = await workspaceFor(admin, session.authUserId);
  if (workspace.user) return { db: auth, admin, ownerId: workspace.user.id, isOwner: workspace.user.isOwner, email: workspace.user.email };
  const denial = WORKSPACE_DENIAL[workspace.reason];
  return deny(denial.status, denial.error, workspace.reason);
}

/** Features limited to the installation owner during the closed beta (calendar and market data are licensed for private use). */
export function ownerOnly(context: UserContext): Response | null {
  return context.isOwner ? null : deny(403, "This section is not available in the closed beta", "owner_only");
}
