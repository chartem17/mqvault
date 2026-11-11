# Налаштування входу (ручні кроки власника)

До [ADR 0017](../decisions/0017-supabase-auth-multi-user.md). Проєкт Supabase: `mqvault-dev` (`kxaltiplgxthkjyarwnj`).
Порядок безпечний для чинного production: міграція сумісна зі старим кодом, тому спершу БД і налаштування, потім деплой.

## 1. Міграція
`supabase/migrations/20261110120000_auth_users_rls.sql` — застосовується лише після погодження власника.

## 2. Supabase → Authentication
1. **Sign In / Providers → Email:** увімкнено; *Confirm email* — **увімкнено** (без цього чужа адреса могла б увійти без підтвердження); *Email OTP length* — **6**; *Email OTP expiration* — 600–3600 с; *Secure password change* — на розсуд (застосунок сам питає поточний пароль).
2. **Emails → Templates:** у шаблонах **Confirm signup** і **Reset password** показати код: `{{ .Token }}` (наприклад: «Ваш код: {{ .Token }}»). Посилання `{{ .ConfirmationURL }}` можна прибрати — застосунок ним не користується.
3. **Emails → SMTP:** вбудована пошта Supabase обмежена кількома листами на годину й призначена для тестів. Для реальних користувачів підключити власний SMTP (Resend, Postmark, SES…).
4. **URL Configuration:** *Site URL* — `https://mqvault.vercel.app`. *Redirect URLs*:
   - `https://mqvault.vercel.app/auth/callback`
   - `https://*-<slug-команди-vercel>.vercel.app/auth/callback` — preview-деплої (точний шаблон видно в адресі будь-якого preview);
   - `http://localhost:3000/auth/callback` — локальна розробка.
5. **Sign In / Providers → Google:** увімкнути, вставити Client ID і Client secret із кроку 3.
6. (Бажано) **Attack Protection:** leaked-password protection; CAPTCHA — коли з'являться сторонні користувачі.

## 3. Google Cloud → APIs & Services
1. **OAuth consent screen:** External; назва, email підтримки; scopes `openid`, `email`, `profile`; поки застосунок у режимі Testing — додати свою адресу в Test users, для всіх — Publish.
2. **Credentials → Create credentials → OAuth client ID → Web application:**
   - *Authorized JavaScript origins:* `https://mqvault.vercel.app`
   - *Authorized redirect URIs:* `https://kxaltiplgxthkjyarwnj.supabase.co/auth/v1/callback` (саме адреса Supabase, не сайту).
3. Скопіювати Client ID і Client secret у Supabase (крок 2.5). Секрет у репозиторій і чат не вставляти.

## 4. Vercel → Settings → Environment Variables
| Змінна | Середовища | Примітка |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production **і Preview** | тепер потрібні й middleware |
| `SUPABASE_SECRET_KEY` | Production і Preview | Bridge, календар, ліміти, видалення акаунта |
| `CALENDAR_SYNC_TOKEN` | Production | без змін |
| `VAULT_SITE_ORIGIN` | не задавати для Preview | якщо задано — лише Production, рівно `https://mqvault.vercel.app` |
| `VAULT_ACCESS_PASSWORD` | видалити після деплою | більше не читається |

Після зміни змінних — Redeploy.

## 5. Перший вхід власника
Зареєструватися (або «Continue with Google») **з тим самим email, що в наявному рядку `app_users`**. Після підтвердження адреси всі рахунки, угоди, стратегії, розкладки й ПК Bridge автоматично стають вашими. Перевірка (SQL, лише читання):
```sql
select (select count(*) from app_users a join auth.users u on u.id = a.id) linked,
       (select count(*) from app_users a where not exists (select 1 from auth.users u where u.id = a.id)) unlinked;
```
Коли `unlinked = 0`: `alter table public.app_users validate constraint app_users_id_auth_fkey;` (окреме погодження).

## 6. Скрипти з Basic-auth
`curl -u 'email:пароль' https://mqvault.vercel.app/api/accounts` — облікові дані того самого акаунта. Працює для акаунтів із паролем (для Google-акаунта спершу задати пароль у налаштуваннях).
