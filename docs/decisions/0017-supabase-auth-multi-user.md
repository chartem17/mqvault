# ADR 0017. Багатокористувацька авторизація: Supabase Auth + RLS

**Статус:** діє · **Дата:** 2026-11-10 · Замінює [ADR 0006](0006-private-access-single-password.md)

## Контекст
Сайт був приватним: один пароль `VAULT_ACCESS_PASSWORD`, власник — єдиний `app_users.is_owner`, сервер ходив у БД сервісним ключем, RLS увімкнено без політик. Для публічного запуску потрібні акаунти, ізоляція даних і захист на рівні БД, а не лише коду. Під час підготовки знайдено живу політику `dev read journal_trades` (`SELECT` для `anon`, `using (true)`): усі угоди читались публічним ключем напряму через Supabase API. Міграція її прибирає.

## Рішення
**Хто користувач.** Supabase Auth: email + пароль і Google OAuth. `app_users.id = auth.users.id` (FK `on delete cascade`); рядок профілю створює тригер `handle_auth_user` на `auth.users`. Роль «власник» із логіки прибрано (`is_owner` лишився колонкою, код її не читає), відповіді 503 «owner must be uniquely configured» більше немає.

**Перенесення наявного власника.** Старий рядок `app_users` не має auth-користувача. Коли реєструється акаунт із тим самим **підтвердженим** email, тригер змінює `id` цього рядка на новий `auth.users.id`; усі зовнішні ключі мають `on update cascade`, тож рахунки, угоди, стратегії, розкладки й пристрої Bridge переходять разом в одній транзакції. Непідтверджений email старий простір не отримує.

**Сесія.** `@supabase/ssr`, лише httpOnly-cookie (`sb-…`), `SameSite=Lax`, `Secure` у production. Браузер не має supabase-js і токенів не бачить: вхід, реєстрація, код, скидання, вихід — через `/api/auth/*`. Middleware оновлює сесію (`getUser()` — звірка з Auth-сервером на кожен запит, тож «вийти всюди» діє одразу). Підтвердження email і скидання пароля — **кодом із листа** (`verifyOtp`), без посилань: не залежить від redirect-URL і працює на preview.

**Доступ до даних — два незалежні шари.**
1. Кожен `/api/*` викликає `requireUser(request)` (`src/lib/supabase/session.ts`): користувач лише з перевіреної сесії, ніколи з тіла чи query. Запити фільтруються `.eq("user_id", userId)`.
2. Клієнт БД у цих маршрутах — з JWT користувача, тому Postgres застосовує RLS: `user_id = auth.uid()` на select/insert/update/delete для всіх таблиць користувача; `news_events`, `market_instruments` — лише читання для `authenticated`; `anon` не має жодних прав. Додатково: рядок не може посилатись на чужий рахунок (`owns_account`), профіль редагується лише в колонках налаштувань (не `id`, `email`, `is_owner`, `plan`).

**Сервісний ключ (`createServiceSupabase`) — лише тут:**
| Де | Чому без нього не можна |
|---|---|
| `/api/bridge/device/*`, `/api/bridge/pairings`, `/api/bridge/pairings/[id]`, `src/lib/bridge/server.ts` | ПК не має сесії користувача; автентифікується підписом пристрою, `user_id` береться з `bridge_devices` |
| `/api/bridge/pairings/approve` | заявка на підключення нікому не належить до підтвердження; `user_id` нового пристрою — із сесії |
| `/api/economic-calendar/sync`, `tools/econ-calendar` | запис у спільну `news_events` за машинним токеном |
| `src/lib/auth/rate-limit.ts` | лічильники спроб (`bridge_rate_limit_*`) |
| видалення акаунта (пакет профілю) | Auth admin API |

**RPC і view.** `vault_delete_entity` — security invoker, виконується від імені користувача: відмовляє, якщо `p_owner_id ≠ auth.uid()`, і RLS діє всередині. `import_news_events`, `link_trades_to_news`, `bridge_rate_limit_*` — лише `service_role`. `news_impact_stats` — `security_invoker`, показує тільки те, що користувач бачить у `journal_trades`. `list_my_sessions()` — security definer, повертає лише сесії викликача.

**MT5 Bridge.** Пристрій належить користувачеві, який підтвердив код на `/bridge/connect` (`bridge_devices.user_id` із сесії). Користувач через RLS бачить свої ПК, рахунки MT5 і сирі deals, може відкликати ПК і відповісти на «новий рахунок»; ключі, лічильник повторів, заявки й синхронізація — лише сервісний ключ.

**Скрипти.** `Authorization: Basic email:пароль` того самого акаунта, тільки для `/api/*`; вхід на один запит, нічого не зберігається, ліміт 30 / 10 хв на адресу. Правило same-origin JSON для змін діє й для Basic.

**Захист входу.** Same-origin JSON для всіх не-GET (включно з `/api/auth/*`); ліміти в БД на вхід, реєстрацію, код, повторну відправку, скидання (на пару «адреса + email» і на адресу); однакова відповідь і затримка для «немає такого email» і «неправильний пароль»; реєстрація, повторна відправка й скидання відповідають однаково незалежно від існування акаунта; після входу — лише локальний шлях (`safeNextPath`), OAuth повертається тільки на власний `/auth/callback`.

## Наслідки
- `VAULT_ACCESS_PASSWORD` і cookie `vault_session` більше не використовуються; змінну можна видалити з Vercel.
- Користувач зі своїм JWT технічно може звернутись до Supabase API напряму — і побачить та змінить лише власні рядки (зокрема власний `net_pnl`; правило «net рахує сервер» ADR 0003 стосується застосунку, а не захисту від самого себе).
- Листи з кодом потребують налаштування шаблонів Supabase (`{{ .Token }}`) і власного SMTP для обсягу понад кілька листів на годину — див. [runbooks/auth-setup.md](../runbooks/auth-setup.md).
- Preview і production ділять одну БД і одних користувачів.
- Не зроблено: CAPTCHA, MFA, privacy policy/terms, шифрування сторонніх секретів (їх поки не зберігаємо).

## Де в коді
`src/middleware.ts`, `src/lib/auth/{request-guard,auth-api,rate-limit,messages}.ts`, `src/lib/supabase/{session,server,cookie-options}.ts`, `src/app/api/auth/*`, `src/app/auth/callback`, `src/app/login`, `src/components/ui/otp-input.tsx`, міграція `20261110120000_auth_users_rls.sql`.
Тести: `tests/request-guard.test.mjs` (юніт), `tests/auth-users-rls-migration.sql` (міграція + ізоляція користувачів A/B на одноразовому Postgres, CI-джоба `auth-rls-migration`).
