import { createRouteAuthClient } from "@/lib/supabase/auth-server";
import { WORKSPACE_DENIAL, workspaceFor } from "@/lib/supabase/private-owner";
import { createServerSupabase } from "@/lib/supabase/server";

type AuthClient = Awaited<ReturnType<typeof createRouteAuthClient>>;

/**
 * Runs right after a session was created (password, e-mail link or OAuth): the person keeps the session only
 * if a workspace exists or may be created for them. Otherwise the session is dropped again, so nobody stays
 * "signed in" to an app that answers 403 to everything.
 */
export async function admitSession(client: AuthClient, authUserId: string): Promise<{ ok: true } | { ok: false; reason: keyof typeof WORKSPACE_DENIAL }> {
  const workspace = await workspaceFor(createServerSupabase(), authUserId);
  if (workspace.user) return { ok: true };
  await client.auth.signOut({ scope: "local" }).catch(() => undefined);
  return { ok: false, reason: workspace.reason };
}
