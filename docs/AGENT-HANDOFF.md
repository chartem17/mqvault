# AGENT-HANDOFF — Trade Vault / mqvault

Документ для агентів, які працюють над репозиторієм після першого аудиту.
Дата аудиту: 2026-10-30. Baseline: `c9f3dba6aad073096351ff1ee11ad59cf3e771bf` (`feat/undo-delete-current`).
Гілка аудиту: `agent/docs-handoff` (лише документація, production-код не змінено).

Позначки: **[факт]** — підтверджено читанням коду в цьому репозиторії; **[з handoff]** — зі слів власника/першого агента, у коді не перевірено; **[питання]** — потрібні метадані БД або рішення власника.

Що НЕ перевірялося: `npm ci`, `npm run lint`, `npx tsc --noEmit`, `npm run build`, тести з CI, браузер, живий Supabase. Усе нижче — результат читання файлів.

## 1. Правила співпраці (скорочено)

- Працювати в `agent/<назва>` від `origin/feat/undo-delete-current`, draft PR у цю ж гілку. Без force-push, `reset --hard`, самостійного merge. `main` не є актуальним джерелом.
- Без окремого погодження не чіпати: Supabase schema/migrations/RPC/RLS/grants; авторизацію, middleware, owner resolution; механізм видалення й Undo; MT5-облік, часові перетворення, фінансові формули; prop-пакет першого агента.
- Зайняті модулі (читати можна, змінювати ні): `src/lib/prop-rule-*`, `src/app/api/accounts/`, `src/components/accounts/`, `src/components/tabs/overview-tab.tsx`, `supabase/migrations/`, пов'язані prop-тести й workflows.
- Не змінювати глобальні шрифти, layout, теми, залежності «заодно».

## 2. Архітектура [факт]

**Стек (package.json):** Next.js 15.3.3 (App Router), React 19, TypeScript 5, Tailwind CSS 4, ESLint 9, `@supabase/supabase-js` ^2.117.2, next-themes, lucide-react, ogl. Скрипти: лише `dev`, `build`, `start`, `lint`. Універсального `npm test` немає.

**Оболонка:** `src/app/page.tsx` — один клієнтський компонент, вкладка вибирається через `useState<TabId>`: overview, journal, strategy-control, market, calendar, news, screenshots. Окремих URL для вкладок немає.

**Провайдери (`src/app/layout.tsx`):** `ThemeProvider` → `TimezoneProvider` → `UndoProvider` → `TradesProvider`. Тема за замовчуванням dark, `enableSystem={false}`.

**Потік даних:** компонент → хук (`use-trades.tsx`, `use-strategies.tsx`, `use-mt5.ts`) → `fetch` до `/api/*` → серверний Supabase-клієнт (`SUPABASE_SECRET_KEY`).

**Тести:** `tests/*.test.mjs` (Node `--test`) компілюють чисті TS-модулі з `src/lib` через `tsc` у `.tmp-*` каталоги; SQL-тест міграції — `tests/prop-rule-settings-migration.sql` (у CI проти тимчасового PostgreSQL 17). Каталоги `.tmp-*` у `.gitignore` не перелічені.

## 3. API-карта і власник [факт]

`src/middleware.ts` працює на всіх шляхах, окрім `_next/static`, `_next/image`, `favicon.ico`. Спочатку `checkPrivateAccess` (`src/lib/private-access.ts`): HTTP Basic `owner:<VAULT_ACCESS_PASSWORD>` (пароль ≥ 20 символів, порівняння через SHA-256), для не-GET/HEAD/OPTIONS — ще збіг `Origin` з `VAULT_SITE_ORIGIN` (або з URL запиту) і `Content-Type: application/json`.

Далі middleware **переписує** `DELETE /api/accounts` → `/api/deletions?kind=account` та `DELETE /api/journal/trades` → `/api/deletions?kind=trade`.

