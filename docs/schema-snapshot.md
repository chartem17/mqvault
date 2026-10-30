> Скопійовано без змін змісту з файлу `trade-vault-schema-snapshot.md`, наданого власником 2026-10-30. Це ручна документація, а не згенерований `database.types.ts` і не повний дамп схеми. Нічого з неї не є дозволом змінювати схему. Перед використанням звіряйте з актуальним станом Supabase через першого агента.

# Trade Vault / mqvault — schema snapshot for an agent without Supabase access

Snapshot: public schema inspected 2026-10-30, before applying prop_rule_settings_v1.
Repository working baseline: chartem17/mqvault, feat/undo-delete-current, integration commit c9f3dba6aad073096351ff1ee11ad59cf3e771bf.
This is manually documented metadata, NOT generated database.types.ts, NOT a complete schema dump, and NOT permission to migrate anything.
No user records, credentials, account logins, emails or trading history are included.

## Authority and limitations
- Separate actual deployed columns below from proposed migration columns. A migration committed to GitHub or passing CI is not necessarily applied to Supabase.
- RLS was enabled on the listed public tables at inspection. Actual policies, grants and tenant isolation have NOT been fully reproduced or certified by this file.
- Current application access is private single-owner access. app_users.id must NOT automatically be assumed equal to auth.users.id or auth.uid().
- src/lib/supabase/types.ts contains legacy journal names such as source_type, pnl_usd and pnl_r. It is NOT an authoritative generated Database type for the actual journal_trades table.
- SQL numeric is not inherently an exact JavaScript number. Preserve current API contracts and exact decimal boundaries; do not invent conversions.
- Foreign keys listed below describe relationships; do NOT infer ON DELETE behavior, cascade safety, uniqueness or indexes where they are not stated.

Notation: ? nullable; ! NOT NULL. uuid = PostgreSQL uuid; ts = timestamptz; numeric = PostgreSQL numeric; int = int4.

## app_users — actual
id uuid ! primary key, default gen_random_uuid()
email text ? unique
username text ? unique
display_name text ?
is_owner boolean ! default false
created_at ts ! default now()
updated_at ts ! default now()
timezone text ! default Europe/Kyiv; length 3..64
locale text ! default uk; allowed uk/en
country_code text ?; two uppercase ASCII letters if present

## accounts — actual BEFORE prop_rule_settings_v1
id uuid ! primary key, default gen_random_uuid()
user_id uuid ! -> app_users.id
name text !
broker text ?
platform text !; manual/mt5/binance/bybit/other
account_type text ! default personal; personal/prop
currency text ! default USD
mt5_login text ?
mt5_server text ?
initial_balance numeric ?
phase text ?
target_percent numeric ?
max_loss_percent numeric ?
daily_loss_percent numeric ?
is_active boolean ! default true
created_at ts ! default now()
updated_at ts ! default now()
status text ! default active; active/passed/failed
color text ?
parent_account_id uuid ? -> accounts.id
broker_timezone text ! default Etc/UTC; length 3..64
min_trading_days int ?; >= 0 when present

Important: the frontend AccountStatus union also contains archived, but the inspected DB constraint only allows active/passed/failed. Do not treat archived as a supported database status without an approved schema change.
The current account creation UI/API supports manual and mt5, even though the DB platform constraint permits additional values.
Initial capital is not current broker balance. Funded is a stage label, not proof of live capital.

## accounts — PROPOSED additions, not deployed at last schema verification
File: supabase/migrations/20261030200500_prop_rule_settings_v1.sql
prop_target_state text ?
prop_max_loss_state text ?
prop_daily_loss_state text ?
prop_min_days_state text ?
  States: unknown/not_applicable/configured. NULL retains legacy interpretation.
prop_max_loss_mode text ?; static/eod_trailing_percent
prop_day_timezone text ?; DB length 3..64, application additionally validates timezone
prop_day_close time(0) without time zone ?; minute precision, 24:00 disallowed
prop_loss_control_basis text ?; balance/equity
prop_rules_notes text ?; max 2000 characters
prop_rules_revision int ! default 0; >= 0

Configured conditions require valid corresponding existing numeric fields. Inactive numeric values may be retained without activating a condition.
The proposed bump_prop_rules_revision trigger increments the revision on tracked changes and rejects directly supplied revision changes. API conditional updates must still compare expected revision; the trigger alone is not optimistic concurrency enforcement.
The prepared migration does not create EOD snapshots, cash-flow history, public authentication, or an account verdict engine.

