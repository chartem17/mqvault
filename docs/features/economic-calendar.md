# Економічний календар і «Новини ↔ угоди»: передача роботи

Статус: **дані зібрано, реалізації ще немає.** Документ підготовлено 2026-11-08 у чаті з власником. Наступна сесія Claude Code продовжує роботу в гілці `feat/economic-calendar` за цим документом.

Перед початком прочитай `CLAUDE.md`, `docs/roadmap/ROADMAP.md` (пункт 4 «Новини ↔ угоди», розділ «Market, новини, календар») і `docs/architecture/database.md`.

## Рішення власника (2026-11-08)

1. **Основне джерело — календар MetaTrader 5** (MQL5 `CalendarValueHistory*`). Це єдине безкоштовне джерело, де є actual, forecast, previous, revised і історія з 2017 року. Запасні джерела на майбутнє:
   - **Forex Factory weekly JSON** — розклад і важливість на поточний тиждень (без actual, ліміт 2 запити на 5 хв);
   - **FRED/ALFRED і BLS** — офіційні дані США з ревізіями;
   - **платний ліцензований провайдер** (FXMacroData / FMP) — коли сайт стане публічним і платним.
2. **Новини — спільна частина сайту для всіх користувачів.** Вони не залежать від користувача і від бріджа його угод. Таблиця подій одна на весь сайт. Її наповнює сервер: зараз імпорт CSV, далі власний MT5 на VPS і cron-синхронізація.
3. **MT5-брідж угод** (буде встановлюватися на ПК користувача) планується лише в платній підписці. Це окремий пакет, тут його не робимо. Аналіз «новини ↔ угоди» має працювати для будь-яких угод, у тому числі імпортованих через CSV.
4. **Ліцензія.** Дані FF і MT5 придатні лише для приватного використання. Кожен рядок має містити `source`, а для майбутнього публічного режиму — ознаку ліцензії (`license_scope`: `private` | `public_ok`). Публічний показ поточних даних не дозволений. Для живої стрічки на публічному сайті можна вставити офіційний віджет MQL5 (дозволений, якщо його код не змінювати).
5. **Репозиторій публічний** — **сирі дані календаря не комітити** (`.gitignore` це блокує).

## Дані, які вже є

Файл `mqvault_calendar_clean.csv` лежить на ПК власника в папці даних MT5:

```
C:\Users\cheka\AppData\Roaming\MetaQuotes\Terminal\D0E8209F77C8CF37AD8BF550E51FF075\MQL5\Files\
```

Звідти ж доступні сирі файли по валютах `mqvault_cal_<CCY>.csv`. Сесія з доступом до ПК (`device_stage_files`) забирає файл звідти. В інших випадках попроси власника прикріпити файл.

- **50 105 подій**, з 2017-01-01 до 2026-11-20. Валюти USD, EUR (EU/DE/FR/IT/ES), GBP, JPY, AUD, CAD, NZD, CHF — тобто 8 валют 28 пар власника.
- Важливість: `high`, `medium` і `holiday`. Низьку важливість не вивантажували.
- **Час уже в UTC** (`scheduled_at`, ISO `Z`). Перевірено по NFP: 12:30Z влітку і 13:30Z взимку.
  - Важливо для майбутнього EA: MT5 віддає всю історію з **поточним** зсувом сервера (зараз +120 хв для всіх дат, без урахування DST). Тому UTC = server_time − поточний зсув. Влітку зсув буде іншим, тож EA має передавати зсув разом із даними.
- Дублікати прибрано (23 рядки на стику річних запитів).
- `forecast_suspect=true` у **324** рядках: прогноз далекий і від previous, і від actual (наприклад, NFP 2020: 78356, −76324). Такі рядки не видаляти, але **не використовувати для «сюрпризу»**. Фільтр ловить не все: прогноз NFP за 2024-01-05 = 1.0 не позначено.
- actual є у 39 763 рядків, forecast — у 27 150. Для рішень і промов центробанків прогнозів майже немає.

Колонки чистого CSV:

```
source, source_event_id (MT5 value id), mt5_event_id, event_code, title, country, currency,
impact (high|medium|low|holiday|none), event_type (indicator|event|holiday), sector, frequency,
all_day, tentative, scheduled_at (UTC), period, revision, actual, forecast, previous,
revised_previous, unit, multiplier (none|thousands|millions|billions|trillions), digits, forecast_suspect
```

