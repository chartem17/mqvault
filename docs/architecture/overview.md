# Архітектура MQVault

Приватний торговий журнал і дашборд: облік угод по кількох рахунках (особисті й проп), аналітика, контроль торгової стратегії.

**Стек:** Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Supabase (Postgres) · Vercel.

## Шари і напрямок залежностей

```
 браузер ─►  src/app (сторінки)  ─►  src/components  ─►  src/hooks  ─►  /api/*  ─►  src/lib/supabase  ─►  Postgres
                                          │                  │              │
                                          └──────────────────┴──────────────┴──►  src/lib/<домен>  (чиста логіка)
```

| Шар | Де | Відповідальність |
|---|---|---|
| Маршрути | `src/app/` | Єдина сторінка `/` із вкладками (`?tab=`), `/journal` (редирект-обгортка для посилань на угоди), `/login`; усі серверні ендпоінти в `src/app/api/` |
| Доступ | `src/middleware.ts`, `src/lib/auth/` | Сесія Supabase Auth для всіх сторінок і API, крім сторінок входу й машинних ендпоінтів; `resolveUser()` визначає користувача в кожному маршруті (див. [ADR 0017](../decisions/0017-user-accounts-supabase-auth.md)); перенаправляє `DELETE /api/accounts` і `DELETE /api/journal/trades` на `/api/deletions`. Виняток — `TOKEN_PATHS` (`POST /api/economic-calendar/sync`, власний токен, [ADR 0015](../decisions/0015-calendar-sync-from-owner-mt5.md)) |
| UI | `src/components/` | Екрани-вкладки (`tabs/`), фічі (`overview/`, `accounts/`, `journal/`, `strategy-control/`, `home/`, `settings/`), каркас (`layout/`), контексти (`providers/`), спільні примітиви (`ui/`) |
| Стан і дані на клієнті | `src/hooks/` | `use-trades` (угоди й рахунки), `use-strategies`, `use-dashboard-layout`, `use-journal-layout`, `use-instruments`, `use-market-quotes`, `use-mt5` (вимкнений), `use-media-query` |
| Доменна логіка | `src/lib/<домен>/` | Чисті функції без React: розрахунки, парсинг, правила. Тут живуть тести |
| Сервер → БД | `src/lib/supabase/` | `createServerSupabase()` (сервісний ключ, тільки на сервері), `auth-server.ts` (клієнт Supabase Auth із httpOnly-cookies, лише для `auth.*`), видалення, типи |

### Правила залежностей

- `src/lib` **не імпортує** `src/components` і React. Єдині зв'язки назовні: `import type { JournalTrade }` з `hooks/use-trades` (`journal/advanced-stats`, `journal/utils-trade`, `strategy-control/trade-adapter`) і `NextResponse` і `next/headers` у серверних хелперах (`accounts/account-api`, `auth/current-user`, `auth/auth-api`, `supabase/auth-server`).
- Модулі в `src/lib/<домен>`, які покриті юніт-тестами, імпортують сусідів **відносними шляхами** (`../time/timezone`), а не `@/…`: тести компілюють їх окремо через `tsc` без `tsconfig`-аліасів (`scripts/run-tests.mjs`).
- `src/components/ui/` — лише спільні примітиви, що використовуються в кількох фічах. Файл, потрібний одній фічі, лежить у теці цієї фічі.
- Клієнт ніколи не бачить `SUPABASE_SECRET_KEY` і напряму БД не викликає: усе через `/api/*`.

## Карта `src/`

