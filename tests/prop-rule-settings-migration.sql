\set ON_ERROR_STOP on
-- CI-only: run in a disposable PostgreSQL 17 database, never the application database.
DO $$ BEGIN
  IF current_database() <> 'prop_rules_ci' THEN
    RAISE EXCEPTION 'Refusing to run outside disposable prop_rules_ci database';
  END IF;
END $$;
BEGIN;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE TABLE public.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  account_type text NOT NULL DEFAULT 'personal',
  initial_balance numeric,
  phase text,
  target_percent numeric,
  max_loss_percent numeric,
  daily_loss_percent numeric,
  min_trading_days integer,
  broker_timezone text NOT NULL DEFAULT 'Etc/UTC'
);
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
INSERT INTO public.accounts (name, account_type, initial_balance, phase, target_percent, max_loss_percent, daily_loss_percent, min_trading_days)
VALUES ('legacy_personal','personal',1000,NULL,NULL,NULL,NULL,NULL),
       ('legacy_prop','prop',10000,'phase-2',8,10,5,4);
CREATE TEMP TABLE original_accounts AS SELECT * FROM public.accounts;

\ir ../supabase/migrations/20261030200500_prop_rule_settings_v1.sql

DO $$
DECLARE additions text[] := ARRAY['prop_target_state','prop_max_loss_state','prop_daily_loss_state','prop_min_days_state','prop_max_loss_mode','prop_day_timezone','prop_day_close','prop_loss_control_basis','prop_rules_notes','prop_rules_revision'];
BEGIN
  IF (SELECT count(*) FROM public.accounts) <> 2 THEN RAISE EXCEPTION 'Migration changed row count'; END IF;
  IF EXISTS (SELECT 1 FROM public.accounts a JOIN original_accounts b USING (id) WHERE (to_jsonb(a) - additions) IS DISTINCT FROM to_jsonb(b)) THEN RAISE EXCEPTION 'Migration rewrote legacy data'; END IF;
  IF EXISTS (SELECT 1 FROM public.accounts WHERE prop_rules_revision <> 0 OR prop_target_state IS NOT NULL OR prop_max_loss_state IS NOT NULL OR prop_daily_loss_state IS NOT NULL OR prop_min_days_state IS NOT NULL OR prop_max_loss_mode IS NOT NULL OR prop_day_timezone IS NOT NULL OR prop_day_close IS NOT NULL OR prop_loss_control_basis IS NOT NULL OR prop_rules_notes IS NOT NULL) THEN RAISE EXCEPTION 'Migration guessed legacy rule settings'; END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.accounts'::regclass) THEN RAISE EXCEPTION 'Migration disabled RLS'; END IF;
END $$;

CREATE FUNCTION pg_temp.expect_check_failure(statement text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE rejected boolean := false;
BEGIN
  BEGIN EXECUTE statement;
  EXCEPTION WHEN check_violation THEN rejected := true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'Expected check violation: %', statement; END IF;
END $$;
SELECT pg_temp.expect_check_failure($test$UPDATE public.accounts SET prop_target_state='configured', target_percent=NULL WHERE account_type='prop'$test$);
SELECT pg_temp.expect_check_failure($test$UPDATE public.accounts SET prop_target_state='invalid' WHERE account_type='prop'$test$);
SELECT pg_temp.expect_check_failure($test$UPDATE public.accounts SET prop_max_loss_mode='intraday' WHERE account_type='prop'$test$);
SELECT pg_temp.expect_check_failure($test$UPDATE public.accounts SET prop_day_close='24:00' WHERE account_type='prop'$test$);
SELECT pg_temp.expect_check_failure($test$UPDATE public.accounts SET prop_day_close='12:30:15' WHERE account_type='prop'$test$);
SELECT pg_temp.expect_check_failure($test$UPDATE public.accounts SET prop_loss_control_basis='guess' WHERE account_type='prop'$test$);
SELECT pg_temp.expect_check_failure($test$UPDATE public.accounts SET prop_day_timezone='' WHERE account_type='prop'$test$);
SELECT pg_temp.expect_check_failure($test$UPDATE public.accounts SET prop_rules_notes=repeat('x',2001) WHERE account_type='prop'$test$);
SELECT pg_temp.expect_check_failure($test$UPDATE public.accounts SET prop_daily_loss_state='configured',daily_loss_percent='NaN'::numeric WHERE account_type='prop'$test$);

DO $$
DECLARE key uuid; expected integer; affected integer; rejected boolean := false;
BEGIN
  SELECT id INTO STRICT key FROM public.accounts WHERE account_type='prop';
  UPDATE public.accounts SET name='Renamed' WHERE id=key;
  IF (SELECT prop_rules_revision FROM public.accounts WHERE id=key) <> 0 THEN RAISE EXCEPTION 'Metadata edit changed rule revision'; END IF;
  UPDATE public.accounts SET prop_target_state='configured' WHERE id=key;
  IF (SELECT prop_rules_revision FROM public.accounts WHERE id=key) <> 1 THEN RAISE EXCEPTION 'Rule activation did not increment revision'; END IF;
  UPDATE public.accounts SET prop_target_state='not_applicable' WHERE id=key;
  IF (SELECT target_percent FROM public.accounts WHERE id=key) <> 8 THEN RAISE EXCEPTION 'Inactive condition lost its value'; END IF;
  UPDATE public.accounts SET prop_target_state='configured' WHERE id=key;
  IF (SELECT prop_rules_revision FROM public.accounts WHERE id=key) <> 3 THEN RAISE EXCEPTION 'Revision is not monotonic'; END IF;
  BEGIN
    UPDATE public.accounts SET prop_rules_revision=99 WHERE id=key;
  EXCEPTION WHEN raise_exception THEN rejected := true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'Client overwrote managed revision'; END IF;
  SELECT prop_rules_revision INTO expected FROM public.accounts WHERE id=key;
  UPDATE public.accounts SET prop_daily_loss_state='configured', daily_loss_percent=3 WHERE id=key AND prop_rules_revision=expected;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 1 THEN RAISE EXCEPTION 'Current-revision update failed'; END IF;
  UPDATE public.accounts SET max_loss_percent=9 WHERE id=key AND prop_rules_revision=expected;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'Stale revision overwrote newer rules'; END IF;
  IF (SELECT max_loss_percent FROM public.accounts WHERE id=key) <> 10 THEN RAISE EXCEPTION 'Sparse edit changed an omitted condition'; END IF;
  IF (SELECT prop_rules_revision FROM public.accounts WHERE id=key) <> expected + 1 THEN RAISE EXCEPTION 'Conditional edit revision is incorrect'; END IF;
  UPDATE public.accounts SET prop_min_days_state='configured', min_trading_days=0, prop_max_loss_mode='eod_trailing_percent', prop_day_timezone='Europe/Kyiv', prop_day_close='23:00', prop_loss_control_basis='equity' WHERE id=key;
  IF (SELECT min_trading_days FROM public.accounts WHERE id=key) <> 0 THEN RAISE EXCEPTION 'Explicit zero minimum was lost'; END IF;
  IF (SELECT prop_rules_revision FROM public.accounts WHERE account_type='personal') <> 0 THEN RAISE EXCEPTION 'Neighbor account was modified'; END IF;
END $$;
SELECT 'Prop-rule migration constraints and revision tests passed in disposable PostgreSQL' AS result;
ROLLBACK;
