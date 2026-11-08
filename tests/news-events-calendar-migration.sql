\set ON_ERROR_STOP on
-- CI-only: run in a disposable PostgreSQL 17 database, never the application database.
DO $$ BEGIN
  IF current_database() <> 'news_calendar_ci' THEN
    RAISE EXCEPTION 'Refusing to run outside disposable news_calendar_ci database';
  END IF;
END $$;
BEGIN;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END $$;

-- news_events as it exists in production on 2026-11-08 (before this migration).
CREATE TABLE public.news_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country text,
  title text NOT NULL,
  impact text,
  event_time timestamptz NOT NULL,
  source text NOT NULL DEFAULT 'manual',
  external_id text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  currency text,
  actual text,
  forecast text,
  previous text,
  unit text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT news_events_source_external_key UNIQUE (source, external_id)
);
CREATE INDEX news_events_event_time_idx ON public.news_events (event_time DESC);
CREATE INDEX news_events_currency_time_idx ON public.news_events (currency, event_time);
ALTER TABLE public.news_events ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.news_events TO anon, authenticated, service_role;
INSERT INTO public.news_events (country, title, impact, event_time, source, external_id, currency, forecast, previous, payload)
VALUES ('NZD', 'Trade Balance', 'low', '2026-10-18T21:45:00Z', 'faireconomy', 'NZD|Trade Balance|2026-10-18T21:45:00.000Z', 'NZD', '-775M', '-1349M', '{"title":"Trade Balance"}'),
       ('ALL', 'IMF Meetings', 'low', '2026-10-18T14:15:00Z', 'faireconomy', 'ALL|IMF Meetings|2026-10-18T14:15:00.000Z', 'ALL', NULL, NULL, '{}');
CREATE TEMP TABLE original_events AS SELECT * FROM public.news_events;

\ir ../supabase/migrations/20261108180000_news_events_calendar_fields.sql

DO $$
DECLARE
  additions text[] := ARRAY['event_code','source_series_id','event_type','sector','frequency','all_day','tentative','period','revision','actual_value','forecast_value','previous_value','revised_previous_value','multiplier','digits','forecast_suspect','license_scope'];
  batch jsonb := '[
    {"source":"mt5","external_id":"1","title":"Nonfarm Payrolls","country":"US","currency":"USD","impact":"high","event_time":"2024-01-05T13:30:00Z","actual":"216K","forecast":"170K","previous":"173K","unit":"job","event_code":"nonfarm-payrolls","source_series_id":"840030016","event_type":"indicator","sector":"jobs","frequency":"month","all_day":false,"tentative":false,"period":"2023-12-01","revision":0,"actual_value":216,"forecast_value":170,"previous_value":173,"revised_previous_value":null,"multiplier":"thousands","digits":0,"forecast_suspect":false,"license_scope":"private"},
    {"source":"mt5","external_id":"2","title":"New Year''s Day","country":"JP","currency":"JPY","impact":"holiday","event_time":"2024-01-01T00:00:00Z","event_type":"holiday","all_day":true,"multiplier":"none","digits":0},
    {"source":"mt5","external_id":"2","title":"New Year''s Day","country":"JP","currency":"JPY","impact":"holiday","event_time":"2024-01-01T00:00:00Z","event_type":"holiday","all_day":true,"multiplier":"none","digits":0}
  ]';
  r record;
BEGIN
  -- legacy rows untouched, defaults applied, RLS still on
  IF EXISTS (SELECT 1 FROM public.news_events a JOIN original_events b USING (id) WHERE (to_jsonb(a) - additions) IS DISTINCT FROM to_jsonb(b)) THEN RAISE EXCEPTION 'Migration rewrote legacy rows'; END IF;
  IF EXISTS (SELECT 1 FROM public.news_events WHERE license_scope <> 'private' OR all_day OR tentative OR forecast_suspect) THEN RAISE EXCEPTION 'Wrong defaults on legacy rows'; END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.news_events'::regclass) THEN RAISE EXCEPTION 'Migration disabled RLS'; END IF;

  -- first import: duplicate keys inside a batch collapse to one row
  SELECT * INTO r FROM public.import_news_events(batch);
  IF (r.inserted, r.updated, r.unchanged) IS DISTINCT FROM (2, 0, 0) THEN RAISE EXCEPTION 'First import: %', r; END IF;
  IF (SELECT actual_value FROM public.news_events WHERE source='mt5' AND external_id='1') <> 216 THEN RAISE EXCEPTION 'Numeric value lost'; END IF;
  IF NOT (SELECT all_day FROM public.news_events WHERE source='mt5' AND external_id='2') THEN RAISE EXCEPTION 'all_day lost'; END IF;

  -- same batch again: nothing written
  UPDATE public.news_events SET updated_at = '2000-01-01' WHERE source = 'mt5';
  SELECT * INTO r FROM public.import_news_events(batch);
  IF (r.inserted, r.updated, r.unchanged) IS DISTINCT FROM (0, 0, 2) THEN RAISE EXCEPTION 'Re-import not idempotent: %', r; END IF;
  IF EXISTS (SELECT 1 FROM public.news_events WHERE source='mt5' AND updated_at <> '2000-01-01') THEN RAISE EXCEPTION 'Unchanged rows were touched'; END IF;

  -- a revised previous value updates exactly one row and bumps updated_at
  SELECT * INTO r FROM public.import_news_events(jsonb_set(batch, '{0,revised_previous_value}', '150'));
  IF (r.inserted, r.updated, r.unchanged) IS DISTINCT FROM (0, 1, 1) THEN RAISE EXCEPTION 'Change not detected: %', r; END IF;
  IF (SELECT updated_at FROM public.news_events WHERE source='mt5' AND external_id='1') = '2000-01-01' THEN RAISE EXCEPTION 'updated_at not bumped'; END IF;

  -- rows without a key are skipped, legacy source untouched
  SELECT * INTO r FROM public.import_news_events('[{"source":"mt5","title":"x","event_time":"2024-01-01T00:00:00Z"}]');
  IF (r.inserted, r.updated, r.unchanged) IS DISTINCT FROM (0, 0, 0) THEN RAISE EXCEPTION 'Keyless row imported: %', r; END IF;
  IF (SELECT count(*) FROM public.news_events WHERE source = 'faireconomy') <> 2 THEN RAISE EXCEPTION 'Legacy rows changed'; END IF;

  -- constraints
  BEGIN
    INSERT INTO public.news_events (title, event_time, impact) VALUES ('bad', now(), 'HIGH');
    RAISE EXCEPTION 'impact check missing';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    INSERT INTO public.news_events (title, event_time, license_scope) VALUES ('bad', now(), 'public');
    RAISE EXCEPTION 'license_scope check missing';
  EXCEPTION WHEN check_violation THEN NULL; END;

  -- only service_role may run the import
  IF has_function_privilege('anon', 'public.import_news_events(jsonb)', 'execute') THEN RAISE EXCEPTION 'anon can import'; END IF;
  IF has_function_privilege('authenticated', 'public.import_news_events(jsonb)', 'execute') THEN RAISE EXCEPTION 'authenticated can import'; END IF;
  IF NOT has_function_privilege('service_role', 'public.import_news_events(jsonb)', 'execute') THEN RAISE EXCEPTION 'service_role cannot import'; END IF;
END $$;
SELECT 'news_events calendar migration tests passed in disposable PostgreSQL' AS result;
ROLLBACK;
