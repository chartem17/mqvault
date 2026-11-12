-- Security log (package 3): sign-ins, password changes, sign-out everywhere, data exports, account and Bridge
-- changes. Written only by the server (service key); a user reads only their own events (RLS, ADR 0018).
-- Rows go with the user (ON DELETE CASCADE). New table; no existing data changes.
CREATE TABLE public.audit_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.app_users (id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN (
    'sign_in', 'password_changed', 'sign_out_everywhere', 'data_exported', 'account_deleted', 'strategy_deleted',
    'bridge_device_connected', 'bridge_device_revoked'
  )),
  method text CHECK (method IS NULL OR char_length(method) <= 20),
  detail jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(detail) = 'object' AND octet_length(detail::text) <= 2048),
  ip_hash text CHECK (ip_hash IS NULL OR char_length(ip_hash) <= 64),
  user_agent text CHECK (user_agent IS NULL OR char_length(user_agent) <= 300),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_events_user_created_idx ON public.audit_events (user_id, created_at DESC);

ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.audit_events FROM anon, authenticated;
GRANT SELECT ON public.audit_events TO authenticated;
GRANT ALL ON public.audit_events TO service_role;
CREATE POLICY audit_events_select_own ON public.audit_events FOR SELECT TO authenticated
  USING (user_id = (SELECT private.current_app_user_id()));
