# MQVault — інструкції для Claude

Приватний торговий журнал і дашборд (Next.js 15 App Router · React 19 · TypeScript · Tailwind 4 · Supabase · Vercel).
Власник пише українською — **відповідай українською**. Код, імена, коміти — англійською.

## Спершу прочитай
1. [`docs/architecture/overview.md`](docs/architecture/overview.md) — шари, карта `src/`, правила залежностей.
2. [`docs/roadmap/ROADMAP.md`](docs/roadmap/ROADMAP.md) — що зроблено, що далі, порядок робіт, стан гілок.
3. [`docs/decisions/`](docs/decisions/) — ухвалені рішення (час, сесії, фінанси, проп, видалення, акаунти й доступ, мови, адаптивність, дашборд). Не переглядай їх без запиту власника.
4. [`docs/architecture/database.md`](docs/architecture/database.md) — схема БД і застереження щодо міграцій.

## Команди
```bash
npm run dev      # локально
npm run lint     # ESLint (має бути 0 помилок)
npx tsc --noEmit # типи
npm test         # юніт-тести (scripts/run-tests.mjs компілює модулі з src/lib і запускає tests/*.test.mjs)
npm run build    # production-збірка; потрібні NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (або стара назва …_ANON_KEY), SUPABASE_SECRET_KEY — для перевірки підійдуть заглушки
```
Це саме те, що виконує CI (`.github/workflows/ci.yml`). Перед PR прожени lint → tsc → test → build.
Пісочниця без мережі не дістає Google Fonts: для `next build` задай `NEXT_FONT_GOOGLE_MOCKED_RESPONSES=<js-модуль із заглушкою>`.

## Де що лежить
`src/app` — сторінки та `/api/*` · `src/components/{tabs,overview,accounts,journal,strategy-control,home,settings,layout,providers,ui}` — UI (у `ui/` лише спільні примітиви; файл однієї фічі лежить у її теці) · `src/hooks` — клієнтські дані · `src/lib/{accounts,journal,dashboard,time,market,auth,strategy-control,i18n,supabase}` — доменна логіка · `supabase/migrations` · `tests` · `docs`.

## Жорсткі правила
- **Час.** У БД лише `timestamptz` (UTC). День/місяць/період — у поясі користувача (`@/lib/time/timezone`), ручний ввід часу угоди — у поясі брокера рахунку. Не використовуй `new Date().getDate()` і подібне для бізнес-логіки. → ADR 0001
- **Сесії** — за годинником ринків, не за поясом користувача. → ADR 0002
- **Net угоди** рахує лише сервер (`api/journal/trades`). Не дублюй формулу на клієнті. → ADR 0003
- **Мови.** Кожен видимий рядок — `t("English text")` / `tn()` / `msg()` + переклад у `src/lib/i18n/uk.ts`. Українського тексту поза словником у коді бути не повинно, тест це перевіряє. → ADR 0007
- **Адаптивність.** Новий UI одразу працює на телефоні (`useMediaQuery`/`PHONE_QUERY`). → ADR 0008
- **Тестовані модулі `src/lib/<домен>`** імпортують сусідів відносними шляхами (`../time/timezone`), не `@/…`: тести компілюють їх окремо `tsc`-ом без аліасів. Новий модуль із тестом додай у `scripts/run-tests.mjs`.
- **Користувачі.** Кожен маршрут `/api/*` починається з `resolveUser(request)` (`@/lib/auth/current-user`) і фільтрує кожен запит до таблиць користувача за `user_id = ownerId`. `user_id` ніколи не береться із запиту. Новий маршрут без `resolveUser` тест не пропустить (`tests/api-route-guard.test.mjs`); виняток — лише з поясненням у тому ж тесті. Запити — через `context.db` (токен користувача, діє RLS); `context.admin` (сервісний ключ) — лише в місцях з ADR 0018. Нова таблиця користувача: RLS + політики `user_id = (select private.current_app_user_id())` + права для `authenticated` у тій самій міграції; нова функція — `REVOKE … FROM PUBLIC`. → ADR 0017, 0018
- **`lib` не імпортує компоненти й React.** Клієнт не бачить `SUPABASE_SECRET_KEY` і не ходить у БД напряму — тільки через `/api/*`.
- **Міграції.** Вже застосовані файли не редагувати; нова зміна схеми = новий файл у `supabase/migrations/`, застосовувати лише після погодження власника. Історія файлів збігається з Supabase, але базової схеми в міграціях немає, тож `supabase db push` не запускати (див. database.md).
- **Секрети** не читати без потреби, не друкувати, не комітити. `.env*` у `.gitignore`.

## Процес роботи
- Порядок, узгоджений із власником: **спершу логіка й бекенд, потім дизайн**, наприкінці безпека/авторизація → тести → публічний запуск. Market — відкладено, без окремого запиту не чіпати.
- Гілки: `feat/…`, `fix/…`, `chore/…`, `agent/…`; від актуальної бази, дрібними кроками. **Без force-push і без merge у `main` без явного рішення власника.** PR — draft.
- Коміти — Conventional Commits англійською (`feat(journal): …`, `refactor(lib): …`). Зміна лише структури (переніс/перейменування) — окремим комітом без змін логіки.
- Після завершеного пакета роботи оновлюй `docs/roadmap/ROADMAP.md` у тому ж PR; нове рішення — окремий ADR. Статус `[x]` = зроблено в указаному обсязі, не «випущено».
- Зміни БД, зовнішні записи, merge і реліз — лише після погодження конкретної дії. Реальні рахунки для руйнівних тестів не використовувати; preview користується тією ж БД, що й production.
- Не змінюй файли активного пакета іншого агента без узгодження; перед роботою перечитай roadmap з актуальної бази.