```
src/
  app/
    page.tsx, layout.tsx, globals.css, typography.css
    login/, signup/, forgot-password/, reset-password/   вхід, реєстрація, скидання й зміна пароля
    auth/{callback,confirm}/   повернення з листа або Google (створюють сесію)
    journal/          сторінка-обгортка для посилань «відкрити ці угоди в журналі»
    api/
      accounts/                 CRUD рахунків;   accounts/[id]/prop-rules — умови проп-рахунку (GET/PATCH, expectedRevision)
      journal/trades/           угоди
      strategies/               правила стратегій
      deletions/                відкладене остаточне видалення (RPC), сюди middleware перенаправляє DELETE
      preferences/              timezone, journal-layout, dashboard-layout
      auth/                     login, signup, reset, password, logout, google
      me/                       хто увійшов і які розділи бети йому доступні
      instruments/, market/quotes/, news/     ринок, котирування, економічні новини
      mt5/{health,history,positions}/         виведені з експлуатації (повертають відповідь про retirement)
  components/
    tabs/             home, overview, journal, strategy-control, market, calendar — по одній вкладці
    overview/         віджети та сітка кастомізованого дашборду, їхні стилі й картки
    accounts/         перемикач рахунків, форма нового рахунку, картки умов і гілки проп-рахунків
    journal/          форма ручної угоди
    strategy-control/ конструктор стратегії і спільні контроли Strategy Control
    home/             круговий «день» (day-dial)
    settings/         мова, часовий пояс
    layout/           каркас застосунку, навігація
    providers/        theme, i18n, timezone
    ui/               примітиви: Button/Input/Select/Panel, Field, Checkbox, DateTimeField, діалоги, Undo-тости, MetricCard
  hooks/              див. таблицю вище
  lib/
    accounts/         модель рахунку, парсинг/валідація, гілки Phase1→2→Funded, Overview-розрахунки, умови проп
    journal/          фільтри, фокус за ID, розкладка колонок, статистика (drawdown, R), форматування угод
    dashboard/        розкладка і реєстр віджетів, «Сьогодні», круговий день
    time/             пояс користувача, торгові сесії, календарні періоди
    market/           інструменти, котирування, watchlist, retirement MT5
    news/             економічний календар (CSV MT5 → news_events, значення, «сюрприз») і зв'язки угод із новинами
    auth/             правила доступу й CSRF, поточний користувач, створення робочого простору, ліміти входу
    strategy-control/ рушій правил, бібліотека правил, збереження, адаптер угод
    i18n/             словник і ядро локалізації (en за замовчуванням, uk)
    supabase/         серверний клієнт, власник, видалення, типи
    utils.ts          cn() та дрібні утиліти
supabase/migrations/  SQL-міграції (див. [database.md](database.md))
tests/                юніт-тести логіки (`npm test`)
scripts/run-tests.mjs єдина точка запуску тестів
docs/                 ця документація
```

## Вкладки

`home` (за замовчуванням) · `overview` · `journal` · `strategy-control` · `market` · `calendar`. Активна вкладка живе в URL (`?tab=`), посилання з `focusTradeIds` завжди відкривають журнал. Невідомі значення `?tab=` падають на `home`. Статус кожної вкладки — у [roadmap](../roadmap/ROADMAP.md).

## Ключові правила (деталі — в ADR)

| Тема | Правило | ADR |
|---|---|---|
| Час | У БД лише абсолютні моменти (`timestamptz`, UTC). День/місяць/період — у поясі користувача; ручний ввід часу угоди — у поясі брокера рахунку | [0001](../decisions/0001-time-and-timezones.md) |
| Сесії | Прив'язані до годинника самих ринків, від пояса користувача не залежать | [0002](../decisions/0002-sessions-follow-market-clocks.md) |
| Фінанси угоди | `net = gross − |commission| − |fee| + swap`, рахує сервер; брокерський результат не перераховується | [0003](../decisions/0003-trade-financials.md) |
| Проп-рахунки | Лише ціль, ліміти збитку, мінімум днів, фаза; без EOD/trailing; гілки через `parent_account_id` | [0004](../decisions/0004-prop-rules-simplified.md) |
| Видалення | 10 с на Undo, потім остаточне видалення; не soft delete і не кошик | [0005](../decisions/0005-deferred-deletion-with-undo.md) |
| Доступ | Акаунти Supabase Auth; сесія лише на сервері; кожен запит — у межах `user_id` поточного користувача; закрита бета за запрошеннями | [0017](../decisions/0017-user-accounts-supabase-auth.md) |
| Мови | English за замовчуванням, українська — друга | [0007](../decisions/0007-interface-languages.md) |
| Адаптивність | Сайт повноцінно працює на телефонах і будь-якому екрані | [0008](../decisions/0008-responsive-layout.md) |
| Дашборд | Користувач сам збирає сітку віджетів у «Огляді» | [0009](../decisions/0009-customizable-overview-dashboard.md) |

## Середовище

Змінні: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (або стара назва `…_ANON_KEY`), `SUPABASE_SECRET_KEY` (лише сервер), `VAULT_SITE_ORIGIN`; необов'язкові `AUTH_SIGNUP_MODE`, `NEXT_PUBLIC_AUTH_GOOGLE`, `CALENDAR_SYNC_TOKEN` (повний перелік — [runbooks/user-auth-rollout.md](../runbooks/user-auth-rollout.md)). Значень у репозиторії немає; `.env*` у `.gitignore`.

Деплой: Vercel, проєкт підключений до цього репозиторію. Production-гілка — `main` (перевірити в налаштуваннях Vercel, див. roadmap). База: Supabase, проєкт `mqvault-dev`. Preview-деплої користуються тією самою БД, тому не ізолюють дані.

CI (`.github/workflows/ci.yml`) на кожен PR у `main` і push у `main`: lint → типи (`tsc --noEmit`) → `npm test` → `npm run build`; окремо — SQL-міграції (проп-правила, календар, акаунти) на тимчасовому Postgres 17.
