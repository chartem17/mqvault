-- User accounts (ADR 0017): app_users rows are linked to Supabase Auth users; sign-up is by invitation.
-- Additive for data: no existing row is changed or removed. Client roles lose every direct privilege on
-- public objects — the application reaches the database only from the server with the service key.

-- 1. Link an application user to its Supabase Auth identity.
--    SET NULL (not CASCADE): removing an Auth user by mistake must not wipe a journal. Account deletion in the
--    app removes the app_users row explicitly.
ALTER TABLE public.app_users
  ADD COLUMN auth_user_id uuid UNIQUE REFERENCES auth.users (id) ON DELETE SET NULL;
ALTER TABLE public.app_users
  ADD CONSTRAINT app_users_email_lowercase CHECK (email IS NULL OR email = lower(btrim(email)));
-- is_owner now means "administrator of the installation"; there is still at most one.
CREATE UNIQUE INDEX app_users_single_owner ON public.app_users (is_owner) WHERE is_owner;

-- 2. Closed beta: e-mails allowed to create an account. Checked on the server when the first session of a
--    confirmed e-mail asks for a workspace; not needed once AUTH_SIGNUP_MODE=open.
CREATE TABLE public.beta_invites (
  email text PRIMARY KEY CHECK (email = lower(btrim(email)) AND char_length(email) BETWEEN 3 AND 254),
  note text CHECK (note IS NULL OR char_length(note) <= 500),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.beta_invites ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.beta_invites TO service_role;

-- 3. Defense in depth. Until now nobody held a Supabase user token; with real accounts every signed-in
--    browser holds one (role `authenticated`). RLS without policies already denies them every row;
--    removing the grants as well means a table created later without RLS is still unreachable.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
-- The built-in EXECUTE for PUBLIC on new functions cannot be removed per schema: every later migration that
-- creates a function must still REVOKE it explicitly (tests/user-auth-migration.sql shows the check).
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO service_role;
