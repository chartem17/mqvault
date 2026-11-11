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

## Змінні середовища

`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SECRET_KEY` (лише сервер). Значення не зберігаються в репозиторії.

## Структура

```
src/
  app/            сторінки та API (/api/accounts, journal/trades, strategies, preferences, deletions, …)
  components/     tabs · overview · accounts · journal · strategy-control · home · settings · layout · providers · ui
  hooks/          клієнтські дані: use-trades, use-strategies, use-dashboard-layout, …
  lib/            доменна логіка: accounts · journal · dashboard · time · market · auth · strategy-control · i18n · supabase
supabase/migrations/  SQL-міграції
tests/                юніт-тести логіки
docs/                 документація (індекс нижче)
CLAUDE.md             інструкції для Claude та правила роботи в репозиторії
```

Докладна карта, шари й правила залежностей — [`docs/architecture/overview.md`](docs/architecture/overview.md).

## Ключові правила

Час і пояси, сесії, фінанси угоди, проп-рахунки, відкладене видалення, приватний доступ, мови, адаптивність і дашборд описані окремими рішеннями в [`docs/decisions/`](docs/decisions/).

## Документація

- [`docs/README.md`](docs/README.md) — індекс і правила ведення документації.
- [`docs/architecture/`](docs/architecture/) — архітектура коду та база даних.
- [`docs/decisions/`](docs/decisions/) — ухвалені рішення (ADR).
- [`docs/features/`](docs/features/) — проп-рахунки, видалення з Undo, мови.
- [`docs/roadmap/ROADMAP.md`](docs/roadmap/ROADMAP.md) — що зроблено, що далі, порядок робіт.
- [`docs/runbooks/`](docs/runbooks/) — ручні приймальні перевірки.
- [`docs/archive/`](docs/archive/) — історичні журнали.
