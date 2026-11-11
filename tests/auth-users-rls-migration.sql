\set ON_ERROR_STOP on
-- CI-only: run in a disposable PostgreSQL database, never the application database.
-- Applies 20261110120000_auth_users_rls.sql on a minimal copy of the production schema and proves cross-user
-- isolation directly at the database (roles and JWT claims as PostgREST sets them).
DO $$ BEGIN
  IF current_database() <> 'auth_rls_ci' THEN
    RAISE EXCEPTION 'Refusing to run outside disposable auth_rls_ci database';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END $$;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- Minimal stand-in for Supabase Auth.
CREATE SCHEMA auth;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
CREATE TABLE auth.users (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text UNIQUE, email_confirmed_at timestamptz, raw_user_meta_data jsonb);
CREATE TABLE auth.sessions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(), refreshed_at timestamp, not_after timestamptz, user_agent text, ip inet);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claims', true)::jsonb->>'sub', '')::uuid $$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT current_setting('request.jwt.claims', true)::jsonb->>'role' $$;

-- Production tables before the migration, reduced to the columns that matter for ownership.
CREATE TABLE public.app_users (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text UNIQUE, username text UNIQUE, display_name text,
  is_owner boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  timezone text NOT NULL DEFAULT 'Europe/Kyiv', locale text NOT NULL DEFAULT 'uk' CHECK (locale IN ('uk','en')), country_code text);
CREATE TABLE public.accounts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  name text, parent_account_id uuid REFERENCES public.accounts(id));
CREATE TABLE public.journal_trades (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  account_id uuid REFERENCES public.accounts(id), symbol text, net_pnl numeric, result_r numeric, opened_at timestamptz DEFAULT now(), closed_at timestamptz, base_asset text, quote_asset text);
CREATE TABLE public.strategy_rules (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  account_id uuid REFERENCES public.accounts(id), source_strategy_id uuid, definition jsonb);
CREATE TABLE public.strategy_checks (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  trade_id uuid REFERENCES public.journal_trades(id), strategy_rule_id uuid REFERENCES public.strategy_rules(id));
CREATE TABLE public.journal_layout_preferences (user_id uuid PRIMARY KEY REFERENCES public.app_users(id) ON DELETE CASCADE, layout jsonb, revision int DEFAULT 1);
CREATE TABLE public.dashboard_layout_preferences (user_id uuid PRIMARY KEY REFERENCES public.app_users(id) ON DELETE CASCADE, layout jsonb, revision int DEFAULT 1);
CREATE TABLE public.mt5_import_runs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE, account_id uuid REFERENCES public.accounts(id));
CREATE TABLE public.mt5_deals_raw (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE, account_id uuid REFERENCES public.accounts(id));
CREATE TABLE public.broker_symbols (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE, account_id uuid REFERENCES public.accounts(id));
CREATE TABLE public.news_events (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text, impact text, currency text, event_time timestamptz DEFAULT now());
CREATE TABLE public.market_instruments (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), symbol text);
CREATE TABLE public.trade_news_links (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), trade_id uuid REFERENCES public.journal_trades(id), news_event_id uuid REFERENCES public.news_events(id), relation_type text);
CREATE TABLE public.bridge_devices (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  name text, public_key text, last_seq bigint DEFAULT 0, revoked_at timestamptz);
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
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    IF t NOT LIKE 'bridge_%' AND t NOT LIKE '%_layout_preferences' THEN EXECUTE format('GRANT ALL ON public.%I TO anon, authenticated', t); END IF;
  END LOOP;
END $$;
-- The two policies that exist in production today (the first one exposes every trade to the anon key).
CREATE POLICY "dev read journal_trades" ON public.journal_trades FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY market_instruments_read_authenticated ON public.market_instruments FOR SELECT TO authenticated USING (true);
CREATE VIEW public.news_impact_stats WITH (security_invoker = true) AS
  SELECT t.user_id, t.account_id, count(DISTINCT t.id) AS trades FROM public.trade_news_links l JOIN public.journal_trades t ON t.id = l.trade_id GROUP BY 1, 2;
