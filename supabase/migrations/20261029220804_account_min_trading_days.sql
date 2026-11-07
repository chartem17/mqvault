-- Prepared migration only. Apply separately after backup verification and approval.
-- Does not reclassify accounts, update balances, move trades or modify RLS.
begin;
alter table public.accounts
  add column min_trading_days integer;
alter table public.accounts
  add constraint accounts_min_trading_days_nonnegative
  check (min_trading_days is null or min_trading_days >= 0);
comment on column public.accounts.min_trading_days is
  'User-configured minimum trading days for a prop account. NULL means not configured; zero means no minimum.';
commit;
