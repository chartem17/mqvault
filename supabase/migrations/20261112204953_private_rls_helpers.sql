-- Security advisor 0029: the RLS helper functions were SECURITY DEFINER in the exposed `public` schema, so any
-- signed-in user could also call them as /rest/v1/rpc/*. They only reveal facts about the caller themself, but
-- nothing needs them over the API. They move to a `private` schema that PostgREST does not expose; policies keep
-- using them. Same bodies, same owners; no data changes.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

ALTER FUNCTION public.current_app_user_id() SET SCHEMA private;
ALTER FUNCTION public.current_app_user_is_owner() SET SCHEMA private;
ALTER FUNCTION public.owns_account(uuid) SET SCHEMA private;
-- Policies and vault_delete_entity reference the functions by OID, so they follow the move automatically;
-- the bodies call each other by name and are re-created to point at the new schema.
CREATE OR REPLACE FUNCTION private.current_app_user_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT id FROM public.app_users WHERE auth_user_id = (SELECT auth.uid()) $$;
CREATE OR REPLACE FUNCTION private.owns_account(p_account_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT EXISTS (SELECT 1 FROM public.accounts a WHERE a.id = p_account_id AND a.user_id = (SELECT private.current_app_user_id())) $$;
-- The deletion RPC calls the helper by name: re-created with the new schema, body otherwise unchanged.
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
  if (select auth.uid()) is not null and p_owner_id is distinct from (select private.current_app_user_id()) then
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
