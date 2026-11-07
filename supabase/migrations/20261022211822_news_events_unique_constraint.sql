-- Restored 2026-11-07 from supabase_migrations.schema_migrations (applied 2026-10-22).
-- Already applied in Supabase. Do not edit.

drop index if exists public.news_events_source_external_uidx;
alter table public.news_events
  add constraint news_events_source_external_key unique (source, external_id);