GRANT ALL ON public.news_impact_stats TO anon, authenticated, service_role;
CREATE FUNCTION public.vault_delete_entity(p_owner_id uuid, p_kind text, p_entity_id uuid) RETURNS jsonb LANGUAGE sql AS $$ SELECT '{}'::jsonb $$;
CREATE FUNCTION public.import_news_events(p_rows jsonb) RETURNS integer LANGUAGE sql AS $$ SELECT 0 $$;
CREATE FUNCTION public.link_trades_to_news(p_window_minutes integer DEFAULT 60) RETURNS integer LANGUAGE sql AS $$ SELECT 0 $$;
CREATE FUNCTION public.bridge_rate_limit_hit(p_key text, p_window_seconds integer, p_max integer) RETURNS boolean LANGUAGE sql AS $$ SELECT true $$;
CREATE FUNCTION public.bridge_rate_limit_reset(p_key text) RETURNS void LANGUAGE sql AS $$ SELECT $$;

-- The legacy single owner with data, exactly as before multi-user auth.
INSERT INTO public.app_users (id, email, display_name, is_owner) VALUES ('00000000-0000-4000-8000-00000000000a', 'Owner@Example.com', 'Owner', true);
INSERT INTO public.accounts (id, user_id, name) VALUES ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000000a', 'Owner prop');
INSERT INTO public.journal_trades (id, user_id, account_id, symbol, net_pnl) VALUES ('00000000-0000-4000-8000-0000000000a2', '00000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-0000000000a1', 'EURUSD', 10);
INSERT INTO public.strategy_rules (id, user_id, account_id) VALUES ('00000000-0000-4000-8000-0000000000a3', '00000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-0000000000a1');
INSERT INTO public.dashboard_layout_preferences (user_id, layout) VALUES ('00000000-0000-4000-8000-00000000000a', '{}');
INSERT INTO public.journal_layout_preferences (user_id, layout) VALUES ('00000000-0000-4000-8000-00000000000a', '{}');
INSERT INTO public.bridge_devices (id, user_id, name) VALUES ('00000000-0000-4000-8000-0000000000a4', '00000000-0000-4000-8000-00000000000a', 'Owner PC');
INSERT INTO public.bridge_terminal_accounts (id, user_id, device_id, account_id, server, login) VALUES ('00000000-0000-4000-8000-0000000000a5', '00000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-0000000000a4', '00000000-0000-4000-8000-0000000000a1', 'srv', '1');
INSERT INTO public.bridge_deals VALUES ('00000000-0000-4000-8000-0000000000a5', 1, 5);
INSERT INTO public.bridge_pairings (approved_by) VALUES ('00000000-0000-4000-8000-00000000000a');
INSERT INTO public.news_events (id, title) VALUES ('00000000-0000-4000-8000-0000000000e1', 'NFP');
INSERT INTO public.market_instruments (symbol) VALUES ('EURUSD');
INSERT INTO public.trade_news_links (trade_id, news_event_id) VALUES ('00000000-0000-4000-8000-0000000000a2', '00000000-0000-4000-8000-0000000000e1');

\ir ../supabase/migrations/20261110120000_auth_users_rls.sql

