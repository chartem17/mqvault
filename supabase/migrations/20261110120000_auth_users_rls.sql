-- Multi-user authentication (ADR 0017): app_users.id = auth.users.id, row-level security by auth.uid().
-- Adds only; no user data is changed or removed. The legacy owner row keeps its id until its owner signs up
-- with the same confirmed email, then the whole workspace is re-keyed to the new auth id in one transaction.

begin;

-- 1. Profile columns ---------------------------------------------------------------------------------------------
alter table public.app_users
  add column if not exists avatar_url text,
  add column if not exists plan text not null default 'free';
alter table public.app_users
  add constraint app_users_avatar_url_check check (avatar_url is null or (avatar_url ~ '^https://' and char_length(avatar_url) <= 600)),
  add constraint app_users_plan_check check (plan in ('free', 'pro')),
  add constraint app_users_display_name_len check (display_name is null or char_length(display_name) between 1 and 80);

-- 2. Every reference to app_users follows a changed id (needed once, to re-key the legacy owner row) -------------
do $$
declare c record;
begin
  for c in
    select conrelid::regclass as tbl, conname, pg_get_constraintdef(oid) as def
    from pg_constraint
    where contype = 'f' and confrelid = 'public.app_users'::regclass and confupdtype <> 'c'
  loop
    execute format('alter table %s drop constraint %I', c.tbl, c.conname);
    execute format('alter table %s add constraint %I %s on update cascade', c.tbl, c.conname, c.def);
  end loop;
end $$;

-- 3. app_users.id is the auth user id. NOT VALID: the legacy owner row is checked only when it is re-keyed.
--    Deleting the auth user deletes the profile and, through the existing cascades, the user's data.
alter table public.app_users
  add constraint app_users_id_auth_fkey foreign key (id) references auth.users (id) on delete cascade not valid;
alter table public.app_users alter column id drop default;

-- 4. Profile row for every auth user ---------------------------------------------------------------------------
create or replace function public.handle_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_name text := nullif(left(btrim(coalesce(v_meta->>'full_name', v_meta->>'name', '')), 80), '');
  v_avatar text := coalesce(v_meta->>'avatar_url', v_meta->>'picture');
  v_zone text := v_meta->>'timezone';
  v_locale text := v_meta->>'locale';
  v_legacy uuid;
begin
  if v_avatar is null or v_avatar !~ '^https://' or char_length(v_avatar) > 600 then v_avatar := null; end if;
  if v_zone is null or not exists (select 1 from pg_catalog.pg_timezone_names where name = v_zone) then v_zone := null; end if;
  if v_locale is null or v_locale not in ('uk', 'en') then v_locale := null; end if;

  -- Already linked: keep the sign-in email and provider avatar current; the name stays as the user set it.
  if exists (select 1 from public.app_users where id = new.id) then
    update public.app_users
      set email = new.email,
          avatar_url = coalesce(v_avatar, avatar_url),
          display_name = coalesce(display_name, v_name),
          updated_at = now()
      where id = new.id
        and (email is distinct from new.email or avatar_url is distinct from coalesce(v_avatar, avatar_url) or (display_name is null and v_name is not null));
    return new;
  end if;

  -- A pre-auth workspace (profile row without an auth user) is claimed only by its own, confirmed email.
  if new.email is not null then
    select a.id into v_legacy
      from public.app_users a
      where lower(a.email) = lower(new.email)
        and not exists (select 1 from auth.users u where u.id = a.id)
      for update;
    if v_legacy is not null then
      if new.email_confirmed_at is null then return new; end if;
      update public.app_users
        set id = new.id, avatar_url = coalesce(avatar_url, v_avatar), display_name = coalesce(display_name, v_name), updated_at = now()
        where id = v_legacy;
      return new;
    end if;
  end if;

  insert into public.app_users (id, email, display_name, avatar_url, timezone, locale)
  values (new.id, new.email, v_name, v_avatar, coalesce(v_zone, 'Europe/Kyiv'), coalesce(v_locale, 'en'))
  on conflict do nothing;
  return new;
