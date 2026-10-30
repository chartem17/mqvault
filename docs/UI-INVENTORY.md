# UI-INVENTORY — поля, select, дата/час

Дата: 2026-10-30. Baseline: `c9f3dba` (`feat/undo-delete-current`). Інвентар зроблено читанням коду (grep + вибіркове читання), у браузері нічого не відкривалося. Рядки можуть зміститися після змін першого агента.

Мета — показати, що вже спільне, що дублюється і що можна буде замінити централізовано на UI-етапі (етап I роудмапа). Це не пропозиція редизайну.

## 1. Спільні UI-елементи

| Елемент | Файл | Стан |
|---|---|---|
| `GlideSelect` (кастомний select із клавіатурою, `role="combobox"`) | `src/components/ui/glide-select.tsx` | Єдиний кастомний select. Використовується **лише** в `journal/manual-trade-modal.tsx:504`. Стилі вбудовані через `<style>` у компоненті; кольори за замовчуванням захардкожені (`#33d6ba`, `#111817`, `#1b2b28`, `#e8f0ed`), а не з токенів `globals.css`. Код мінімізований в одному рядку, 15 рядків файлу |
| `confirm-dialog.tsx`, `undo-toast.tsx` | `src/components/ui/` | Спільні для видалень (чіпати не можна — механізм Undo) |
| `stat-card.tsx`, `streak-stat-card.tsx`, `section-header.tsx`, `risk-summary.tsx`, `drawdown-panel.tsx`, `light-rays.tsx` | `src/components/ui/` | Показники/візуальні ефекти, не поля вводу |
| Загальних `Input`, `Field`, `Label`, `Button`, `Select`, `DatePicker` | — | **Немає.** Бібліотеки Radix, cmdk, cva підключені в `package.json`, але в `src/` не імпортуються (див. `AGENT-HANDOFF.md`, п. 4) |

Є два файли `theme-provider.tsx` (`src/components/theme-provider.tsx` і `src/components/ui/theme-provider.tsx`), обидва імпортують `next-themes`. `layout.tsx` імпортує `@/components/theme-provider`; для `src/components/ui/theme-provider.tsx` імпортів у `src/` не знайдено.

## 2. Select

| Файл:рядок | Тип | Що вибирається |
|---|---|---|
| `journal/manual-trade-modal.tsx:504` | `GlideSelect` | поле форми угоди |
| `journal/manual-trade-modal.tsx:685` | нативний `<select>` | поле форми угоди (поруч із GlideSelect у тій самій формі) |
| `tabs/calendar-tab.tsx:81` | нативний | фільтр валюти |
| `tabs/strategy-control-tab.tsx:107` | нативний | вибір стратегії (`aria-label="Стратегія"`) |
| `settings/timezone-select.tsx:44` | нативний + окреме поле пошуку над ним | часовий пояс |
| `accounts/new-account-modal.tsx:58` | нативний | валюта |
| `accounts/new-account-modal.tsx:61` | нативний | фаза |
| `accounts/account-rules-card.tsx:19` | нативний (спільний рядок стану умови) | `unknown / not_applicable / configured` |
| `accounts/account-rules-card.tsx:75, 76, 78` | нативний | фаза, режим max loss, база контролю (balance/equity) |

Підсумок: ≈ 11 місць; 10 нативних і 1 кастомний. У одній формі (`manual-trade-modal`) співіснують обидва види.

## 3. Текстові/числові поля, textarea

- `journal/manual-trade-modal.tsx`: локальний хелпер `input(key, label, type)` (рядок 441) — єдиний «шаблон поля» в проєкті, але він локальний для цієї форми. Також `<input>` на рядках ≈481, 579, 605 і `<textarea>` на ≈763.
- `accounts/new-account-modal.tsx`: ≈7 `<input>` з константою `INPUT` (рядок 8).
- `accounts/account-rules-card.tsx`: `<input>` / `<textarea>` з іншою константою `INPUT` (рядок 10).
- `strategy-control/strategy-builder.tsx`: `<input type="number">`, `type="checkbox"`, `type="text"`, `<input>` для назви і `<textarea>` для опису — без спільних класів.
- Пошук: `tabs/journal-tab.tsx:61`, `tabs/screenshots-tab.tsx:23` — окремі інлайн `<input>`.