CREATE SCHEMA tst;
CREATE FUNCTION tst.expect(p_ok boolean, p_what text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN IF p_ok IS NOT TRUE THEN RAISE EXCEPTION 'FAILED: %', p_what; END IF; END $$;
-- Runs a statement that must be refused (privilege, RLS or check); anything else fails the test.
CREATE FUNCTION tst.denied(p_sql text, p_what text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN EXECUTE p_sql; EXCEPTION WHEN insufficient_privilege OR check_violation OR foreign_key_violation THEN RETURN; END;
  RAISE EXCEPTION 'FAILED (statement was allowed): %', p_what;
END $$;
-- Runs a statement that is allowed to run but must touch no rows.
CREATE FUNCTION tst.no_rows(p_sql text, p_what text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE n bigint; BEGIN EXECUTE p_sql; GET DIAGNOSTICS n = ROW_COUNT; IF n <> 0 THEN RAISE EXCEPTION 'FAILED (% rows): %', n, p_what; END IF; END $$;
GRANT USAGE ON SCHEMA tst TO authenticated, anon, service_role;

-- 1. Sign-ups: an unconfirmed address never claims the legacy workspace; the confirmed one does, with all data.
INSERT INTO auth.users (id, email) VALUES ('00000000-0000-4000-8000-00000000000c', 'owner@example.com');
SELECT tst.expect((SELECT count(*) = 1 AND bool_and(id = '00000000-0000-4000-8000-00000000000a') FROM public.app_users), 'unconfirmed sign-up must not claim or create a profile');
DELETE FROM auth.users WHERE id = '00000000-0000-4000-8000-00000000000c';
INSERT INTO auth.users (id, email, email_confirmed_at, raw_user_meta_data)
  VALUES ('00000000-0000-4000-8000-0000000000aa', 'owner@example.com', now(), '{"avatar_url":"https://lh3.example/a.png","full_name":"Google Name"}');
SELECT tst.expect((SELECT count(*) = 1 AND bool_and(id = '00000000-0000-4000-8000-0000000000aa' AND is_owner AND display_name = 'Owner' AND avatar_url = 'https://lh3.example/a.png') FROM public.app_users), 'confirmed owner email re-keys the legacy row and keeps its name');
SELECT tst.expect((SELECT count(*) = 1 FROM public.accounts WHERE user_id = '00000000-0000-4000-8000-0000000000aa'), 'accounts follow the owner');
SELECT tst.expect((SELECT count(*) = 1 FROM public.journal_trades WHERE user_id = '00000000-0000-4000-8000-0000000000aa'), 'trades follow the owner');
SELECT tst.expect((SELECT count(*) = 1 FROM public.strategy_rules WHERE user_id = '00000000-0000-4000-8000-0000000000aa'), 'strategies follow the owner');
SELECT tst.expect((SELECT count(*) = 1 FROM public.dashboard_layout_preferences WHERE user_id = '00000000-0000-4000-8000-0000000000aa'), 'dashboard layout follows the owner');
SELECT tst.expect((SELECT count(*) = 1 FROM public.journal_layout_preferences WHERE user_id = '00000000-0000-4000-8000-0000000000aa'), 'journal layout follows the owner');
SELECT tst.expect((SELECT count(*) = 1 FROM public.bridge_devices WHERE user_id = '00000000-0000-4000-8000-0000000000aa'), 'bridge devices follow the owner');
SELECT tst.expect((SELECT count(*) = 1 FROM public.bridge_terminal_accounts WHERE user_id = '00000000-0000-4000-8000-0000000000aa'), 'bridge accounts follow the owner');
SELECT tst.expect((SELECT count(*) = 1 FROM public.bridge_pairings WHERE approved_by = '00000000-0000-4000-8000-0000000000aa'), 'pairings follow the owner');
ALTER TABLE public.app_users VALIDATE CONSTRAINT app_users_id_auth_fkey;

-- User B: a fresh sign-up with hostile metadata (bad zone, non-https avatar).
INSERT INTO auth.users (id, email, email_confirmed_at, raw_user_meta_data)
  VALUES ('00000000-0000-4000-8000-0000000000bb', 'b@example.com', now(), '{"timezone":"Not/AZone","locale":"xx","avatar_url":"javascript:alert(1)","name":"B"}');
SELECT tst.expect((SELECT timezone = 'Europe/Kyiv' AND locale = 'en' AND avatar_url IS NULL AND display_name = 'B' AND NOT is_owner AND plan = 'free' FROM public.app_users WHERE id = '00000000-0000-4000-8000-0000000000bb'), 'new profile with sanitised metadata');
INSERT INTO public.accounts (id, user_id, name) VALUES ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000bb', 'B account');
INSERT INTO public.journal_trades (id, user_id, account_id, symbol) VALUES ('00000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-0000000000bb', '00000000-0000-4000-8000-0000000000b1', 'XAUUSD');
INSERT INTO auth.sessions (user_id, user_agent, ip) VALUES ('00000000-0000-4000-8000-0000000000aa', 'A browser', '10.0.0.1'), ('00000000-0000-4000-8000-0000000000bb', 'B browser', '10.0.0.2');

-- 2. anon: nothing at all.
SET ROLE anon;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', false);
SELECT tst.denied('SELECT 1 FROM public.journal_trades', 'anon reads trades');
SELECT tst.denied('SELECT 1 FROM public.accounts', 'anon reads accounts');
SELECT tst.denied('SELECT 1 FROM public.app_users', 'anon reads users');
SELECT tst.denied('SELECT 1 FROM public.news_events', 'anon reads news');
SELECT tst.denied('SELECT 1 FROM public.news_impact_stats', 'anon reads the stats view');
SELECT tst.denied('SELECT public.link_trades_to_news(60)', 'anon runs link_trades_to_news');
SELECT tst.denied($$SELECT public.vault_delete_entity('00000000-0000-4000-8000-0000000000aa', 'account', '00000000-0000-4000-8000-0000000000a1')$$, 'anon runs vault_delete_entity');
SELECT tst.denied('SELECT * FROM public.list_my_sessions()', 'anon lists sessions');
RESET ROLE;

-- 3. User B against user A's data.
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-4000-8000-0000000000bb"}', false);
SELECT tst.expect((SELECT count(*) = 1 AND bool_and(id = '00000000-0000-4000-8000-0000000000bb') FROM public.app_users), 'B sees only own profile');
SELECT tst.expect((SELECT count(*) = 1 AND bool_and(user_id = '00000000-0000-4000-8000-0000000000bb') FROM public.accounts), 'B sees only own accounts');
SELECT tst.expect((SELECT count(*) = 1 AND bool_and(user_id = '00000000-0000-4000-8000-0000000000bb') FROM public.journal_trades), 'B sees only own trades');
SELECT tst.expect((SELECT count(*) = 0 FROM public.strategy_rules), 'B sees no strategies of A');
SELECT tst.expect((SELECT count(*) = 0 FROM public.dashboard_layout_preferences), 'B sees no dashboard layout of A');
SELECT tst.expect((SELECT count(*) = 0 FROM public.journal_layout_preferences), 'B sees no journal layout of A');
SELECT tst.expect((SELECT count(*) = 0 FROM public.bridge_devices), 'B sees no bridge devices of A');
SELECT tst.expect((SELECT count(*) = 0 FROM public.bridge_terminal_accounts), 'B sees no MT5 accounts of A');
SELECT tst.expect((SELECT count(*) = 0 FROM public.bridge_deals), 'B sees no raw deals of A');
SELECT tst.expect((SELECT count(*) = 0 FROM public.trade_news_links), 'B sees no trade links of A');
SELECT tst.expect((SELECT count(*) = 0 FROM public.news_impact_stats), 'the stats view shows nothing of A');
SELECT tst.expect((SELECT count(*) = 1 FROM public.news_events) AND (SELECT count(*) = 1 FROM public.market_instruments), 'shared tables are readable');
SELECT tst.expect((SELECT count(*) = 1 AND bool_and(user_agent = 'B browser') FROM public.list_my_sessions()), 'B lists only own sessions');

SELECT tst.no_rows($$UPDATE public.accounts SET name = 'hacked' WHERE id = '00000000-0000-4000-8000-0000000000a1'$$, 'B renames A''s account');
SELECT tst.no_rows($$DELETE FROM public.accounts WHERE id = '00000000-0000-4000-8000-0000000000a1'$$, 'B deletes A''s account');
SELECT tst.no_rows($$UPDATE public.journal_trades SET net_pnl = 0 WHERE id = '00000000-0000-4000-8000-0000000000a2'$$, 'B edits A''s trade');
SELECT tst.no_rows($$DELETE FROM public.journal_trades WHERE id = '00000000-0000-4000-8000-0000000000a2'$$, 'B deletes A''s trade');
SELECT tst.no_rows($$UPDATE public.strategy_rules SET definition = '{}' WHERE id = '00000000-0000-4000-8000-0000000000a3'$$, 'B edits A''s strategy');
SELECT tst.no_rows($$DELETE FROM public.strategy_rules$$, 'B deletes A''s strategies');
SELECT tst.no_rows($$UPDATE public.dashboard_layout_preferences SET layout = '[]'$$, 'B edits A''s dashboard layout');
SELECT tst.no_rows($$DELETE FROM public.journal_layout_preferences$$, 'B deletes A''s journal layout');
SELECT tst.no_rows($$UPDATE public.bridge_devices SET revoked_at = now()$$, 'B revokes A''s PC');
SELECT tst.no_rows($$UPDATE public.bridge_terminal_accounts SET needs_review = false$$, 'B answers for A''s MT5 account');
SELECT tst.no_rows($$DELETE FROM public.trade_news_links$$, 'B deletes A''s trade links');
SELECT tst.no_rows($$UPDATE public.app_users SET display_name = 'x' WHERE id = '00000000-0000-4000-8000-0000000000aa'$$, 'B renames A');

SELECT tst.denied($$INSERT INTO public.accounts (user_id, name) VALUES ('00000000-0000-4000-8000-0000000000aa', 'planted')$$, 'B inserts an account for A');
SELECT tst.denied($$INSERT INTO public.journal_trades (user_id, account_id) VALUES ('00000000-0000-4000-8000-0000000000aa', '00000000-0000-4000-8000-0000000000a1')$$, 'B inserts a trade for A');
SELECT tst.denied($$INSERT INTO public.journal_trades (user_id, account_id) VALUES ('00000000-0000-4000-8000-0000000000bb', '00000000-0000-4000-8000-0000000000a1')$$, 'B inserts own trade into A''s account');
SELECT tst.denied($$UPDATE public.journal_trades SET account_id = '00000000-0000-4000-8000-0000000000a1' WHERE id = '00000000-0000-4000-8000-0000000000b2'$$, 'B moves own trade into A''s account');
SELECT tst.denied($$UPDATE public.journal_trades SET user_id = '00000000-0000-4000-8000-0000000000aa' WHERE id = '00000000-0000-4000-8000-0000000000b2'$$, 'B gives own trade to A');
SELECT tst.denied($$UPDATE public.accounts SET parent_account_id = '00000000-0000-4000-8000-0000000000a1' WHERE id = '00000000-0000-4000-8000-0000000000b1'$$, 'B chains own account to A''s');
SELECT tst.denied($$INSERT INTO public.strategy_rules (user_id, account_id) VALUES ('00000000-0000-4000-8000-0000000000bb', '00000000-0000-4000-8000-0000000000a1')$$, 'B adds a strategy to A''s account');
SELECT tst.denied($$INSERT INTO public.trade_news_links (trade_id, news_event_id) VALUES ('00000000-0000-4000-8000-0000000000a2', '00000000-0000-4000-8000-0000000000e1')$$, 'B links A''s trade');
SELECT tst.denied($$INSERT INTO public.bridge_devices (user_id, name) VALUES ('00000000-0000-4000-8000-0000000000bb', 'self-made')$$, 'B creates a bridge device directly');
SELECT tst.denied($$UPDATE public.bridge_devices SET public_key = 'x'$$, 'B rewrites a device key');
SELECT tst.denied($$SELECT 1 FROM public.bridge_pairings$$, 'B reads pairings');
SELECT tst.denied($$SELECT 1 FROM public.bridge_orders$$, 'B reads raw orders');
SELECT tst.denied($$INSERT INTO public.news_events (title) VALUES ('fake')$$, 'B writes shared news');
SELECT tst.denied($$UPDATE public.market_instruments SET symbol = 'x'$$, 'B writes shared instruments');
SELECT tst.denied($$UPDATE public.app_users SET is_owner = true$$, 'B makes themselves owner');
SELECT tst.denied($$UPDATE public.app_users SET plan = 'pro'$$, 'B upgrades own plan');
SELECT tst.denied($$UPDATE public.app_users SET email = 'owner@example.com'$$, 'B changes profile email');
SELECT tst.denied($$INSERT INTO public.app_users (id) VALUES (gen_random_uuid())$$, 'B inserts a profile');
SELECT tst.denied($$SELECT public.vault_delete_entity('00000000-0000-4000-8000-0000000000aa', 'account', '00000000-0000-4000-8000-0000000000a1')$$, 'B deletes A''s account through the RPC as A');
SELECT tst.expect((SELECT public.vault_delete_entity('00000000-0000-4000-8000-0000000000bb', 'account', '00000000-0000-4000-8000-0000000000a1') = '{"deleted": false}'::jsonb), 'the RPC as B does not find A''s account');
SELECT tst.expect((SELECT public.vault_delete_entity('00000000-0000-4000-8000-0000000000bb', 'trade', '00000000-0000-4000-8000-0000000000a2') = '{"deleted": false}'::jsonb), 'the RPC as B does not find A''s trade');
SELECT tst.denied('SELECT public.import_news_events(''[]'')', 'B runs the news import');
SELECT tst.denied('SELECT public.link_trades_to_news(60)', 'B runs link_trades_to_news');
SELECT tst.denied('SELECT public.bridge_rate_limit_reset(''x'')', 'B resets rate limits');

-- Own data keeps working, including the deletion RPC under row-level security.
UPDATE public.app_users SET display_name = 'B renamed', timezone = 'Europe/London';
INSERT INTO public.strategy_rules (user_id, account_id) VALUES ('00000000-0000-4000-8000-0000000000bb', '00000000-0000-4000-8000-0000000000b1');
INSERT INTO public.dashboard_layout_preferences (user_id, layout) VALUES ('00000000-0000-4000-8000-0000000000bb', '{}');
SELECT tst.expect((SELECT (public.vault_delete_entity('00000000-0000-4000-8000-0000000000bb', 'account', '00000000-0000-4000-8000-0000000000b1')->>'deleted')::boolean), 'B deletes own account through the RPC');
SELECT tst.expect((SELECT count(*) = 0 FROM public.accounts) AND (SELECT count(*) = 0 FROM public.journal_trades), 'B''s account and trades are gone');
RESET ROLE;

-- 4. A still has everything; A's session sees it.
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-4000-8000-0000000000aa"}', false);
SELECT tst.expect((SELECT name = 'Owner prop' FROM public.accounts), 'A''s account is intact');
SELECT tst.expect((SELECT net_pnl = 10 FROM public.journal_trades), 'A''s trade is intact');
SELECT tst.expect((SELECT count(*) = 1 FROM public.strategy_rules) AND (SELECT count(*) = 1 FROM public.bridge_devices WHERE revoked_at IS NULL) AND (SELECT count(*) = 1 FROM public.bridge_deals) AND (SELECT count(*) = 1 FROM public.trade_news_links) AND (SELECT trades = 1 FROM public.news_impact_stats), 'A sees own strategies, PCs, deals and links');
UPDATE public.bridge_devices SET revoked_at = now();
RESET ROLE;
SELECT set_config('request.jwt.claims', '', false);

-- 5. The service role still does the server's work; deleting an auth user removes that user's data only.
SET ROLE service_role;
SELECT tst.expect((SELECT count(*) = 2 FROM public.app_users), 'service role reads all profiles');
SELECT public.import_news_events('[]'::jsonb);
SELECT public.bridge_rate_limit_hit('k', 60, 5);
RESET ROLE;
DELETE FROM auth.users WHERE id = '00000000-0000-4000-8000-0000000000bb';
SELECT tst.expect((SELECT count(*) = 1 AND bool_and(id = '00000000-0000-4000-8000-0000000000aa') FROM public.app_users), 'deleting B leaves only A');
SELECT tst.expect((SELECT count(*) = 1 FROM public.accounts) AND (SELECT count(*) = 1 FROM public.journal_trades), 'A''s data survives B''s deletion');

-- 6. No public table is left without row-level security or reachable by anon.
SELECT tst.expect(NOT EXISTS (SELECT 1 FROM pg_class c WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r' AND NOT c.relrowsecurity), 'every public table has RLS');
SELECT tst.expect(NOT EXISTS (SELECT 1 FROM information_schema.role_table_grants WHERE table_schema = 'public' AND grantee = 'anon'), 'anon has no table privileges');
SELECT tst.expect(NOT EXISTS (SELECT 1 FROM information_schema.role_routine_grants WHERE routine_schema = 'public' AND grantee IN ('anon', 'PUBLIC')), 'anon and PUBLIC have no function privileges');
\echo auth-users RLS migration: all checks passed