end;
$$;
revoke all on function public.handle_auth_user() from public, anon, authenticated;

drop trigger if exists mqvault_auth_user_created on auth.users;
create trigger mqvault_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_auth_user();
drop trigger if exists mqvault_auth_user_updated on auth.users;
create trigger mqvault_auth_user_updated
  after update of email, email_confirmed_at, raw_user_meta_data on auth.users
  for each row execute function public.handle_auth_user();

-- 5. Privileges: anon gets nothing; authenticated gets row-filtered access ---------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on functions from public, anon, authenticated;

drop policy if exists "dev read journal_trades" on public.journal_trades;          -- was: SELECT for anon, using (true)
drop policy if exists market_instruments_read_authenticated on public.market_instruments;

-- 5a. Own profile: read; edit only the preference columns (never id, email, is_owner, plan).
grant select on public.app_users to authenticated;
grant update (display_name, timezone, locale, country_code, updated_at) on public.app_users to authenticated;
create policy app_users_select_own on public.app_users for select to authenticated using (id = (select auth.uid()));
create policy app_users_update_own on public.app_users for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- 5b. User-owned tables: all four operations, only on own rows.
do $$
declare t text;
begin
  foreach t in array array[
    'accounts', 'journal_trades', 'strategy_rules', 'strategy_checks',
    'journal_layout_preferences', 'dashboard_layout_preferences',
    'mt5_import_runs', 'mt5_deals_raw', 'broker_symbols'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('create policy %I on public.%I for select to authenticated using (user_id = (select auth.uid()))', t || '_select_own', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (user_id = (select auth.uid()))', t || '_insert_own', t);
    execute format('create policy %I on public.%I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t || '_update_own', t);
    execute format('create policy %I on public.%I for delete to authenticated using (user_id = (select auth.uid()))', t || '_delete_own', t);
  end loop;
end $$;

-- Ownership test usable inside policies (a policy on accounts cannot query accounts itself). Returns only a boolean
-- about the caller's own account.
create function public.owns_account(p_account_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.accounts a where a.id = p_account_id and a.user_id = (select auth.uid()));
$$;
revoke all on function public.owns_account(uuid) from public, anon;
grant execute on function public.owns_account(uuid) to authenticated;

-- 5c. A row may only point at the user's own account (a foreign account id is never accepted, even with own user_id).
do $$
declare t text;
begin
  foreach t in array array['journal_trades', 'strategy_rules', 'mt5_import_runs', 'mt5_deals_raw', 'broker_symbols'] loop
    execute format($f$create policy %I on public.%I as restrictive for insert to authenticated
      with check (account_id is null or public.owns_account(account_id))$f$, t || '_insert_own_account', t);
    execute format($f$create policy %I on public.%I as restrictive for update to authenticated
      using (true)
      with check (account_id is null or public.owns_account(account_id))$f$, t || '_update_own_account', t);
  end loop;
end $$;
create policy accounts_insert_own_parent on public.accounts as restrictive for insert to authenticated
  with check (parent_account_id is null or public.owns_account(parent_account_id));
create policy accounts_update_own_parent on public.accounts as restrictive for update to authenticated
  using (true)
  with check (parent_account_id is null or public.owns_account(parent_account_id));

-- 5d. trade_news_links has no user_id: ownership comes from the trade.
grant select, insert, update, delete on public.trade_news_links to authenticated;
create policy trade_news_links_own on public.trade_news_links for all to authenticated
  using (exists (select 1 from public.journal_trades t where t.id = trade_id and t.user_id = (select auth.uid())))
  with check (exists (select 1 from public.journal_trades t where t.id = trade_id and t.user_id = (select auth.uid())));

-- 5e. Shared reference tables: read-only for signed-in users, written only with the service key.
grant select on public.news_events, public.market_instruments to authenticated;
create policy news_events_read on public.news_events for select to authenticated using (true);
create policy market_instruments_read on public.market_instruments for select to authenticated using (true);

-- 5f. MT5 Bridge: a user sees own PCs, MT5 accounts and their raw deals; may revoke a PC and answer the
--     "new MT5 account" question. Everything else (pairing, keys, replay counter, sync) stays service-only.
grant select on public.bridge_devices, public.bridge_terminal_accounts, public.bridge_deals to authenticated;
grant update (revoked_at) on public.bridge_devices to authenticated;
grant update (needs_review, ignored_at) on public.bridge_terminal_accounts to authenticated;
create policy bridge_devices_select_own on public.bridge_devices for select to authenticated using (user_id = (select auth.uid()));
create policy bridge_devices_update_own on public.bridge_devices for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy bridge_terminal_accounts_select_own on public.bridge_terminal_accounts for select to authenticated using (user_id = (select auth.uid()));
create policy bridge_terminal_accounts_update_own on public.bridge_terminal_accounts for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy bridge_deals_select_own on public.bridge_deals for select to authenticated
  using (exists (select 1 from public.bridge_terminal_accounts ta where ta.id = terminal_account_id and ta.user_id = (select auth.uid())));

-- 5g. Service-only tables: an explicit deny policy documents the intent (and answers the "RLS without policy" advisor).
do $$
declare t text;
begin
  foreach t in array array['bridge_orders', 'bridge_positions', 'bridge_pairings', 'bridge_rate_limits'] loop
    execute format('create policy %I on public.%I as restrictive for all to anon, authenticated using (false) with check (false)', t || '_service_only', t);
  end loop;
end $$;

-- 6. Functions and the view --------------------------------------------------------------------------------------
-- vault_delete_entity stays SECURITY INVOKER, so row-level security applies on top of its own owner filters.
-- New first check: a signed-in caller may only delete as themselves. The service role has no auth.uid() and keeps
-- passing a server-verified owner id. The rest of the body is unchanged from 20261027211654.
create or replace function public.vault_delete_entity(p_owner_id uuid, p_kind text, p_entity_id uuid)
returns jsonb
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  v_account_id uuid;
  v_trade_ids uuid[];
  v_strategy_ids uuid[];
begin
  if (select auth.uid()) is not null and p_owner_id is distinct from (select auth.uid()) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if p_owner_id is null or p_entity_id is null or p_kind is null or p_kind not in ('trade', 'account', 'strategy') then
    raise exception 'Invalid deletion request' using errcode = '22023';
  end if;

  if p_kind = 'account' then
    select id into v_account_id from public.accounts
      where id = p_entity_id and user_id = p_owner_id for update;
  elsif p_kind = 'trade' then
    select account_id into v_account_id from public.journal_trades
      where id = p_entity_id and user_id = p_owner_id;
  else
    select account_id into v_account_id from public.strategy_rules
      where id = p_entity_id and user_id = p_owner_id;
  end if;
  if v_account_id is null then return jsonb_build_object('deleted', false); end if;

  perform 1 from public.accounts where id = v_account_id and user_id = p_owner_id for update;
  if not found then return jsonb_build_object('deleted', false); end if;

  if p_kind = 'trade' then
    perform 1 from public.journal_trades where id = p_entity_id and user_id = p_owner_id and account_id = v_account_id for update;
    if not found then return jsonb_build_object('deleted', false); end if;
    delete from public.trade_news_links where trade_id = p_entity_id;
    delete from public.strategy_checks where trade_id = p_entity_id;
    delete from public.journal_trades where id = p_entity_id and user_id = p_owner_id;
    return jsonb_build_object('deleted', true);
  end if;

  if p_kind = 'strategy' then
    perform 1 from public.strategy_rules where id = p_entity_id and user_id = p_owner_id and account_id = v_account_id for update;
    if not found then return jsonb_build_object('deleted', false); end if;
    update public.strategy_rules set source_strategy_id = null
      where source_strategy_id = p_entity_id and user_id = p_owner_id;
    delete from public.strategy_checks where strategy_rule_id = p_entity_id;
    delete from public.strategy_rules where id = p_entity_id and user_id = p_owner_id;
    return jsonb_build_object('deleted', true);
  end if;

  -- Refuse inconsistent cross-owner relationships instead of cascading into them.
  if exists (select 1 from public.journal_trades where account_id = v_account_id and user_id <> p_owner_id)
    or exists (select 1 from public.strategy_rules where account_id = v_account_id and user_id <> p_owner_id)
    or exists (select 1 from public.mt5_deals_raw where account_id = v_account_id and user_id <> p_owner_id)
    or exists (select 1 from public.mt5_import_runs where account_id = v_account_id and user_id <> p_owner_id)
    or exists (select 1 from public.broker_symbols where account_id = v_account_id and user_id <> p_owner_id) then
    raise exception 'Inconsistent account ownership' using errcode = '23514';
  end if;
  perform 1 from public.journal_trades where account_id = v_account_id and user_id = p_owner_id for update;
  perform 1 from public.strategy_rules where account_id = v_account_id and user_id = p_owner_id for update;
  select coalesce(array_agg(id), array[]::uuid[]) into v_trade_ids
    from public.journal_trades where account_id = v_account_id and user_id = p_owner_id;
  select coalesce(array_agg(id), array[]::uuid[]) into v_strategy_ids
    from public.strategy_rules where account_id = v_account_id and user_id = p_owner_id;

  delete from public.trade_news_links where trade_id = any(v_trade_ids);
  delete from public.strategy_checks where trade_id = any(v_trade_ids) or strategy_rule_id = any(v_strategy_ids);
  update public.strategy_rules set source_strategy_id = null
    where source_strategy_id = any(v_strategy_ids) and user_id = p_owner_id;
  delete from public.strategy_rules where id = any(v_strategy_ids) and user_id = p_owner_id;
  delete from public.journal_trades where id = any(v_trade_ids) and user_id = p_owner_id;
  delete from public.mt5_deals_raw where account_id = v_account_id and user_id = p_owner_id;
  delete from public.broker_symbols where account_id = v_account_id and user_id = p_owner_id;
  delete from public.mt5_import_runs where account_id = v_account_id and user_id = p_owner_id;
  -- Preserve other phase accounts; only detach their reference to this account.
  update public.accounts set parent_account_id = null
    where parent_account_id = v_account_id and user_id = p_owner_id;
  delete from public.accounts where id = v_account_id and user_id = p_owner_id;
  return jsonb_build_object('deleted', true, 'trades_deleted', cardinality(v_trade_ids), 'strategies_deleted', cardinality(v_strategy_ids));
end;
$$;
grant execute on function public.vault_delete_entity(uuid, text, uuid) to authenticated, service_role;

-- Service-only helpers (import, rate limits) and the unused linker: no anon / authenticated execute.
grant execute on function public.import_news_events(jsonb) to service_role;
grant execute on function public.link_trades_to_news(integer) to service_role;
grant execute on function public.bridge_rate_limit_hit(text, integer, integer) to service_role;
grant execute on function public.bridge_rate_limit_reset(text) to service_role;

-- news_impact_stats is security_invoker: it shows only rows the caller may read in journal_trades.
alter view public.news_impact_stats set (security_invoker = true);
grant select on public.news_impact_stats to authenticated;

-- Active sign-in sessions of the caller (Settings → Security). Reads auth.sessions, returns only own rows.
create function public.list_my_sessions()
returns table (id uuid, created_at timestamptz, updated_at timestamptz, user_agent text, ip text)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.created_at, coalesce(s.refreshed_at at time zone 'utc', s.updated_at), s.user_agent, host(s.ip)
  from auth.sessions s
  where s.user_id = (select auth.uid()) and (s.not_after is null or s.not_after > now())
  order by coalesce(s.refreshed_at at time zone 'utc', s.updated_at) desc nulls last
  limit 50;
$$;
revoke all on function public.list_my_sessions() from public, anon;
grant execute on function public.list_my_sessions() to authenticated;

commit;
