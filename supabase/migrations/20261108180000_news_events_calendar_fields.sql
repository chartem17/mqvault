-- Economic calendar: extend news_events for the MetaTrader 5 calendar (source = 'mt5').
-- One site-wide table, filled by the server only (CSV import now, VPS EA / cron later).
-- See docs/features/economic-calendar.md and docs/decisions/0013-economic-calendar-source.md.
--
-- Additive only: no column is dropped or retyped, existing Forex Factory rows ('faireconomy')
-- stay as they are. The text columns actual/forecast/previous remain the display values
-- (Forex Factory sends strings like "-775M"); the new *_value columns hold the raw numbers
-- in units of `multiplier`, so "surprise" can be computed without parsing strings.

alter table public.news_events
  add column if not exists event_code text,
  add column if not exists source_series_id text,
  add column if not exists event_type text,
  add column if not exists sector text,
  add column if not exists frequency text,
  add column if not exists all_day boolean not null default false,
  add column if not exists tentative boolean not null default false,
  add column if not exists period date,
  add column if not exists revision smallint,
  add column if not exists actual_value numeric,
  add column if not exists forecast_value numeric,
  add column if not exists previous_value numeric,
  add column if not exists revised_previous_value numeric,
  add column if not exists multiplier text,
  add column if not exists digits smallint,
  add column if not exists forecast_suspect boolean not null default false,
  add column if not exists license_scope text not null default 'private';

comment on column public.news_events.source_series_id is 'Provider id of the recurring event (MT5 event_id); groups releases of one indicator.';
comment on column public.news_events.actual_value is 'Raw number in units of multiplier (NFP 165 + thousands = 165K).';
comment on column public.news_events.forecast_suspect is 'Forecast far from both previous and actual; keep, but never use for surprise.';
comment on column public.news_events.license_scope is 'private: personal use only (MT5, Forex Factory); public_ok: may be shown on a public site.';

alter table public.news_events
  add constraint news_events_impact_check
    check (impact is null or impact in ('high', 'medium', 'low', 'holiday', 'none')),
  add constraint news_events_event_type_check
    check (event_type is null or event_type in ('indicator', 'event', 'holiday')),
  add constraint news_events_multiplier_check
    check (multiplier is null or multiplier in ('none', 'thousands', 'millions', 'billions', 'trillions')),
  add constraint news_events_license_scope_check
    check (license_scope in ('private', 'public_ok'));

-- Calendar tab: currencies + impact + date range. The existing (currency, event_time) index
-- stays for link_trades_to_news; (event_time desc) already covers plain range scans.
create index if not exists news_events_currency_impact_time_idx
  on public.news_events (currency, impact, event_time);
-- History of one indicator (surprise, previous releases).
create index if not exists news_events_series_time_idx
  on public.news_events (source_series_id, event_time)
  where source_series_id is not null;

-- Idempotent batch upsert for server-side imports. A row is written only when one of its
-- fields actually changed, so re-running the same file touches nothing.
-- Returns how many rows were inserted, updated and left unchanged.
create or replace function public.import_news_events(p_rows jsonb)
returns table (inserted integer, updated integer, unchanged integer)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_total integer;
  v_inserted integer;
  v_updated integer;
begin
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'import_news_events expects a JSON array';
  end if;
  if jsonb_array_length(p_rows) > 5000 then
    raise exception 'import_news_events: at most 5000 rows per call';
  end if;

  with src as (
    select distinct on (r.source, r.external_id) r.*
    from jsonb_to_recordset(p_rows) as r(
      source text, external_id text, title text, country text, currency text, impact text,
      event_time timestamptz, actual text, forecast text, previous text, unit text,
      event_code text, source_series_id text, event_type text, sector text, frequency text,
      all_day boolean, tentative boolean, period date, revision smallint,
      actual_value numeric, forecast_value numeric, previous_value numeric, revised_previous_value numeric,
      multiplier text, digits smallint, forecast_suspect boolean, license_scope text
    )
    where r.source is not null and r.external_id is not null and r.title is not null and r.event_time is not null
    order by r.source, r.external_id
  ),
  written as (
    insert into public.news_events as n (
      source, external_id, title, country, currency, impact, event_time, actual, forecast, previous, unit,
      event_code, source_series_id, event_type, sector, frequency, all_day, tentative, period, revision,
      actual_value, forecast_value, previous_value, revised_previous_value, multiplier, digits,
      forecast_suspect, license_scope
    )
    select
      source, external_id, title, country, currency, impact, event_time, actual, forecast, previous, unit,
      event_code, source_series_id, event_type, sector, frequency, coalesce(all_day, false), coalesce(tentative, false), period, revision,
      actual_value, forecast_value, previous_value, revised_previous_value, multiplier, digits,
      coalesce(forecast_suspect, false), coalesce(license_scope, 'private')
    from src
    on conflict (source, external_id) do update set
      title = excluded.title, country = excluded.country, currency = excluded.currency, impact = excluded.impact,
      event_time = excluded.event_time, actual = excluded.actual, forecast = excluded.forecast, previous = excluded.previous,
      unit = excluded.unit, event_code = excluded.event_code, source_series_id = excluded.source_series_id,
      event_type = excluded.event_type, sector = excluded.sector, frequency = excluded.frequency,
      all_day = excluded.all_day, tentative = excluded.tentative, period = excluded.period, revision = excluded.revision,
      actual_value = excluded.actual_value, forecast_value = excluded.forecast_value, previous_value = excluded.previous_value,
      revised_previous_value = excluded.revised_previous_value, multiplier = excluded.multiplier, digits = excluded.digits,
      forecast_suspect = excluded.forecast_suspect, license_scope = excluded.license_scope,
      updated_at = now()
    where (n.title, n.country, n.currency, n.impact, n.event_time, n.actual, n.forecast, n.previous, n.unit,
           n.event_code, n.source_series_id, n.event_type, n.sector, n.frequency, n.all_day, n.tentative, n.period, n.revision,
           n.actual_value, n.forecast_value, n.previous_value, n.revised_previous_value, n.multiplier, n.digits,
           n.forecast_suspect, n.license_scope)
      is distinct from
          (excluded.title, excluded.country, excluded.currency, excluded.impact, excluded.event_time, excluded.actual,
           excluded.forecast, excluded.previous, excluded.unit, excluded.event_code, excluded.source_series_id,
           excluded.event_type, excluded.sector, excluded.frequency, excluded.all_day, excluded.tentative, excluded.period,
           excluded.revision, excluded.actual_value, excluded.forecast_value, excluded.previous_value,
           excluded.revised_previous_value, excluded.multiplier, excluded.digits, excluded.forecast_suspect,
           excluded.license_scope)
    returning (xmax = 0) as is_insert
  )
  select count(*) filter (where is_insert), count(*) filter (where not is_insert)
    into v_inserted, v_updated
    from written;

  select count(*) into v_total
    from (select distinct r->>'source', r->>'external_id' from jsonb_array_elements(p_rows) r
          where r->>'source' is not null and r->>'external_id' is not null
            and r->>'title' is not null and r->>'event_time' is not null) d;

  return query select v_inserted, v_updated, v_total - v_inserted - v_updated;
end;
$$;

-- Only the server (service_role) imports; the browser never talks to the database.
revoke all on function public.import_news_events(jsonb) from public, anon, authenticated;
grant execute on function public.import_news_events(jsonb) to service_role;
