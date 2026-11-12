-- Row-level security as a second, independent layer of user isolation (ADR 0018, extends ADR 0017).
-- API routes now query with the signed-in user's own token (role `authenticated`); Postgres itself refuses any
-- row of another user, even if a route forgot its user_id filter. The service key stays only where ADR 0018
-- lists it. No data is changed. Requires 20261112100000_user_preferences (column grant on preferences).

-- 1. Who is calling, in application terms -------------------------------------------------------------------
CREATE FUNCTION public.current_app_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$ SELECT id FROM public.app_users WHERE auth_user_id = (SELECT auth.uid()) $$;
REVOKE ALL ON FUNCTION public.current_app_user_id() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.current_app_user_id() TO authenticated, service_role;

CREATE FUNCTION public.current_app_user_is_owner()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$ SELECT coalesce((SELECT is_owner FROM public.app_users WHERE auth_user_id = (SELECT auth.uid())), false) $$;
REVOKE ALL ON FUNCTION public.current_app_user_is_owner() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.current_app_user_is_owner() TO authenticated, service_role;

-- A row may point only at the caller's own account (a policy on accounts cannot query accounts itself).
CREATE FUNCTION public.owns_account(p_account_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$ SELECT EXISTS (SELECT 1 FROM public.accounts a WHERE a.id = p_account_id AND a.user_id = (SELECT public.current_app_user_id())) $$;
REVOKE ALL ON FUNCTION public.owns_account(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.owns_account(uuid) TO authenticated, service_role;

-- 2. Leftover development policies ---------------------------------------------------------------------------
-- "dev read journal_trades" lets anon and authenticated read EVERY trade; harmless only while those roles have
-- no table privileges, which this migration grants. It must go first.
DROP POLICY IF EXISTS "dev read journal_trades" ON public.journal_trades;
DROP POLICY IF EXISTS market_instruments_read_authenticated ON public.market_instruments;

-- 3. Own profile: read; edit only the preference columns (never id, email, auth_user_id, is_owner) -------------
GRANT SELECT ON public.app_users TO authenticated;
GRANT UPDATE (display_name, timezone, locale, country_code, preferences, updated_at) ON public.app_users TO authenticated;
CREATE POLICY app_users_select_own ON public.app_users FOR SELECT TO authenticated USING (id = (SELECT public.current_app_user_id()));
CREATE POLICY app_users_update_own ON public.app_users FOR UPDATE TO authenticated
  USING (id = (SELECT public.current_app_user_id())) WITH CHECK (id = (SELECT public.current_app_user_id()));

-- 4. Tables owned through user_id: all four operations, own rows only ------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'accounts', 'journal_trades', 'strategy_rules', 'strategy_checks',
    'journal_layout_preferences', 'dashboard_layout_preferences',
    'mt5_import_runs', 'mt5_deals_raw', 'broker_symbols'
  ] LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (user_id = (SELECT public.current_app_user_id()))', t || '_select_own', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT public.current_app_user_id()))', t || '_insert_own', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (user_id = (SELECT public.current_app_user_id())) WITH CHECK (user_id = (SELECT public.current_app_user_id()))', t || '_update_own', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (user_id = (SELECT public.current_app_user_id()))', t || '_delete_own', t);
  END LOOP;
END $$;

-- 4a. ...and may reference only the caller's own accounts (restrictive: added on top of the policies above).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['journal_trades', 'strategy_rules', 'mt5_import_runs', 'mt5_deals_raw', 'broker_symbols'] LOOP
    EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (account_id IS NULL OR public.owns_account(account_id))', t || '_insert_own_account', t);
    EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING (true) WITH CHECK (account_id IS NULL OR public.owns_account(account_id))', t || '_update_own_account', t);
  END LOOP;
END $$;
CREATE POLICY accounts_insert_own_parent ON public.accounts AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (parent_account_id IS NULL OR public.owns_account(parent_account_id));
CREATE POLICY accounts_update_own_parent ON public.accounts AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (true) WITH CHECK (parent_account_id IS NULL OR public.owns_account(parent_account_id));

