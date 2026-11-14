# ADR 0019. Інтерактивні примітиви на ui-sdk і спільна «оздоба» застосунку

**Статус:** прийнято, 2026-11-13 (редизайн, етап 1; рішення власника «використовуючи це» — про ui-sdk)

## Контекст
Власник попросив «прихорошити весь сайт — кнопки, тултіпи, анімації, приємний фон», не чіпаючи екран входу, і використати ui-sdk (`@ui-sdk/react`, `@ui-sdk/core`, бета від vercel-labs). Раніше кнопки, списки, підказки (`title`) і перемикачі були нативними або саморобними (`role="radiogroup"` з кнопок), кожен зі своїми класами.

## Рішення
- **Поведінка — з ui-sdk, вигляд — наш.** Спільні примітиви в `src/components/ui` обгортають ui-sdk і зберігають свій API, щоб сторінки не переписувати:
  - `Button` → ui-sdk `Button` (async `onClick` тримає кнопку в стані `data-pending`);
  - `Select` → ui-sdk `Select`, але пишеться як нативний (`<option>`, `<optgroup>`, `value`, `onChange(event.target.value)`); на телефоні — нижній аркуш (`presentation="auto"`), для довгих списків — пошук (`search`);
  - `Hint` (ui-sdk `Tooltip`) замість нативного `title` на кнопках;
  - `Segmented` (ui-sdk `SegmentedControl`) з «пігулкою» для вибору одного з кількох;
  - `ConfirmDialog` → ui-sdk `AlertDialog`.
  Новий UI бере ці примітиви; `role="listbox|menu|dialog|radiogroup|switch|tablist"` вручну не пишемо (див. скіл `ui-sdk`, `AGENTS.md`).
- **Шари CSS.** `@layer ui-sdk;` оголошено першим у `globals.css`: стилі `@ui-sdk/core/web.css` найслабші, далі Tailwind (base → components → utilities), далі наші правила без шару. Токени `--ui-*` прив'язані до наших (`src/app/ui-finish.css`). Наслідок: preflight Tailwind (`margin: 0`) сильніший за ui-sdk — центрування діалогів повертаємо самі.
- **Оздоба застосунку** (`src/app/ui-finish.css`, `AppBackdrop`): фон із повільним світлом, сіткою й зерном; «прожектор» за курсором на картках; поява сторінки й панелей; лічильник чисел у картках показників (`CountUp`, лише при першій появі). Усе вимикає `prefers-reduced-motion`.
- **Екран входу не змінюється:** фон на `/login`, `/signup`, `/forgot-password`, `/reset-password` не малюється; спільна кнопка мови там зберігає старий вигляд (перевірено попіксельним порівнянням).

## Наслідки
- ui-sdk — бета (`0.1.0-beta.1`, версія закріплена точно); оновлення — свідомо, з перевіркою всіх примітивів.
- `web.css` додає ~63 КБ CSS. Якщо примітиви відмовляться від стандартного вигляду повністю, імпорт можна прибрати.
- ui-sdk додає свій CSS під час виконання; наша CSP дозволяє `style-src 'unsafe-inline'`, тож мета-тег `csp-nonce` не потрібен.

## Де в коді
`src/components/ui/{primitives,hint,segmented,confirm-dialog,count-up}.tsx`, `src/components/layout/app-backdrop.tsx`, `src/app/ui-finish.css`, `src/components/ui/dialog.css`, `src/lib/dashboard/count-up.ts` (тест `tests/count-up.test.mjs`).
