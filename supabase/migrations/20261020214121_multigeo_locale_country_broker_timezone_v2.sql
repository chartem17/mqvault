-- Restored 2026-11-07 from supabase_migrations.schema_migrations (applied 2026-10-20).
-- Already applied in Supabase. Do not edit.

alter table public.app_users add column if not exists locale text not null default 'uk';
alter table public.app_users add column if not exists country_code text;
update public.app_users set locale = case when lower(locale) like 'en%' then 'en' else 'uk' end where locale not in ('uk','en');
alter table public.app_users alter column locale set default 'uk';
update public.app_users set country_code = upper(country_code) where country_code is not null;
update public.app_users set country_code = null where country_code is not null and country_code !~ '^[A-Z]{2}$';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'app_users_locale_check') then
    alter table public.app_users add constraint app_users_locale_check check (locale in ('uk','en'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'app_users_country_code_check') then
    alter table public.app_users add constraint app_users_country_code_check check (country_code is null or country_code ~ '^[A-Z]{2}$');
  end if;
end $$;
alter table public.accounts add column if not exists broker_timezone text not null default 'Etc/UTC';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'accounts_broker_timezone_check') then
    alter table public.accounts add constraint accounts_broker_timezone_check check (char_length(broker_timezone) between 3 and 64);
  end if;
end $$;
