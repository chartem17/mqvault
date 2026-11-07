-- Restored 2026-11-07 from supabase_migrations.schema_migrations (applied 2026-10-22).
-- Already applied in Supabase. Do not edit.

alter table public.news_events
  add column if not exists currency text,
  add column if not exists actual text,
  add column if not exists forecast text,
  add column if not exists previous text,
  add column if not exists unit text,
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists news_events_source_external_uidx
  on public.news_events (source, external_id)
  where external_id is not null;
create index if not exists news_events_event_time_idx on public.news_events (event_time desc);
create index if not exists news_events_currency_time_idx on public.news_events (currency, event_time);

alter table public.trade_news_links
  add column if not exists currency_match text,
  add column if not exists window_minutes integer not null default 60;

create unique index if not exists trade_news_links_pair_uidx
  on public.trade_news_links (trade_id, news_event_id);
create index if not exists trade_news_links_trade_idx on public.trade_news_links (trade_id);
create index if not exists trade_news_links_news_idx on public.trade_news_links (news_event_id);

create index if not exists journal_trades_opened_idx on public.journal_trades (opened_at);

create or replace function public.link_trades_to_news(p_window_minutes integer default 60)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  inserted_count integer;
begin
  insert into public.trade_news_links
    (trade_id, news_event_id, minutes_diff, relation_type, currency_match, window_minutes)
  select
    t.id,
    n.id,
    round(extract(epoch from (t.opened_at - n.event_time)) / 60)::int,
    case
      when t.closed_at is not null and n.event_time between t.opened_at and t.closed_at then 'during_event'
      when n.event_time > t.opened_at then 'before_event'
      else 'after_event'
    end,
    n.currency,
    p_window_minutes
  from public.journal_trades t
  join public.news_events n
    on n.currency is not null
   and n.currency in (upper(coalesce(t.base_asset, '')), upper(coalesce(t.quote_asset, '')))
   and n.event_time between t.opened_at - make_interval(mins => p_window_minutes)
                        and coalesce(t.closed_at, t.opened_at) + make_interval(mins => p_window_minutes)
  on conflict (trade_id, news_event_id) do update
    set minutes_diff = excluded.minutes_diff,
        relation_type = excluded.relation_type,
        currency_match = excluded.currency_match,
        window_minutes = excluded.window_minutes;
  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

create or replace view public.news_impact_stats
with (security_invoker = true) as
select
  t.user_id,
  t.account_id,
  coalesce(n.impact, 'unknown') as impact,
  n.currency,
  l.relation_type,
  count(distinct t.id) as trades,
  count(distinct t.id) filter (where t.net_pnl > 0) as wins,
  round(100.0 * count(distinct t.id) filter (where t.net_pnl > 0) / nullif(count(distinct t.id), 0), 1) as win_rate,
  round(avg(t.net_pnl), 2) as avg_pnl,
  round(sum(t.net_pnl), 2) as total_pnl,
  round(avg(t.result_r), 2) as avg_r
from public.trade_news_links l
join public.journal_trades t on t.id = l.trade_id
join public.news_events n on n.id = l.news_event_id
group by t.user_id, t.account_id, coalesce(n.impact, 'unknown'), n.currency, l.relation_type;
