# ADR 0018. Ізоляція користувачів у самій БД: RLS як другий шар

**Статус:** прийнято власником 2026-11-11 (застосування міграції — окреме погодження) · Доповнює [ADR 0017](0017-user-accounts-supabase-auth.md), змінює його пункт «політики RLS не додаємо».

## Контекст
За ADR 0017 ізоляцію тримав один шар — код: кожен маршрут бере `ownerId` з `resolveUser` і фільтрує запити `user_id`, а сервер ходить у БД сервісним ключем, який оминає RLS. Одна забута умова `.eq("user_id", …)` у новому маршруті віддала б чужі дані. Власник вирішив: ізоляція має бути «прописана в БД», без можливості витоку навіть через помилку в коді.

## Рішення
- **Маршрути ходять у БД токеном користувача.** `resolveUser` повертає `db` — клієнт із сесійним JWT (роль `authenticated`), і окремо `admin` — сервісний клієнт. Фільтр `user_id` у коді лишається (перший шар), RLS — другий, незалежний.
- **Хто викликає — визначає БД:** `current_app_user_id()` (security definer) перекладає `auth.uid()` у `app_users.id` через `auth_user_id`. Користувач без робочого простору не бачить нічого.
- **Політики** (міграція `20261112110000_rls_user_isolation.sql`):
  - таблиці з `user_id` — select/insert/update/delete лише свої рядки; посилання на рахунок (`account_id`, `parent_account_id`) — лише на власний (`owns_account`);
  - `app_users` — читати свій рядок; змінювати лише `display_name`, `timezone`, `locale`, `country_code`, `preferences` (не `email`, `auth_user_id`, `is_owner`);
  - `trade_news_links` — через власну угоду; `news_impact_stats` — `security_invoker`;
  - `news_events` — читає лише власник (ліцензія даних календаря, ADR 0013/0017); `market_instruments` — усі, хто увійшов, лише читання;
  - Bridge: свої ПК (без колонок `public_key`, `last_seq`), рахунки MT5 і сирі deals; змінювати — лише `revoked_at` і відповідь «це проп?»;
  - `bridge_orders`, `bridge_positions`, `bridge_pairings`, `bridge_rate_limits`, `beta_invites` — явна заборона для `anon`/`authenticated`;
  - прибрано залишок розробки `dev read journal_trades` (читати всі угоди), який став би діркою після видачі прав.
- **`vault_delete_entity`** виконується від імені користувача: відмовляє, якщо `p_owner_id` ≠ `current_app_user_id()`; RLS діє всередині.
- **Сервісний ключ лишається лише тут:** пристрої Bridge і підключення (підпис пристрою, немає сесії), синхронізація календаря (машинний токен), лічильники лімітів, створення/прив'язка робочого простору під час входу, Auth admin API (аватар, видалення акаунта), список сесій (`list_auth_sessions`), видалення рядка профілю.

## Наслідки
- **Порядок розгортання:** спершу міграції `20261112100000_user_preferences` і `20261112110000_rls_user_isolation`, потім код. Код без міграції отримає «немає прав» на кожному запиті. Чинний код (`main`, `feat/user-auth`) від міграції не ламається: сервісний ключ оминає RLS.
- Нова таблиця користувача: RLS + чотири політики `user_id = current_app_user_id()` + права для `authenticated` у тій самій міграції; без цього маршрути її не побачать (і це безпечна відмова).
- Advisors більше не показують «RLS без політик» для таблиць користувача.

## Де в коді
`src/lib/auth/current-user.ts` (`resolveUser` → `db`, `admin`), `src/lib/supabase/permanent-delete.ts`, маршрути з `context.admin`: `api/profile`, `api/profile/sessions`, `api/bridge/pairings/approve`. Тест: `tests/rls-user-isolation.sql` (ланцюжок міграцій на одноразовому Postgres; користувач B проти A, `anon`, користувач без простору), CI-джоба `rls-isolation`.