| Роут | Методи | Як визначається власник |
|---|---|---|
| `/api/accounts` | GET POST PATCH DELETE (реекспорт з `src/lib/account-api.ts`) | `resolvePrivateOwner` (GET/POST/PATCH). DELETE через middleware потрапляє в `/api/deletions`, а не сюди |
| `/api/accounts/[id]/prop-rules` | GET PATCH | `resolvePrivateOwner` |
| `/api/strategies` | GET POST PATCH DELETE | `resolvePrivateOwner`; DELETE **не** переписується middleware (хук викликає `/api/strategies` напряму) |
| `/api/journal/trades` | GET POST PATCH DELETE | власна `getOwnerId()` у файлі: `is_owner = true`, `limit(1).maybeSingle()`, без перевірки унікальності |
| `/api/deletions` | DELETE (`kind`: trade/account/strategy) | власний пошук власника (`owners[0].id`) → `permanentlyDeleteOwnedEntity` → RPC `vault_delete_entity` |
| `/api/news` | GET | читає `news_events` і `trade_news_links` через серверний клієнт; фільтра по `user_id` у коді не знайдено |
| `/api/instruments` | GET | `market_instruments`, `is_active = true`, без власника |
| `/api/market/quotes` | GET | зовнішні котирування (`TWELVE_DATA_API_KEY` у `src/lib/market-live.ts`) |
| `/api/mt5/health\|positions\|history` | GET | проксі на `http://127.0.0.1:8787` (жорстко в коді) |

`resolvePrivateOwner` (`src/lib/supabase/private-owner.ts`) вимагає рівно одного `is_owner = true`, інакше 503. Інші варіанти (таблиця вище) цієї суворості не мають.

## 4. Застаріле та розбіжності [факт]

1. **`src/lib/supabase/types.ts`** — `DbJournalTradeRow` використовує `source_type`, `pnl_usd`, `pnl_r`, `status`; фактична таблиця має `source`, `net_pnl`, `result_r` (див. `docs/schema-snapshot.md`). Імпортів цього файлу в `src/` не знайдено — тобто тип зараз нікому не шкодить, але й нічого не перевіряє.
2. **`src/lib/supabase/client.ts`** читає `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, тоді як у handoff і CI-плейсхолдерах фігурує `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Імпортів `client.ts` у `src/`, `tests/`, `scripts/` не знайдено. Також у коді є `TWELVE_DATA_API_KEY`, якого немає у списку env із handoff.
3. **`AccountStatus`** у `src/lib/account-data.ts` містить `archived`, а CHECK у БД дозволяє лише `active/passed/failed` (за snapshot).
4. **Залежності без імпортів у `src/`** (grep по `from "…"`): усі `@radix-ui/*`, `cmdk`, `class-variance-authority`, `react-calendar-heatmap`. `components.json` (shadcn) є, але shadcn-примітивів у `src/components/ui/` немає. Імпортуються лише `next-themes`, `lucide-react`, `ogl`. (`clsx`, `tailwind-merge` не перевіряв.)
5. **Шрифти:** `globals.css` задає Manrope / Cabinet Grotesk / JetBrains Mono лише іменами в токенах. `next/font`, `@font-face`, `<link>` у `src/` немає, каталогу `public/` немає. `@import` Google Fonts є тільки в `src/lib/trade-data.html` (Inter, JetBrains Mono). Тобто за кодом ці шрифти не завантажуються (у браузері не перевірено).
6. **`<html lang="en">`** у `layout.tsx`, хоча інтерфейс українською.
7. **Часовий пояс користувача** зберігається в `localStorage` (`vault.timezone`, `src/components/providers/timezone-provider.tsx`), хоча в `app_users` є колонка `timezone`. Між собою вони не синхронізуються (за кодом).

**ROADMAP.md (дата 2026-10-29) частково застарів:**