## journal_trades — actual
id uuid ! primary key, default gen_random_uuid()
user_id uuid ! -> app_users.id
account_id uuid ! -> accounts.id
source text !; manual/mt5/exchange/import
external_id text ?
import_run_id uuid ? -> mt5_import_runs.id
symbol text !
market text ?
direction text !; Long/Short
opened_at ts !
closed_at ts ?
entry_price numeric ?
exit_price numeric ?
stop_loss numeric ?
take_profit numeric ?
volume numeric ?
risk_percent numeric ?
risk_amount numeric ?
gross_pnl numeric ! default 0
commission numeric ! default 0
swap numeric ! default 0
fee numeric ! default 0
net_pnl numeric ! default 0
result_r numeric ?
session text ?
setup text ?
htf_bias text ?
entry_reason text ?
exit_reason text ?
emotion text ?
mistake text ?
screenshot_url text ?
notes text ?
tags jsonb ! default []
meta jsonb ! default {}
created_at ts ! default now()
updated_at ts ! default now()
raw_symbol text ?
normalized_symbol text ?
symbol_root text ?
symbol_path text ?
asset_class text ?
base_asset text ?
quote_asset text ?
classification_source text ?
classification_confidence text ?
ticket text ?

Do not replace actual source/net_pnl/result_r with legacy source_type/pnl_usd/pnl_r.
Do not reapply historical timezone correction. The project has historical meta.tz_fixed markers; timestamps must not be shifted again by guessing.
Exact opened_at and closed_at are essential, including multi-day trades. A missing close timestamp is not permission to invent one.

## mt5_import_runs — actual
id uuid ! primary key
user_id uuid ! -> app_users.id
account_id uuid ! -> accounts.id
status text ! default pending; pending/running/completed/failed
bridge_login text ?
bridge_server text ?
started_at ts ! default now()
finished_at ts ?
updated_at ts ! default now()
error_message text ?
summary jsonb ! default {}

## mt5_deals_raw — actual
id uuid ! primary key
user_id uuid ! -> app_users.id
account_id uuid ! -> accounts.id
import_run_id uuid ? -> mt5_import_runs.id
deal_ticket text !
order_ticket text ?
position_id text ?
symbol text !
direction text ?; Long/Short if present
entry_type text ?; in/out/inout if present
volume numeric ?
price numeric ?
profit numeric ! default 0
commission numeric ! default 0
swap numeric ! default 0
fee numeric ! default 0
deal_time ts !
payload jsonb ! default {}
created_at ts ! default now()

These tables do not by themselves establish a complete broker EOD balance or reconciled cash-flow history. No dedicated EOD balance/snapshot/cash-flow table was found in the inspected public schema.

## strategy_rules — actual
id uuid ! primary key
user_id uuid ! -> app_users.id
name text !
description text ?
market text ?
is_active boolean ! default true
definition jsonb ! default {}
created_at ts ! default now()
updated_at ts ! default now()
account_id uuid ! -> accounts.id
source_strategy_id uuid ? -> strategy_rules.id

## strategy_checks — actual
id uuid ! primary key
user_id uuid ! -> app_users.id
trade_id uuid ! -> journal_trades.id
strategy_rule_id uuid ! -> strategy_rules.id
passed boolean !
score numeric ?
reasons jsonb ! default []
checked_at ts ! default now()

## news_events — actual
id uuid ! primary key
country text ?
title text !
impact text ?
event_time ts !
source text ! default manual
external_id text ?
payload jsonb ! default {}
created_at ts ! default now()
currency text ?
actual text ?
forecast text ?
previous text ?
unit text ?
updated_at ts ! default now()

## trade_news_links — actual
id uuid ! primary key
trade_id uuid ! -> journal_trades.id
news_event_id uuid ! -> news_events.id
minutes_diff int !
relation_type text ! default near_event; before_event/after_event/during_event/near_event
created_at ts ! default now()
currency_match text ?
window_minutes int ! default 60

## Other inspected tables, intentionally not expanded here
- broker_symbols: owner/account-scoped broker symbol metadata and classification.
- market_instruments: market/provider symbol catalog, active flags and ordering.
Do not invent their complete row types from this summary; request metadata if a task requires them.

## Existing application boundaries
src/lib/supabase/server.ts -> createServerSupabase(), server-side secret, never a client import.
src/lib/supabase/client.ts -> inspect actual implementation before using; its existence is not authorization to bypass APIs.
src/lib/supabase/private-owner.ts -> resolvePrivateOwner(request), current private access and uniquely configured owner.
src/lib/supabase/permanent-delete.ts -> permanentlyDeleteOwnedEntity(trustedOwnerId, kind, entityId).
Database RPC: vault_delete_entity(p_owner_id, p_kind, p_entity_id), result validated by deletion-result.ts.
Do not replace deferred permanent deletion with a trash/soft-delete model.

## Agent permissions
An agent without Supabase access may use this snapshot for design, documentation and typed API-bound work. It must not claim to have checked live rows, policies, migrations, broker data or production connectivity.
Do not generate a fake complete Database type from this document. Preserve schema-generation ownership with the database agent.
