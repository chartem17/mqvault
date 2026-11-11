import { authJson } from "@/lib/auth/auth-api";
import { createRouteAuthClient } from "@/lib/supabase/auth-server";

export const dynamic = "force-dynamic";

/** POST → ends this browser's session (other devices stay signed in) and clears the cookies. */
export async function POST() {
  const client = await createRouteAuthClient();
  await client.auth.signOut({ scope: "local" }).catch(() => undefined);
  return authJson({ ok: true });
}
