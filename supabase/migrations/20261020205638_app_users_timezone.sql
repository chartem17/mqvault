-- Restored 2026-11-07 from supabase_migrations.schema_migrations (applied 2026-10-20).
-- Already applied in Supabase. Do not edit.

alter table public.app_users
  add column if not exists timezone text not null default 'Europe/Kyiv';

alter table public.app_users
  add constraint app_users_timezone_len check (char_length(timezone) between 3 and 64);
