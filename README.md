# MQVault

Приватний торговий журнал і дашборд: облік угод за кількома рахунками (особисті й проп), аналітика, контроль торгової стратегії.

**Стек:** Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Supabase (Postgres) · Vercel.

## Команди

```bash
npm run dev     # локальний сервер
npm run lint    # ESLint
npm test        # юніт-тести (компілює потрібні модулі й запускає tests/*.test.mjs)
npm run build   # production-збірка
```

CI (`.github/workflows/ci.yml`) на кожен PR у `main`: lint, типи, тести, build і перевірка SQL-міграції проп-правил на тимчасовому Postgres.

## Структура

```
src/
  app/            сторінки та API (api/accounts, journal, strategies, preferences, deletions, …)
  middleware.ts   приватний доступ для всіх сторінок і API: сторінка /login, після входу cookie на 30 днів
  components/
    tabs/         вкладки: overview, journal, strategy-control, market, calendar
    journal/      форма угоди
    accounts/     форми рахунків і проп-умов
    settings/     часовий пояс
    providers/    контексти (часовий пояс)
    ui/           спільні примітиви: кнопки, поля, модалки, картки
  hooks/          дані: use-trades, use-journal-layout, use-strategies, …
  lib/            чиста логіка: сесії, час, фільтри, статистика, проп-правила, strategy-control
supabase/migrations/  SQL-міграції
tests/                юніт-тести логіки
docs/                 roadmap і специфікації
```

## Ключові правила

- **Час.** У БД — лише абсолютні моменти (`timestamptz`, UTC). Показ, дні календаря, денний/місячний P&L і періоди рахуються в поясі користувача (`app_users.timezone`, перемикач у шапці). Час, введений вручну у формі угоди, читається в поясі брокера рахунку (`accounts.broker_timezone`).
- **Сесії** (`src/lib/time/sessions.ts`) прив'язані до годинника самих ринків: Asia з 18:00 Нью-Йорка, Frankfurt 08:00 Франкфурта, London 08:00 / lunch 10:00 / after lunch 12:00 Лондона, New York 08:00 Нью-Йорка, Off hours з 16:00 Нью-Йорка. Від поясу користувача не залежать.
- **Фінанси угоди** (сервер, `src/app/api/journal/trades/route.ts`): `net = gross − |commission| − |fee| + swap`. Комісія й fee — додатні витрати, swap зі знаком. Брокерський результат не перераховується з ціни й лотів.
- **Доступ.** Один пароль `VAULT_ACCESS_PASSWORD` (≥20 символів). Вхід на `/login` ставить httpOnly-cookie (`vault_session`, підпис HMAC від пароля, 30 днів); зміна пароля розлогінює всіх. Basic-auth лишається для скриптів. Зміни (не GET) приймаються лише same-origin JSON.
- **Видалення** відкладене: 10 секунд на Undo, лише потім DELETE (`docs/UNDO-DELETION-CHECKLIST.md`).
- **Проп-правила:** `docs/prop-rules-v1.md`, `docs/prop-rules-integration.md`.

## Документи

- `docs/ROADMAP.md` — що зроблено, що далі, порядок робіт.