| Пункт | Стан |
|---|---|
| Етап 2.1 (вибір «Особистий/Проп», форма, збереження) — усі `[ ]` | За handoff і кодом (`new-account-modal.tsx`, `account-setup.ts`, міграція `20261029220000_account_min_trading_days.sql`) реалізовано; браузерна приймальна перевірка не підтверджена |
| Етап 2.2 (прогрес і ліміти) | Частково: `account-overview.ts`, `prop-rule-settings.ts`, `account-rules-card.tsx`; EOD trailing-межа свідомо «недоступна» без підтвердженої історії |
| Етап 1: «локалізація часу сесій під часовий пояс користувача» | Є `TimezoneProvider` і `TimezoneSelect`; чи застосовується до відображення сесій — не перевірено |
| Редактор prop-умов, `/api/accounts/[id]/prop-rules`, `expectedRevision` | У ROADMAP відсутні (з'явилися в `c9f3dba`) |

Оновлювати ROADMAP — за погодженням, це не робилось.

## 5. Ризики, помічені під час аудиту

1. **`.github/workflows/finalize-dates.yml`** має `contents: write`, на push у `feat/undo-delete-current` (за зміни `scripts/finalize-dates.mjs` або самого файлу) застосовує текстові заміни в двох компонентах, комітить і пушить у цю гілку, а потім вручну створює check-run зі `success` через `gh api`. Перед цим є blob-хеші й тести, але це саме той клас автоматизації, який власник заборонив для нових workflow. Рішення (залишити/видалити) — за власником і першим агентом; я не змінював.
2. **`trade-vault.zip`** (≈297 КБ) закомічений у корінь. Список вмісту показує повний каталог `trade-vault/.git/` зі станом на 2026-08-25. Файл я не розпаковував. Стара git-історія в архіві може містити застарілі файли або секрети — варто перевірити власнику й, імовірно, прибрати з репозиторію окремою погодженою задачею.
3. У корені закомічені `tsconfig.tsbuildinfo` (≈170 КБ) і дубль `(2).gitignore`; `README.md` має 9 байт. Це гігієна репозиторію, не блокер.
4. **MT5:** `BRIDGE_URL = "http://127.0.0.1:8787"` жорстко прописаний у `/api/mt5/*`. Працює лише коли Next-сервер запущений на тій самій машині, що й міст; на віддаленому хостингу буде «bridge offline».
5. **Два шляхи DELETE для рахунків:** `account-api.ts` має власний DELETE, але middleware переписує запит на `/api/deletions`. Для відкритого багу видалення рахунку це місце варто враховувати при наскрізній перевірці (причину бага я не встановлював).
6. **Непослідовне визначення власника** (розділ 3): три різні реалізації, лише одна вимагає унікального власника. Для приватного режиму це не дірка, але для багатокористувацького переходу це база для уніфікації.
7. **`/api/news` через серверний ключ без фільтра власника.** Колонки `user_id` у `trade_news_links` за snapshot немає, тож ізоляція мала б іти через `trade_id → journal_trades.user_id`. Чи це зроблено в запиті — окремо не розбирав. [питання]
8. **CI:** у прочитаних workflow `lint` запускається на переліку файлів, а не на всьому проєкті; повного `npm run lint` у CI я не бачив.

## 6. Факти / припущення / питання

**Факти** — розділи 2–5.

**Припущення (не підтверджені, не покладатися):**
- Що `trade_news_links` фільтрується за власником у `/api/news`.
- Що RLS-політики таблиць коректно ізолюють дані (snapshot каже лише, що RLS увімкнено).
- Що `FIELDS`/payload API-контракту повністю збігаються з колонками snapshot (звіряв вибірково).

**Питання, що потребують доступу до БД або рішення (до першого агента / власника):**
1. Фактичні політики RLS, grants і визначення `vault_delete_entity` — для розбору бага видалення рахунку.
2. `ON DELETE` поведінка FK між `accounts`, `journal_trades`, `strategy_rules`, `strategy_checks`, `trade_news_links`.
3. Метадані `broker_symbols` і `market_instruments` (snapshot їх не розписує).
4. Чи застосована міграція `20261030200500_prop_rule_settings_v1.sql` (за handoff — ні).
5. Чи видаляти `finalize-dates.yml`, `trade-vault.zip`, `tsconfig.tsbuildinfo`, `(2).gitignore`.
6. Яку назву публічного ключа Supabase вважати правильною (`PUBLISHABLE_KEY` чи `ANON_KEY`) і чи потрібен `client.ts` взагалі.
7. Де фактично видаляються стратегії: `/api/strategies` DELETE чи `/api/deletions?kind=strategy` (в `strategies/route.ts` не перевіряв, чи він викликає `permanentlyDeleteOwnedEntity`).

## 7. Рекомендована наступна задача (поза зайнятими модулями)

**E-аудит: Новини / Календар / Market / Screenshots — лише документація** (етап E роудмапа).
Файли: нові `docs/AUDIT-NEWS-CALENDAR-MARKET.md`; production-код не змінюється.
Читати: `src/components/tabs/{news,calendar,market,screenshots}-tab.tsx`, `src/app/api/{news,instruments,market/quotes}/route.ts`, `src/lib/{economic-events,trade-news-links,market-live,market-watchlist,instruments}.ts`, `src/hooks/use-{instruments,live-prices,market-quotes}.ts`.

Критерій готовності:
- для кожної вкладки: джерело даних, ендпоінт, змінні середовища, обробка loading/error/empty станів, наявність демо/фальшивих даних (так/ні з файлом і рядком);
- як обробляються часові пояси для майбутніх подій і зв'язки новина↔угода (вікно, `currency_match`, `window_minutes`);
- окремо: перевірка власного/чужого scope в `/api/news` (питання 7 вище);
- список питань, що потребують БД/рішення власника (Market: лишати чи прибирати; Screenshots: окремий таб чи частина журналу; News → Telegram);
- жодних змін у `src/`, `supabase/`, `.github/`.
