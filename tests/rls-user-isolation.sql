\set ON_ERROR_STOP on
-- CI-only: run in a disposable PostgreSQL database, never the application database.
-- Applies the real chain user_auth → user_preferences → rls_user_isolation on a minimal copy of the production
-- schema, then proves at the database level that user B can neither read nor change anything of user A.
DO $$ BEGIN
  IF current_database() <> 'rls_isolation_ci' THEN RAISE EXCEPTION 'Refusing to run outside disposable rls_isolation_ci database'; END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END $$;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- Minimal stand-in for Supabase Auth: auth.uid() reads the JWT claims as PostgREST sets them.
CREATE SCHEMA auth;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
CREATE TABLE auth.users (id uuid PRIMARY KEY, email text);
CREATE TABLE auth.sessions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(), refreshed_at timestamp, not_after timestamptz, user_agent text, ip inet);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claims', true)::jsonb->>'sub', '')::uuid $$;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;

-- Production tables as before 20261111182306, reduced to the columns that matter for ownership.
CREATE TABLE public.app_users (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text UNIQUE, display_name text, is_owner boolean NOT NULL DEFAULT false,
  timezone text NOT NULL DEFAULT 'Europe/Kyiv', locale text NOT NULL DEFAULT 'uk', country_code text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
CREATE TABLE public.accounts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE, name text, parent_account_id uuid REFERENCES public.accounts(id));
CREATE TABLE public.journal_trades (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  account_id uuid REFERENCES public.accounts(id), symbol text, net_pnl numeric, result_r numeric, opened_at timestamptz DEFAULT now(), closed_at timestamptz, base_asset text, quote_asset text);
CREATE TABLE public.strategy_rules (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE, account_id uuid REFERENCES public.accounts(id), source_strategy_id uuid, definition jsonb);
CREATE TABLE public.strategy_checks (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE, trade_id uuid REFERENCES public.journal_trades(id), strategy_rule_id uuid REFERENCES public.strategy_rules(id));
CREATE TABLE public.journal_layout_preferences (user_id uuid PRIMARY KEY REFERENCES public.app_users(id) ON DELETE CASCADE, layout jsonb, revision int DEFAULT 1);
CREATE TABLE public.dashboard_layout_preferences (user_id uuid PRIMARY KEY REFERENCES public.app_users(id) ON DELETE CASCADE, layout jsonb, revision int DEFAULT 1);
CREATE TABLE public.mt5_import_runs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE, account_id uuid REFERENCES public.accounts(id));
CREATE TABLE public.mt5_deals_raw (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE, account_id uuid REFERENCES public.accounts(id));
CREATE TABLE public.broker_symbols (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE, account_id uuid REFERENCES public.accounts(id));
CREATE TABLE public.news_events (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text, impact text, currency text, event_time timestamptz DEFAULT now());
CREATE TABLE public.market_instruments (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), symbol text);
CREATE TABLE public.trade_news_links (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), trade_id uuid REFERENCES public.journal_trades(id), news_event_id uuid REFERENCES public.news_events(id), relation_type text);
CREATE TABLE public.bridge_devices (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE, name text, os text, public_key text, key_fingerprint text,
  key_storage text, last_seq bigint DEFAULT 0, bridge_version text, last_seen_at timestamptz, last_sync_at timestamptz, revoked_at timestamptz, created_at timestamptz DEFAULT now());
CREATE TABLE public.bridge_terminal_accounts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  device_id uuid REFERENCES public.bridge_devices(id), account_id uuid REFERENCES public.accounts(id), server text, login text, needs_review boolean DEFAULT true, ignored_at timestamptz);
CREATE TABLE public.bridge_deals (terminal_account_id uuid REFERENCES public.bridge_terminal_accounts(id), deal_ticket bigint, profit numeric, PRIMARY KEY (terminal_account_id, deal_ticket));
CREATE TABLE public.bridge_orders (terminal_account_id uuid REFERENCES public.bridge_terminal_accounts(id), order_ticket bigint, PRIMARY KEY (terminal_account_id, order_ticket));
CREATE TABLE public.bridge_positions (terminal_account_id uuid REFERENCES public.bridge_terminal_accounts(id), position_key text, trade_id uuid, PRIMARY KEY (terminal_account_id, position_key));
CREATE TABLE public.bridge_pairings (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_code_hash text, approved_by uuid REFERENCES public.app_users(id) ON DELETE CASCADE);
CREATE TABLE public.bridge_rate_limits (key text PRIMARY KEY, hits int);
DO $$ DECLARE t text; BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('GRANT ALL ON public.%I TO anon, authenticated, service_role', t);
  END LOOP;
