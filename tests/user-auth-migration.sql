\set ON_ERROR_STOP on
-- CI-only: run in a disposable PostgreSQL 17 database, never the application database.
DO $$ BEGIN
  IF current_database() <> 'user_auth_ci' THEN
    RAISE EXCEPTION 'Refusing to run outside disposable user_auth_ci database';
  END IF;
END $$;
BEGIN;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END $$;

-- The parts of production this migration touches, as they were on 2026-11-09.
CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text);
CREATE TABLE public.app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE,
  is_owner boolean NOT NULL DEFAULT false,
  timezone text NOT NULL DEFAULT 'Europe/Kyiv',
  locale text NOT NULL DEFAULT 'uk'
);
CREATE TABLE public.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.app_users (id) ON DELETE CASCADE,
  name text NOT NULL
);
CREATE SEQUENCE public.legacy_seq;
CREATE FUNCTION public.vault_delete_entity(p_owner_id uuid) RETURNS integer LANGUAGE sql AS $$ SELECT 1 $$;
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;

INSERT INTO public.app_users (id, email, is_owner) VALUES ('00000000-0000-4000-8000-000000000001', 'owner@example.test', true);
INSERT INTO public.accounts (user_id, name) VALUES ('00000000-0000-4000-8000-000000000001', 'Owner account');

\ir ../supabase/migrations/20261109180000_user_auth.sql

-- Existing data is untouched and the owner is not linked to anybody yet.
DO $$ BEGIN
  IF (SELECT count(*) FROM public.app_users) <> 1 OR (SELECT count(*) FROM public.accounts) <> 1 THEN RAISE EXCEPTION 'rows changed'; END IF;
  IF (SELECT auth_user_id FROM public.app_users) IS NOT NULL THEN RAISE EXCEPTION 'owner must start unlinked'; END IF;
END $$;

-- One Auth user ↔ one application user; deleting the Auth user keeps the journal.
INSERT INTO auth.users (id, email) VALUES ('00000000-0000-4000-8000-0000000000a1', 'owner@example.test'), ('00000000-0000-4000-8000-0000000000a2', 'second@example.test');
UPDATE public.app_users SET auth_user_id = '00000000-0000-4000-8000-0000000000a1' WHERE is_owner;
DO $$ BEGIN
  BEGIN
    INSERT INTO public.app_users (email, auth_user_id) VALUES ('dup@example.test', '00000000-0000-4000-8000-0000000000a1');
    RAISE EXCEPTION 'an Auth user was linked twice';
  EXCEPTION WHEN unique_violation THEN NULL; END;
  BEGIN
    INSERT INTO public.app_users (email, is_owner) VALUES ('owner2@example.test', true);
    RAISE EXCEPTION 'a second owner was accepted';
  EXCEPTION WHEN unique_violation THEN NULL; END;
  BEGIN
    INSERT INTO public.app_users (email) VALUES ('Mixed@Example.test');
    RAISE EXCEPTION 'a non-lowercase e-mail was accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    INSERT INTO public.beta_invites (email) VALUES (' Padded@example.test');
    RAISE EXCEPTION 'a non-normalized invite was accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
END $$;
INSERT INTO public.beta_invites (email, note) VALUES ('second@example.test', 'ci');
DELETE FROM auth.users WHERE id = '00000000-0000-4000-8000-0000000000a1';
DO $$ BEGIN
  IF (SELECT count(*) FROM public.accounts) <> 1 THEN RAISE EXCEPTION 'deleting an Auth user removed journal data'; END IF;
  IF (SELECT auth_user_id FROM public.app_users WHERE is_owner) IS NOT NULL THEN RAISE EXCEPTION 'link must be cleared'; END IF;
END $$;

-- Client roles: nothing in public is reachable, including objects created after the migration.
CREATE TABLE public.created_later (id integer);
CREATE FUNCTION public.created_later_fn() RETURNS integer LANGUAGE sql AS $$ SELECT 1 $$;
REVOKE ALL ON FUNCTION public.created_later_fn() FROM PUBLIC;
DO $$
DECLARE role_name text; object_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    FOR object_name IN SELECT c.oid::regclass::text FROM pg_class c WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r', 'v') LOOP
      IF has_table_privilege(role_name, object_name, 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE') THEN RAISE EXCEPTION '% can still reach %', role_name, object_name; END IF;
    END LOOP;
    FOR object_name IN SELECT c.oid::regclass::text FROM pg_class c WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'S' LOOP
      IF has_sequence_privilege(role_name, object_name, 'USAGE, SELECT, UPDATE') THEN RAISE EXCEPTION '% can still use %', role_name, object_name; END IF;
    END LOOP;
    FOR object_name IN SELECT p.oid::regprocedure::text FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace LOOP
      IF has_function_privilege(role_name, object_name, 'EXECUTE') THEN RAISE EXCEPTION '% can still execute %', role_name, object_name; END IF;
    END LOOP;
  END LOOP;
  IF NOT has_function_privilege('service_role', 'public.vault_delete_entity(uuid)', 'EXECUTE') THEN RAISE EXCEPTION 'service_role lost EXECUTE'; END IF;
  IF NOT has_table_privilege('service_role', 'public.beta_invites', 'SELECT') THEN RAISE EXCEPTION 'service_role cannot read invites'; END IF;
END $$;
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  BEGIN
    PERFORM 1 FROM public.accounts;
    RAISE EXCEPTION 'authenticated read accounts';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;

ROLLBACK;
SELECT 'user auth migration tests passed in disposable PostgreSQL' AS result;