**Дублювання стилів полів.** Дві різні константи `INPUT`:

| Файл | Фон | Фокус | Розмір |
|---|---|---|---|
| `new-account-modal.tsx:8` | `bg-white/[0.04]` | `focus:border-emerald-400/50` | `py-2.5` |
| `account-rules-card.tsx:10` | `bg-panel` | `focus:border-teal-400` | `py-2`, `w-full` |

Ще один стиль — у `GlideSelect` (власний CSS, колір фокусу з пропа `accentColor`). Отже, «поле» зараз має щонайменше три візуальні варіанти.

## 4. Дата / час

| Файл:рядок | Елемент | Примітка |
|---|---|---|
| `journal/manual-trade-modal.tsx:579–581` | `<input type="datetime-local">` | відкриття угоди (Open At) |
| `journal/manual-trade-modal.tsx:597` | `input("closed_at", "Closed at", "datetime-local")` | закриття угоди (Close At) |
| `tabs/strategy-control-tab.tsx:106` | `<input type="date">` | період фільтра (`period[key]`) |
| `accounts/account-rules-card.tsx:77` | `<input type="time" step={60}>` | час завершення торгового дня (`prop_day_close`) |
| `accounts/account-rules-card.tsx:77` | текстовий `<input>` | часовий пояс торгового дня (`prop_day_timezone`), без списку |
| `settings/timezone-select.tsx` | `<select>` + пошук | часовий пояс інтерфейсу |

- Кастомного календаря/годинника немає. `react-calendar-heatmap` у `package.json` є, але не імпортується. Вкладка Calendar (`tabs/calendar-tab.tsx`) — власна розмітка.
- Формат значень (рядок `datetime-local` ↔ ISO у БД) обробляється в `manual-trade-modal.tsx` і в `src/lib/trading-calendar.ts` / `src/lib/timezone.ts`. Будь-яка заміна контролів **не повинна** змінювати збережені timestamps, DST і київські календарні ключі (вимога роудмапа, етап I).

## 5. Що можна замінити централізовано (на UI-етапі)

1. **Базові примітиви** `Field`/`Input`/`Select`/`Textarea` у `src/components/ui/` на токенах з `globals.css`; потім поетапно підключати форми. Найменш ризикові перші: `manual-trade-modal`, `strategy-builder`, `timezone-select`, фільтри вкладок.
2. **Єдиний `INPUT`-клас** замість двох констант (`new-account-modal` і `account-rules-card`) — **потребує передачі модуля `src/components/accounts/`** від першого агента.
3. **Один select:** або `GlideSelect` після виносу кольорів у токени, або нативний select зі спільним стилем. Рішення за власником; змішування в одній формі зараз — найбільш помітна неузгодженість.
4. **Date/time:** один компонент-обгортка над нативними `date`/`time`/`datetime-local` (без нового календаря на першому кроці), щоб не зачепити логіку timestamps.
5. **Шрифти:** перед будь-якою типографічною системою спочатку з'ясувати фактичне завантаження (за кодом Manrope/Cabinet Grotesk не підключені; `<html lang="en">` при українському інтерфейсі).

## 6. Обмеження цього інвентаря

- Не відкривалися браузер, light-тема й мобільний вигляд.
- Не читалися повністю великі файли (`manual-trade-modal.tsx`, `overview-tab.tsx`, `strategy-control-tab.tsx`) — лише місця з полями.
- Не перевірялась доступність (labels, `aria-*`) окрім виявлених `aria-label` у `GlideSelect` і селекторі стратегії.