Значення actual/forecast/previous записані **в одиницях `multiplier`**. Наприклад, NFP 165 при `thousands` означає 165K.

## Інструменти в репозиторії

- `tools/mt5/MQVault_CalendarExport.mq5` — скрипт MT5, лише читає дані. Пише по файлу на кожну валюту, вже вивантажені валюти пропускає, перерваний запуск продовжує з місця зупинки.
- `tools/econ-calendar/clean_calendar.py` — нормалізація: UTC, дедуплікація, `forecast_suspect`. Запуск: `python3 -I tools/econ-calendar/clean_calendar.py <папка з mqvault_cal_*.csv> <out.csv>`.

## Що вже є в БД (див. database.md)

- `news_events` (`event_time`, `impact`, `currency`, `actual/forecast/previous`, `source`, `external_id`, unique `(source, external_id)`). Дані застарілі, останні — до 25.10.
- `trade_news_links` (`trade_id`, `news_event_id`, `minutes_diff`, `relation_type`, `window_minutes`), функція `link_trades_to_news`, view `news_impact_stats` (міграція `20261022210508_live_news_support`).
- Вкладка «Календар» звертається до `/api/economic-calendar`, якого в коді немає.
- RLS без політик свідомо: доступ лише через `/api/*` із секретним ключем.

## План (по порядку, дрібними комітами)

1. **Огляд схеми.** Через Supabase MCP (`list_tables`, `execute_sql` лише на читання) зніми актуальну структуру `news_events`, `trade_news_links`, `link_trades_to_news` і `news_impact_stats`. Вирішуй, чи розширити `news_events`, чи потрібна нова таблиця. За замовчуванням **розширити** `news_events`, не дублювати.
2. **Міграція — новим файлом** у `supabase/migrations/`. Що додати: `event_code`, `country`, `event_type`, `all_day`, `tentative`, `period`, `revised_previous`, `unit`, `multiplier`, `forecast_suspect`, `license_scope`, `updated_at`; індекси `(event_time)` і `(currency, impact, event_time)`; за потреби довідник канонічних ключів подій (`event_key`) для зіставлення MT5↔FF. **Застосовувати лише після погодження власника**: спершу покажи SQL.
3. **Імпорт.** Скрипт (TS або Node у `tools/econ-calendar/`) робить upsert чистого CSV у `news_events` по `(source='mt5', external_id=source_event_id)`, пачками, ідемпотентно. Записує тільки рядки, де щось змінилось. Імпорт у production-БД теж лише після погодження.
4. **`/api/economic-calendar`** для вкладки «Календар»: діапазон дат, фільтри валют і важливості, тільки ті валюти, що є в парах користувача. Час у поясі користувача (ADR 0001), рядки через i18n (ADR 0007), телефон (ADR 0008).
5. **Новини ↔ угоди** (ROADMAP п. 4):
   - зв'язки у вікнах: позиція відкрита на момент релізу / відкрита за 30 хв до або після / закрита в межах 30 хв / в межах 2 год;
   - статистика «біля новин / без» (win rate, середній P&L, по типу події й валюті) поруч із n;
   - теги угод;
   - правило «не торгувати ±N хв навколо червоних новин» для Контролю стратегії.
   P&L до і після релізу та MFE/MAE потребують цін — це окремий етап.
6. **Пізніше (окремими пакетами):**
   - синхронізація FF через Supabase `pg_cron` + Edge Function. Vercel Cron на Hobby спрацьовує лише раз на добу, тому не підходить;
   - EA на серверному MT5 (VPS), що шле нові actual в Edge Function із серверним секретом;
   - Telegram-алерти;
   - шар провайдерів із fallback;
   - «Найближча новина» на Головній.

## Перевірки й процес

- `npm run lint` → `npx tsc --noEmit` → `npm test` → `npm run build` перед кожним push. Нові модулі `src/lib/<домен>` з тестами додавай у `scripts/run-tests.mjs`.
- Draft PR, без merge у `main` і без force-push. Після пакета онови `docs/roadmap/ROADMAP.md`; нове рішення оформи окремим ADR («Джерело економічного календаря»).
- Зміни БД, імпорт у production, merge — тільки після явного «так» власника на конкретну дію.
