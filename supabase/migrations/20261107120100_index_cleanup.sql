-- Applied 2026-11-07. Index housekeeping only; no data changes.

-- Duplicate indexes (identical definitions); keep the constraint-backed / migration-defined ones.
drop index if exists public.idx_news_events_event_time;          -- = news_events_event_time_idx
drop index if exists public.idx_trade_news_links_news_event_id;  -- = trade_news_links_news_idx
drop index if exists public.idx_trade_news_links_trade_id;       -- = trade_news_links_trade_idx
drop index if exists public.trade_news_links_pair_uidx;          -- = trade_news_links_unique (constraint)

-- Covering indexes for foreign keys.
create index if not exists accounts_parent_account_id_idx on public.accounts (parent_account_id);
create index if not exists journal_trades_import_run_id_idx on public.journal_trades (import_run_id);
create index if not exists strategy_rules_source_strategy_id_idx on public.strategy_rules (source_strategy_id);