END $$;
CREATE POLICY "dev read journal_trades" ON public.journal_trades FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY market_instruments_read_authenticated ON public.market_instruments FOR SELECT TO authenticated USING (true);
CREATE VIEW public.news_impact_stats WITH (security_invoker = true) AS
  SELECT t.user_id, t.account_id, count(DISTINCT t.id) AS trades FROM public.trade_news_links l JOIN public.journal_trades t ON t.id = l.trade_id GROUP BY 1, 2;
GRANT ALL ON public.news_impact_stats TO anon, authenticated, service_role;
CREATE FUNCTION public.vault_delete_entity(p_owner_id uuid, p_kind text, p_entity_id uuid) RETURNS jsonb LANGUAGE sql AS $$ SELECT '{}'::jsonb $$;

\ir ../supabase/migrations/20261111182306_user_auth.sql
\ir ../supabase/migrations/20261111190319_list_auth_sessions.sql
\ir ../supabase/migrations/20261112194420_user_preferences.sql
\ir ../supabase/migrations/20261112194829_rls_user_isolation.sql
\ir ../supabase/migrations/20261112204953_private_rls_helpers.sql
\ir ../supabase/migrations/20261113100000_audit_events.sql

-- Two users: A (owner, linked) and B (invited, linked).
INSERT INTO auth.users VALUES ('00000000-0000-4000-8000-0000000000aa', 'a@example.test'), ('00000000-0000-4000-8000-0000000000bb', 'b@example.test');
INSERT INTO public.app_users (id, email, is_owner, auth_user_id) VALUES
  ('00000000-0000-4000-8000-00000000000a', 'a@example.test', true, '00000000-0000-4000-8000-0000000000aa'),
  ('00000000-0000-4000-8000-00000000000b', 'b@example.test', false, '00000000-0000-4000-8000-0000000000bb');
INSERT INTO public.accounts (id, user_id, name) VALUES ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000000a', 'A prop'), ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-00000000000b', 'B account');
INSERT INTO public.journal_trades (id, user_id, account_id, symbol, net_pnl, closed_at) VALUES
  ('00000000-0000-4000-8000-0000000000a2', '00000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-0000000000a1', 'EURUSD', 10, now()),
  ('00000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-00000000000b', '00000000-0000-4000-8000-0000000000b1', 'XAUUSD', 5, now());
INSERT INTO public.strategy_rules (id, user_id, account_id) VALUES ('00000000-0000-4000-8000-0000000000a3', '00000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-0000000000a1');
INSERT INTO public.dashboard_layout_preferences (user_id, layout) VALUES ('00000000-0000-4000-8000-00000000000a', '{}');
INSERT INTO public.journal_layout_preferences (user_id, layout) VALUES ('00000000-0000-4000-8000-00000000000a', '{}');
INSERT INTO public.bridge_devices (id, user_id, name, public_key) VALUES ('00000000-0000-4000-8000-0000000000a4', '00000000-0000-4000-8000-00000000000a', 'A PC', 'secret-key');
INSERT INTO public.bridge_terminal_accounts (id, user_id, device_id, account_id, server, login) VALUES ('00000000-0000-4000-8000-0000000000a5', '00000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-0000000000a4', '00000000-0000-4000-8000-0000000000a1', 'srv', '1');
INSERT INTO public.bridge_deals VALUES ('00000000-0000-4000-8000-0000000000a5', 1, 5);
INSERT INTO public.news_events (id, title) VALUES ('00000000-0000-4000-8000-0000000000e1', 'NFP');
INSERT INTO public.market_instruments (symbol) VALUES ('EURUSD');
INSERT INTO public.trade_news_links (trade_id, news_event_id) VALUES ('00000000-0000-4000-8000-0000000000a2', '00000000-0000-4000-8000-0000000000e1');
INSERT INTO public.beta_invites (email) VALUES ('c@example.test');
INSERT INTO public.audit_events (user_id, action, method) VALUES ('00000000-0000-4000-8000-00000000000a', 'sign_in', 'password');

