-- Settings → Security lists the signed-in user's active sessions (package 2, ADR 0017).
-- auth.sessions is not exposed through the API, so the server reads it through this function.
-- Only the service role may call it; the route passes the auth user id of the verified session.
CREATE FUNCTION public.list_auth_sessions(p_auth_user_id uuid)
RETURNS TABLE (id uuid, created_at timestamptz, updated_at timestamptz, user_agent text, ip text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT s.id, s.created_at, coalesce(s.refreshed_at AT TIME ZONE 'utc', s.updated_at), s.user_agent, host(s.ip)
  FROM auth.sessions s
  WHERE s.user_id = p_auth_user_id AND (s.not_after IS NULL OR s.not_after > now())
  ORDER BY coalesce(s.refreshed_at AT TIME ZONE 'utc', s.updated_at) DESC NULLS LAST
  LIMIT 50;
$$;
-- The built-in EXECUTE for PUBLIC must be revoked explicitly (see 20261111182306_user_auth.sql).
REVOKE ALL ON FUNCTION public.list_auth_sessions(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_auth_sessions(uuid) TO service_role;
