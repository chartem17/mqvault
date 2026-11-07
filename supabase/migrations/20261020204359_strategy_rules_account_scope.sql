-- Restored 2026-11-07 from supabase_migrations.schema_migrations (applied 2026-10-20).
-- Already applied in Supabase. Do not edit.

alter table public.strategy_rules
  add column if not exists account_id uuid references public.accounts(id) on delete cascade;

alter table public.strategy_rules
  alter column account_id set not null;

alter table public.strategy_rules
  add column if not exists source_strategy_id uuid references public.strategy_rules(id) on delete set null;

create index if not exists strategy_rules_user_account_idx
  on public.strategy_rules (user_id, account_id, created_at desc);

create unique index if not exists strategy_rules_account_name_uniq
  on public.strategy_rules (account_id, lower(name));

create index if not exists strategy_checks_strategy_rule_idx
  on public.strategy_checks (strategy_rule_id);
