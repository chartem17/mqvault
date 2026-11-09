# ADR 0013. Джерело економічного календаря: MetaTrader 5, одна таблиця подій на весь сайт

**Статус:** діє · **Дата:** 2026-11-08 (рішення власника; оформлено агентом у `feat/economic-calendar`)

## Контекст
Вкладка «Календар» і майбутній аналіз «Новини ↔ угоди» потребують історії подій з actual / forecast / previous. Стара стрічка Forex Factory (`source = 'faireconomy'`, 86 рядків до 25.10) давала лише поточний тиждень без історії й без actual. Безкоштовне джерело з повною історією з 2017 року — календар MT5 (`CalendarValueHistory*`).

## Рішення
- **Основне джерело — календар MetaTrader 5** (`source = 'mt5'`). Зараз — CSV-вивантаження скриптом `tools/mt5/MQVault_CalendarExport.mq5`, очищення `tools/econ-calendar/clean_calendar.py`, імпорт `tools/econ-calendar/import-calendar.mjs`. Далі — власний MT5 на VPS і синхронізація з сервера.
- **Запасні джерела** на майбутнє: Forex Factory weekly JSON (розклад і важливість поточного тижня, без actual), FRED/ALFRED і BLS (офіційні дані США з ревізіями), платний ліцензований провайдер (FXMacroData / FMP) — коли сайт стане публічним.
- **Одна таблиця `news_events` на весь сайт.** Події не належать користувачеві й не залежать від бріджа його угод; заповнює їх лише сервер. Таблицю розширено, а не продубльовано (міграція `20261108171403_news_events_calendar_fields`).
- **Час — UTC** (`event_time`, ADR 0001). MT5 віддає історію з поточним зсувом сервера без DST, тому UTC = server_time − поточний зсув; майбутній EA має передавати зсув разом із даними.
- **Значення** зберігаються двічі: числа (`actual_value`, `forecast_value`, `previous_value`, `revised_previous_value`) в одиницях `multiplier` — для розрахунків; текст (`actual`, `forecast`, `previous`, напр. `216K`, `0.6%`) — для показу. `previous` показує уточнене значення, якщо воно є.
- **`forecast_suspect = true`** — прогноз явно помилковий в джерелі. Рядки не видаляються, але не беруть участі в «сюрпризі» (`calendarSurprise` повертає `null`).
- **Ліцензія.** Дані MT5 і FF — лише для приватного використання: кожен рядок має `source` і `license_scope` (`private` | `public_ok`, за замовчуванням `private`). Публічний сайт не показує `private`-рядки; для живої стрічки там — офіційний віджет MQL5 без змін коду.
- **Репозиторій публічний:** сирі й чисті CSV календаря не комітяться (`.gitignore`: `mqvault_cal*.csv`, `mqvault_calendar*.csv`, `tools/econ-calendar/data/`).
- **Запис лише сервером:** RPC `import_news_events(jsonb)` виконується тільки `service_role`; пише рядок лише тоді, коли щось змінилось, тож повторний імпорт нічого не чіпає.
- API `/api/economic-calendar` за замовчуванням віддає лише `source = 'mt5'` (старі FF-рядки не дублюють події) і лише валюти пар власника (`scope=mine`).

## Наслідки
- Синхронізація нових actual потребує окремого пакета: Supabase `pg_cron` + Edge Function або EA на VPS із серверним секретом (Vercel Cron на Hobby — раз на добу, не підходить).
- Зіставлення подій між джерелами (MT5 ↔ FF) — через довідник канонічних ключів подій, коли з'явиться друге джерело; зараз `event_code` + `source_series_id` MT5.

## Де в коді
`supabase/migrations/20261108171403_news_events_calendar_fields.sql`, `src/lib/news/economic-calendar.ts`, `src/app/api/economic-calendar/route.ts`, `tools/econ-calendar/`; тести `tests/economic-calendar.test.mjs`, `tests/news-events-calendar-migration.sql` (CI, одноразовий Postgres).
