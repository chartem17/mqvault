# Синхронізація економічного календаря з MT5 на ПК власника

Робот `tools/mt5/MQVault_CalendarSync.mq5` працює, поки відкритий термінал MT5. Він надсилає нові й змінені значення календаря (actual, forecast, ревізії) на `POST /api/economic-calendar/sync`. Рішення — [ADR 0015](../decisions/0015-calendar-sync-from-owner-mt5.md).

Ендпоінт є лише в коді гілки, яку задеплоєно. На production він з'явиться після merge `feat/economic-calendar` у `main`.

## Налаштування (один раз)

1. **Токен.** Згенеруйте в PowerShell і збережіть у менеджері паролів:
   ```powershell
   $b = New-Object byte[] 32; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); -join ($b | % { $_.ToString("x2") })
   ```
   Вийде 64 символи. У git, у чат і в скриншоти токен не потрапляє.
2. **Vercel.** Project → Settings → Environment Variables: `CALENDAR_SYNC_TOKEN` = токен (Production; за потреби й Preview). Потім Redeploy. Без змінної ендпоінт відповідає 503.
3. **MT5.** Скопіюйте `MQVault_CalendarSync.mq5` у `MQL5\Experts` (File → Open Data Folder), відкрийте в MetaEditor і скомпілюйте (F7).
4. **Дозвіл мережі.** Tools → Options → Expert Advisors → «Allow WebRequest for listed URL» → додайте `https://mqvault.vercel.app`.
5. **Запуск.** Перетягніть робота на будь-який графік. У параметрі `InpToken` вкажіть токен; `InpUrl` лишіть за замовчуванням. Кнопка Algo Trading не потрібна: робот не торгує.

## Як перевірити

- Ліворуч угорі графіка має бути `MQVault calendar sync`, `Last OK: <час>` і відповідь сервера, наприклад `{"received":312,"inserted":0,"updated":4,"unchanged":308,...}`.
- Під час першого запуску робот через 5 с повторно надсилає 7 днів назад і 14 вперед, щоб догнати пропущене, поки ПК був вимкнений. Далі він щохвилини надсилає лише зміни (`CalendarValueLast`).
- Помилки видно в рядку статусу й на вкладці Experts:
  - `add the URL ... Allow WebRequest` — пропущено крок 4;
  - `HTTP 401` — токен у роботі не збігається з Vercel;
  - `HTTP 503` — у Vercel немає `CALENDAR_SYNC_TOKEN` або не було redeploy.
- Невдале надсилання повторюється на наступній хвилині, нічого не губиться.

## Обмеження

- Поки ПК або MT5 вимкнені, нові actual не надходять. Після запуску робот доганяє останні 7 днів (параметр `InpBackfillDays`).
- Час: MT5 віддає всі часи з поточним зсувом сервера брокера, а робот передає цей зсув разом із даними. Тому ПК має мати правильний системний час.
- Повний переімпорт історії — як і раніше, через CSV (`tools/econ-calendar/`).