CREATE SCHEMA tst;
GRANT USAGE ON SCHEMA tst TO anon, authenticated, service_role;
CREATE FUNCTION tst.expect(p_ok boolean, p_what text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN IF p_ok IS NOT TRUE THEN RAISE EXCEPTION 'FAILED: %', p_what; END IF; END $$;
CREATE FUNCTION tst.denied(p_sql text, p_what text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN EXECUTE p_sql; EXCEPTION WHEN insufficient_privilege OR check_violation OR foreign_key_violation THEN RETURN; END;
  RAISE EXCEPTION 'FAILED (statement was allowed): %', p_what;
END $$;
CREATE FUNCTION tst.no_rows(p_sql text, p_what text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE n bigint; BEGIN EXECUTE p_sql; GET DIAGNOSTICS n = ROW_COUNT; IF n <> 0 THEN RAISE EXCEPTION 'FAILED (% rows): %', n, p_what; END IF; END $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA tst TO anon, authenticated, service_role;

-- anon: nothing at all, the old "dev read" policy is gone.
SET ROLE anon;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', false);
SELECT tst.denied('SELECT 1 FROM public.journal_trades', 'anon reads trades');
SELECT tst.denied('SELECT 1 FROM public.app_users', 'anon reads users');
SELECT tst.denied('SELECT 1 FROM public.news_events', 'anon reads news');
SELECT tst.denied('SELECT private.current_app_user_id()', 'anon calls current_app_user_id');
SELECT tst.denied($$SELECT public.vault_delete_entity('00000000-0000-4000-8000-00000000000a', 'account', '00000000-0000-4000-8000-0000000000a1')$$, 'anon runs the deletion RPC');
RESET ROLE;

-- User B against user A.
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-4000-8000-0000000000bb"}', false);
SELECT tst.expect((SELECT private.current_app_user_id() = '00000000-0000-4000-8000-00000000000b'), 'B resolves to own app user');
SELECT tst.expect((SELECT count(*) = 1 AND bool_and(id = '00000000-0000-4000-8000-00000000000b') FROM public.app_users), 'B sees only own profile');
SELECT tst.expect((SELECT count(*) = 1 AND bool_and(name = 'B account') FROM public.accounts), 'B sees only own accounts');
SELECT tst.expect((SELECT count(*) = 1 AND bool_and(symbol = 'XAUUSD') FROM public.journal_trades), 'B sees only own trades');
SELECT tst.expect((SELECT count(*) = 0 FROM public.strategy_rules), 'B sees no strategies of A');
SELECT tst.expect((SELECT count(*) = 0 FROM public.dashboard_layout_preferences) AND (SELECT count(*) = 0 FROM public.journal_layout_preferences), 'B sees no layouts of A');
SELECT tst.expect((SELECT count(*) = 0 FROM (SELECT id FROM public.bridge_devices) d) AND (SELECT count(*) = 0 FROM public.bridge_terminal_accounts) AND (SELECT count(*) = 0 FROM public.bridge_deals), 'B sees no Bridge data of A');
SELECT tst.expect((SELECT count(*) = 0 FROM public.trade_news_links) AND (SELECT count(*) = 0 FROM public.news_impact_stats), 'B sees no trade links or stats of A');
SELECT tst.expect((SELECT count(*) = 0 FROM public.news_events), 'calendar stays with the owner during the beta');
SELECT tst.expect((SELECT count(*) = 1 FROM public.market_instruments), 'instruments are shared');
SELECT tst.expect((SELECT count(*) = 0 FROM public.audit_events), 'B sees no security events of A');
SELECT tst.denied($$INSERT INTO public.audit_events (user_id, action) VALUES ('00000000-0000-4000-8000-00000000000b', 'sign_in')$$, 'B forges a security event');
SELECT tst.denied($$DELETE FROM public.audit_events$$, 'B erases security events');

SELECT tst.no_rows($$UPDATE public.accounts SET name = 'x' WHERE id = '00000000-0000-4000-8000-0000000000a1'$$, 'B renames A''s account');
SELECT tst.no_rows($$DELETE FROM public.accounts WHERE id = '00000000-0000-4000-8000-0000000000a1'$$, 'B deletes A''s account');
SELECT tst.no_rows($$UPDATE public.journal_trades SET net_pnl = 0 WHERE id = '00000000-0000-4000-8000-0000000000a2'$$, 'B edits A''s trade');
SELECT tst.no_rows($$DELETE FROM public.journal_trades WHERE id = '00000000-0000-4000-8000-0000000000a2'$$, 'B deletes A''s trade');
SELECT tst.no_rows($$DELETE FROM public.strategy_rules$$, 'B deletes A''s strategies');
SELECT tst.no_rows($$UPDATE public.dashboard_layout_preferences SET layout = '[]'$$, 'B edits A''s layout');
SELECT tst.no_rows($$UPDATE public.bridge_devices SET revoked_at = now()$$, 'B revokes A''s PC');
SELECT tst.no_rows($$UPDATE public.bridge_terminal_accounts SET needs_review = false$$, 'B answers for A''s MT5 account');
SELECT tst.no_rows($$UPDATE public.app_users SET display_name = 'x' WHERE id = '00000000-0000-4000-8000-00000000000a'$$, 'B renames A');
SELECT tst.no_rows($$DELETE FROM public.trade_news_links$$, 'B deletes A''s links');

SELECT tst.denied($$INSERT INTO public.accounts (user_id, name) VALUES ('00000000-0000-4000-8000-00000000000a', 'planted')$$, 'B inserts an account for A');
SELECT tst.denied($$INSERT INTO public.journal_trades (user_id, account_id) VALUES ('00000000-0000-4000-8000-00000000000b', '00000000-0000-4000-8000-0000000000a1')$$, 'B puts a trade into A''s account');
SELECT tst.denied($$UPDATE public.journal_trades SET account_id = '00000000-0000-4000-8000-0000000000a1' WHERE id = '00000000-0000-4000-8000-0000000000b2'$$, 'B moves own trade into A''s account');
SELECT tst.denied($$UPDATE public.journal_trades SET user_id = '00000000-0000-4000-8000-00000000000a' WHERE id = '00000000-0000-4000-8000-0000000000b2'$$, 'B gives own trade to A');
SELECT tst.denied($$UPDATE public.accounts SET parent_account_id = '00000000-0000-4000-8000-0000000000a1' WHERE id = '00000000-0000-4000-8000-0000000000b1'$$, 'B chains own account to A''s');
SELECT tst.denied($$INSERT INTO public.trade_news_links (trade_id, news_event_id) VALUES ('00000000-0000-4000-8000-0000000000a2', '00000000-0000-4000-8000-0000000000e1')$$, 'B links A''s trade');
SELECT tst.denied($$UPDATE public.app_users SET is_owner = true$$, 'B makes themselves owner');
SELECT tst.denied($$UPDATE public.app_users SET auth_user_id = '00000000-0000-4000-8000-0000000000aa'$$, 'B takes over A''s login');
SELECT tst.denied($$UPDATE public.app_users SET email = 'a@example.test'$$, 'B changes profile e-mail');
SELECT tst.denied($$INSERT INTO public.app_users (email) VALUES ('x@example.test')$$, 'B creates a profile');
SELECT tst.denied($$INSERT INTO public.bridge_devices (user_id, name) VALUES ('00000000-0000-4000-8000-00000000000b', 'self-made')$$, 'B creates a Bridge device directly');
SELECT tst.denied($$UPDATE public.bridge_devices SET public_key = 'x'$$, 'B rewrites a device key');
SELECT tst.denied('SELECT 1 FROM public.bridge_pairings', 'B reads pairings');
SELECT tst.denied('SELECT 1 FROM public.bridge_orders', 'B reads raw orders');
SELECT tst.denied('SELECT 1 FROM public.beta_invites', 'B reads the invite list');
SELECT tst.denied($$INSERT INTO public.market_instruments (symbol) VALUES ('X')$$, 'B writes shared instruments');
SELECT tst.denied($$SELECT public.vault_delete_entity('00000000-0000-4000-8000-00000000000a', 'account', '00000000-0000-4000-8000-0000000000a1')$$, 'B deletes A''s account through the RPC as A');
SELECT tst.expect((SELECT public.vault_delete_entity('00000000-0000-4000-8000-00000000000b', 'trade', '00000000-0000-4000-8000-0000000000a2') = '{"deleted": false}'::jsonb), 'the RPC as B does not find A''s trade');
SELECT tst.denied('SELECT public.list_auth_sessions(''00000000-0000-4000-8000-0000000000aa'')', 'B lists A''s sessions');

-- Own data keeps working: profile settings, a strategy, the deletion RPC.
UPDATE public.app_users SET display_name = 'B', timezone = 'Europe/London', preferences = '{"privacy": true}';
INSERT INTO public.strategy_rules (user_id, account_id) VALUES ('00000000-0000-4000-8000-00000000000b', '00000000-0000-4000-8000-0000000000b1');
SELECT tst.expect((SELECT (public.vault_delete_entity('00000000-0000-4000-8000-00000000000b', 'account', '00000000-0000-4000-8000-0000000000b1')->>'deleted')::boolean), 'B deletes own account through the RPC');
SELECT tst.expect((SELECT count(*) = 0 FROM public.accounts) AND (SELECT count(*) = 0 FROM public.journal_trades), 'B''s account and trades are gone');
RESET ROLE;

-- A (owner) still has everything and sees the calendar.
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-4000-8000-0000000000aa"}', false);
SELECT tst.expect((SELECT name = 'A prop' FROM public.accounts) AND (SELECT net_pnl = 10 FROM public.journal_trades), 'A''s account and trade are intact');
SELECT tst.expect((SELECT count(*) = 1 FROM public.strategy_rules) AND (SELECT count(*) = 1 FROM (SELECT id, name, last_seen_at FROM public.bridge_devices) d) AND (SELECT count(*) = 1 FROM public.bridge_deals) AND (SELECT trades = 1 FROM public.news_impact_stats), 'A sees own strategy, deals and stats');
SELECT tst.expect((SELECT count(*) = 1 FROM public.news_events), 'the owner sees the calendar');
SELECT tst.expect((SELECT count(*) = 1 FROM public.audit_events), 'A sees own security events');
SELECT tst.denied($$UPDATE public.audit_events SET action = 'sign_in'$$, 'A cannot rewrite own log');
SELECT tst.denied('SELECT public_key FROM public.bridge_devices', 'not even the owner reads device keys through the API');
SELECT tst.denied('SELECT last_seq FROM public.bridge_devices', 'nor the replay counter');
RESET ROLE;

-- A signed-in user without a workspace (unlinked auth user) sees nothing.
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-4000-8000-0000000000cc"}', false);
SELECT tst.expect((SELECT private.current_app_user_id() IS NULL) AND (SELECT count(*) = 0 FROM public.accounts) AND (SELECT count(*) = 0 FROM public.journal_trades) AND (SELECT count(*) = 0 FROM public.app_users), 'an unlinked login sees nothing');
SELECT tst.denied($$INSERT INTO public.accounts (user_id, name) VALUES (NULL, 'x')$$, 'an unlinked login cannot insert');
RESET ROLE;

-- The service role still does the server's work.
SET ROLE service_role;
SELECT tst.expect((SELECT count(*) = 2 FROM public.app_users) AND (SELECT count(*) = 1 FROM public.bridge_pairings) IS NOT NULL, 'service role reads everything');
RESET ROLE;

SELECT tst.expect(NOT EXISTS (SELECT 1 FROM pg_class c WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r' AND NOT c.relrowsecurity), 'every public table has RLS');
SELECT tst.expect(NOT EXISTS (SELECT 1 FROM information_schema.role_table_grants WHERE table_schema = 'public' AND grantee = 'anon'), 'anon has no table privileges');
SELECT tst.expect(NOT EXISTS (SELECT 1 FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND prosecdef AND has_function_privilege('authenticated', oid, 'execute') AND proname <> 'vault_delete_entity'), 'no SECURITY DEFINER function in the exposed schema is callable by signed-in users');
SELECT tst.expect(NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND qual = 'true' AND cmd IN ('SELECT', 'ALL') AND tablename NOT IN ('market_instruments')), 'no open "read everything" policy is left');
\echo rls user isolation: all checks passed
