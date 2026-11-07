# База даних

Supabase (Postgres 17), проєкт `mqvault-dev`. Схему знято з живої бази 2026-11-07; на всіх таблицях `public` увімкнено RLS. Застосунок ходить у БД лише з сервера (`createServerSupabase()`, сервісний ключ), браузер напряму не звертається.

Усі таблиці користувача мають `user_id → app_users.id`; власник робочого простору визначається як єдиний `app_users.is_owner = true` ([ADR 0006](../decisions/0006-private-access-single-password.md)).

## Таблиці

| Таблиця | Призначення | Ключове |
|---|---|---|
| `app_users` | Користувачі | `timezone` (за замовчуванням `Europe/Kyiv`), `locale` (`uk`/`en`), `country_code`, `is_owner` |
| `accounts` | Торгові рахунки | `platform` (manual/mt5/binance/bybit/other), `account_type` (personal/prop), `broker_timezone` (за замовч. `Etc/UTC`), `phase`, `parent_account_id` (гілка Phase 1 → 2 → Funded), `target_percent`, `max_loss_percent`, `daily_loss_percent`, `min_trading_days`, `prop_*_state`, `prop_rules_revision` |
| `journal_trades` | Угоди | `source`, `opened_at`/`closed_at` (timestamptz), `gross_pnl`, `commission`, `swap`, `fee`, `net_pnl`, `result_r`, `session`, `setup`, `emotion`, `mistake`, `screenshot_url`, поля нормалізації символу (`normalized_symbol`, `asset_class`, …), `meta` |
| `strategy_rules` | Стратегії (правила) | `account_id`, `definition` (jsonb), `source_strategy_id` (копія зі стратегії) |
| `strategy_checks` | Результат перевірки угоди стратегією | `trade_id`, `strategy_rule_id`, `passed`, `reasons`. Порожня, у коді поки не використовується (перевірки рахуються на льоту в `lib/strategy-control`) |
| `news_events` | Економічні новини/календар | `event_time`, `impact`, `currency`, `actual/forecast/previous`, `source`, `external_id` |
| `trade_news_links` | Зв'язок угод із новинами | `trade_id`, `news_event_id`, `minutes_diff`, `relation_type`, `window_minutes` |
| `market_instruments` | Список інструментів для вкладки Market | `provider` (binance/twelve-data), `provider_symbol`, `is_active`, `sort_order` |
| `journal_layout_preferences` | Розкладка колонок журналу | PK `user_id`, `layout` jsonb ≤ 4 КБ, `revision` (оптимістичний контроль) |
| `dashboard_layout_preferences` | Розкладка віджетів «Огляду» | PK `user_id`, `layout` jsonb ≤ 8 КБ, `revision` |
| `mt5_import_runs`, `mt5_deals_raw`, `broker_symbols` | Залишки MT5-імпорту | Порожні (0 рядків на 2026-11-07), у коді не використовуються: локальний міст виведено з експлуатації. Лишаються як основа майбутньої синхронізації; видаляти лише після рішення |

### Зв'язки

```
app_users ─┬─< accounts ─┬─< journal_trades ─┬─< strategy_checks >─ strategy_rules >─ accounts
           │             │                   └─< trade_news_links >─ news_events
           │             ├─< accounts (parent_account_id: попередній етап)
           │             └─< mt5_import_runs / mt5_deals_raw / broker_symbols
           ├─< journal_layout_preferences
           └─< dashboard_layout_preferences
```

### Колонки, які більше не використовуються

`accounts.prop_max_loss_mode`, `prop_day_timezone`, `prop_day_close`, `prop_loss_control_basis`, `prop_rules_notes` — залишилися від скасованих EOD/trailing-правил ([ADR 0004](../decisions/0004-prop-rules-simplified.md)). Код їх не читає й не пише; видалення потребує окремого затвердження.

## Міграції

Файли в `supabase/migrations/` (5 шт., від 2026-10-27) — **не повна історія**. У Supabase застосовано 12 міграцій; сім ранніх створювалися поза репозиторієм, а версії (timestamp) п'яти репозиторних файлів не збігаються з версіями в історії Supabase:

| Репозиторій | Застосовано в Supabase |
|---|---|
| — | `20261011210225 create_market_instruments` |
| — | `20261020204359 strategy_rules_account_scope` |
| — | `20261020205638 app_users_timezone` |
| — | `20261020214121 multigeo_locale_country_broker_timezone_v2` |
| — | `20261022210508 live_news_support` |
| — | `20261022211822 news_events_unique_constraint` |
| `20261027205100_permanent_entity_deletion.sql` | `20261027211654 permanent_entity_deletion` (+ `…211902 verify_permanent_entity_deletion`) |
| `20261029220000_account_min_trading_days.sql` | `20261029220804 account_min_trading_days` |
| `20261030200500_prop_rule_settings_v1.sql` | `20261030211812 prop_rule_settings_v1` |
| `20261031000200_journal_layout_preferences.sql` | `20261031000150 journal_layout_preferences` |
| `20261106190000_dashboard_layout_preferences.sql` | `20261106165747 dashboard_layout_preferences` |

Наслідки:

- **Не запускати `supabase db push`** і не застосовувати `CREATE TABLE` повторно: історії розходяться.
- Нова міграція = новий файл у `supabase/migrations/`, застосовується після погодження; **вже застосовані файли не редагувати**.
- Щоб відновити відтворюваність, потрібен базовий дамп схеми й вирівнювання версій — окрема задача (у [roadmap](../roadmap/ROADMAP.md)).
- Тест реальної SQL-міграції проп-правил на тимчасовому Postgres: `tests/prop-rule-settings-migration.sql` (запускається в CI).
