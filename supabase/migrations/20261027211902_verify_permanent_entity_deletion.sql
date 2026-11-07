-- Restored 2026-11-07 from supabase_migrations.schema_migrations (applied 2026-10-27).
-- Already applied in Supabase. Do not edit.
-- Self-check of vault_delete_entity: inserts fixtures, verifies deletion rules, then rolls them back.

do $$
declare
  u uuid := gen_random_uuid();
  other_u uuid := gen_random_uuid();
  a uuid := gen_random_uuid();
  sibling uuid := gen_random_uuid();
  other_a uuid := gen_random_uuid();
  t uuid := gen_random_uuid();
  remaining_t uuid := gen_random_uuid();
  other_t uuid := gen_random_uuid();
  s uuid := gen_random_uuid();
  copied_s uuid := gen_random_uuid();
  replacement_s uuid := gen_random_uuid();
  run_id uuid := gen_random_uuid();
  event_id uuid := gen_random_uuid();
  result jsonb;
begin
  if has_function_privilege('anon', 'public.vault_delete_entity(uuid,text,uuid)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.vault_delete_entity(uuid,text,uuid)', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.vault_delete_entity(uuid,text,uuid)', 'EXECUTE') then
    raise exception 'Deletion function privileges are incorrect';
  end if;
  begin
    insert into public.app_users(id, display_name) values (u, 'Undo verification fixture'), (other_u, 'Undo verification other owner');
    insert into public.accounts(id, user_id, name, platform) values
      (a, u, 'Undo verification account', 'manual'),
      (sibling, u, 'Undo verification sibling', 'manual'),
      (other_a, other_u, 'Undo verification other account', 'manual');
    update public.accounts set parent_account_id = a where id = sibling;
    insert into public.mt5_import_runs(id, user_id, account_id) values (run_id, u, a);
    insert into public.journal_trades(id, user_id, account_id, source, symbol, direction, opened_at, import_run_id) values
      (t, u, a, 'manual', 'EURUSD', 'Long', now(), run_id),
      (remaining_t, u, a, 'manual', 'GBPUSD', 'Short', now(), run_id),
      (other_t, other_u, other_a, 'manual', 'EURUSD', 'Long', now(), null);
    insert into public.strategy_rules(id, user_id, account_id, name) values
      (s, u, a, 'Undo verification strategy'),
      (copied_s, u, sibling, 'Undo verification strategy copy');
    update public.strategy_rules set source_strategy_id = s where id = copied_s;
    insert into public.strategy_checks(user_id, trade_id, strategy_rule_id, passed) values (u, t, s, true), (u, remaining_t, s, false);
    insert into public.news_events(id, title, event_time) values (event_id, 'Undo verification news', now());
    insert into public.trade_news_links(trade_id, news_event_id, minutes_diff) values (t, event_id, 0), (remaining_t, event_id, 0);
    insert into public.mt5_deals_raw(user_id, account_id, import_run_id, deal_ticket, symbol, deal_time) values (u, a, run_id, gen_random_uuid()::text, 'EURUSD', now());
    insert into public.broker_symbols(user_id, account_id, source_type, raw_symbol) values (u, a, 'mt5', 'EURUSD');

    result := public.vault_delete_entity(other_u, 'trade', t);
    if result->>'deleted' <> 'false' or not exists(select 1 from public.journal_trades where id = t) then raise exception 'Wrong-owner protection failed'; end if;

    result := public.vault_delete_entity(u, 'trade', t);
    if result->>'deleted' <> 'true' or exists(select 1 from public.journal_trades where id = t)
      or exists(select 1 from public.strategy_checks where trade_id = t)
      or exists(select 1 from public.trade_news_links where trade_id = t)
      or not exists(select 1 from public.journal_trades where id = remaining_t)
      or not exists(select 1 from public.news_events where id = event_id) then raise exception 'Trade deletion dependency handling failed'; end if;
    result := public.vault_delete_entity(u, 'trade', t);
    if result->>'deleted' <> 'false' then raise exception 'Repeated deletion failed'; end if;

    result := public.vault_delete_entity(u, 'strategy', s);
    if result->>'deleted' <> 'true' or exists(select 1 from public.strategy_rules where id = s)
      or exists(select 1 from public.strategy_checks where strategy_rule_id = s)
      or not exists(select 1 from public.strategy_rules where id = copied_s and source_strategy_id is null)
      or not exists(select 1 from public.journal_trades where id = remaining_t) then raise exception 'Strategy deletion dependency handling failed'; end if;
    insert into public.strategy_rules(id, user_id, account_id, name) values (replacement_s, u, a, 'Undo verification replacement');
    insert into public.strategy_checks(user_id, trade_id, strategy_rule_id, passed) values (u, remaining_t, replacement_s, true);

    result := public.vault_delete_entity(u, 'account', a);
    if result->>'deleted' <> 'true' or exists(select 1 from public.accounts where id = a)
      or exists(select 1 from public.journal_trades where account_id = a)
      or exists(select 1 from public.strategy_rules where account_id = a)
      or exists(select 1 from public.strategy_checks where trade_id = remaining_t or strategy_rule_id = replacement_s)
      or exists(select 1 from public.trade_news_links where trade_id = remaining_t)
      or exists(select 1 from public.mt5_deals_raw where account_id = a)
      or exists(select 1 from public.mt5_import_runs where account_id = a)
      or exists(select 1 from public.broker_symbols where account_id = a)
      or not exists(select 1 from public.accounts where id = sibling and parent_account_id is null)
      or not exists(select 1 from public.strategy_rules where id = copied_s)
      or not exists(select 1 from public.journal_trades where id = other_t)
      or not exists(select 1 from public.accounts where id = other_a)
      or not exists(select 1 from public.news_events where id = event_id) then raise exception 'Account deletion isolation or dependency handling failed'; end if;
    raise exception using errcode = 'ZX001', message = 'Rollback verification fixtures';
  exception when sqlstate 'ZX001' then
    null;
  end;
  if exists(select 1 from public.app_users where id in (u, other_u))
    or exists(select 1 from public.news_events where id = event_id) then raise exception 'Fixture rollback failed'; end if;
end;
$$;