-- 5. trade_news_links has no user_id: ownership comes from the trade -----------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trade_news_links TO authenticated;
CREATE POLICY trade_news_links_own ON public.trade_news_links FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.journal_trades t WHERE t.id = trade_id AND t.user_id = (SELECT public.current_app_user_id())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.journal_trades t WHERE t.id = trade_id AND t.user_id = (SELECT public.current_app_user_id())));

-- 6. Shared reference data: read-only. The calendar stays with the installation owner during the closed beta
--    (data licensed for private use, ADR 0013/0017); instruments are visible to every signed-in user.
GRANT SELECT ON public.news_events, public.market_instruments TO authenticated;
CREATE POLICY news_events_read_owner ON public.news_events FOR SELECT TO authenticated USING ((SELECT public.current_app_user_is_owner()));
CREATE POLICY market_instruments_read ON public.market_instruments FOR SELECT TO authenticated USING (true);

-- 7. MT5 Bridge: a user sees own PCs, MT5 accounts and their raw deals; may revoke a PC and answer the
--    "new MT5 account" question. Keys, replay counter, pairing and sync stay with the service key.
-- Device keys and the replay counter are not readable: only the listed columns are.
GRANT SELECT (id, user_id, name, os, key_fingerprint, key_storage, bridge_version, last_seen_at, last_sync_at, revoked_at, created_at) ON public.bridge_devices TO authenticated;
GRANT SELECT ON public.bridge_terminal_accounts, public.bridge_deals TO authenticated;
GRANT UPDATE (revoked_at) ON public.bridge_devices TO authenticated;
GRANT UPDATE (needs_review, ignored_at) ON public.bridge_terminal_accounts TO authenticated;
CREATE POLICY bridge_devices_select_own ON public.bridge_devices FOR SELECT TO authenticated USING (user_id = (SELECT public.current_app_user_id()));
CREATE POLICY bridge_devices_update_own ON public.bridge_devices FOR UPDATE TO authenticated
  USING (user_id = (SELECT public.current_app_user_id())) WITH CHECK (user_id = (SELECT public.current_app_user_id()));
CREATE POLICY bridge_terminal_accounts_select_own ON public.bridge_terminal_accounts FOR SELECT TO authenticated USING (user_id = (SELECT public.current_app_user_id()));
CREATE POLICY bridge_terminal_accounts_update_own ON public.bridge_terminal_accounts FOR UPDATE TO authenticated
  USING (user_id = (SELECT public.current_app_user_id())) WITH CHECK (user_id = (SELECT public.current_app_user_id()));
CREATE POLICY bridge_deals_select_own ON public.bridge_deals FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.bridge_terminal_accounts ta WHERE ta.id = terminal_account_id AND ta.user_id = (SELECT public.current_app_user_id())));

-- 8. Service-only tables: an explicit deny documents the intent (no grants exist either).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['bridge_orders', 'bridge_positions', 'bridge_pairings', 'bridge_rate_limits', 'beta_invites'] LOOP
    EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false)', t || '_service_only', t);
  END LOOP;
END $$;

-- 9. Deletion RPC runs as the user: refuses any other owner id; row-level security applies inside it.
--    The body below the new first check is unchanged from 20261027211654.
CREATE OR REPLACE FUNCTION public.vault_delete_entity(p_owner_id uuid, p_kind text, p_entity_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
declare
  v_account_id uuid;
  v_trade_ids uuid[];
  v_strategy_ids uuid[];
begin
  if (select auth.uid()) is not null and p_owner_id is distinct from (select public.current_app_user_id()) then
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
$function$;
REVOKE ALL ON FUNCTION public.vault_delete_entity(uuid, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vault_delete_entity(uuid, text, uuid) TO authenticated, service_role;

-- 10. The stats view is security_invoker: it shows only rows the caller may read.
ALTER VIEW public.news_impact_stats SET (security_invoker = true);
GRANT SELECT ON public.news_impact_stats TO authenticated;
