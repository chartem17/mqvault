# Безпека сайту — ручні кроки власника

Код уже готовий (пакет 3, `feat/shell-profile-v2`); тут лише те, що вмикається в панелях сервісів.

## 1. Cloudflare Turnstile — перевірка «я не робот» на входi, реєстрації, скиданні пароля й повторній відправці коду

Порядок важливий: спершу ключ у Vercel і деплой, **потім** увімкнення в Supabase. Інакше вхід перестане працювати.

1. dash.cloudflare.com → ліве меню **Turnstile** (або Application security → Turnstile) → **Add widget**.
2. Widget name: `MQVault`. Hostnames → Add: `mqvault.vercel.app` і `vercel.app` (друге — для preview-адрес). Widget mode: **Managed**. Pre-clearance: No. → **Create**.
3. Скопіювати **Site Key** і **Secret Key** (секрет нікуди не пересилати й не вставляти в чат).
4. Vercel → mqvault → Settings → Environment Variables → `NEXT_PUBLIC_TURNSTILE_SITE_KEY` = Site Key, середовища Production і Preview → Save → Redeploy.
5. Перевірити на сайті: на `/login` і `/signup` над кнопкою з'являється віджет Cloudflare, вхід працює.
6. Supabase → Authentication → **Attack Protection** → **Enable CAPTCHA protection** → Provider **Turnstile** → Secret Key → Save.
7. Перевірити ще раз вхід, реєстрацію, «Забули пароль?».

Відкат: вимкнути CAPTCHA в Supabase (крок 6), потім прибрати змінну у Vercel.

## 2. Vercel Firewall (Project → Firewall → Configure → New rule)

API-доступ агента не має права змінювати firewall, тому правила додаються вручну. Можливості залежать від тарифу; якщо якогось типу правила немає — пропустити.

| Назва | If (умова) | Then |
|---|---|---|
| Block vulnerability scanners | Request Path · Matches expression · `^/(wp-admin\|wp-login\.php\|wp-content\|xmlrpc\.php\|phpmyadmin\|cgi-bin\|\.env\|\.git\|\.aws\|\.ssh)\|\.(php\|asp\|aspx\|jsp\|cgi)$` | Deny, 1 hour |
| Rate limit sign-in | Request Path · Starts with · `/api/auth/` | Rate Limit: Fixed window, 60 s, 20 requests, key IP → Deny (429) |
| Rate limit API | Request Path · Starts with · `/api/` **і** Request Path · Does not start with · `/api/bridge/device/` | Rate Limit: Fixed window, 60 s, 600 requests, key IP → Deny (429) |

Не вмикати «Bot Protection» / «Challenge» для `/api/bridge/*` і `/api/economic-calendar/sync`: це програми на ПК (Bridge, EA), вони не пройдуть браузерну перевірку. **Attack Challenge Mode** — лише на час атаки.

Після збереження: Publish → перевірити, що сайт відкривається і Bridge синхронізує (у «Налаштування → MT5 Bridge» час «востаннє на зв'язку» оновлюється).
