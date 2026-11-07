# Архів: журнал одноразових UI-пакетів, 2026-10-31 … 2026-11-01

Історичний журнал робіт над централізацією UI (Overview-розкладка, спільні примітиви, Inter, форми, модалки,
Strategy UI, об'єднання контролів). Усі пакети вже злиті в `main` (PR #17 → 7b5f8ed) і далі розвинені в
`feat/*`-ланцюжку. Посилання на коміти, гілки та файли (`UI-CENTRALIZATION-AUDIT.md`, `glide-select.tsx` тощо) —
знімок на ту дату; цих файлів у поточному дереві вже немає.

Актуальний план: [`../roadmap/ROADMAP.md`](../roadmap/ROADMAP.md).

## Overview bounded layout package — 2026-10-31

- [x] Код: Monthly P&L і Top symbols — картки 360px, нерухомі заголовки, внутрішній scroll, усі інструменти без top-8 обрізання.
- [x] Код: Drawdown episodes — картка 420px з однією прокруткою; Details зсувають наступні рядки лише всередині. Показ усіх епізодів без top-5 обрізання; заголовок і footer не прокручуються.
- [x] Код: R-Multiple — власна висота 320px, незалежність від сусіднього Drawdown, horizontal scroll на вузьких екранах.
- [ ] Перевірити фактичний результат CI і Vercel Preview; статус коду не є статусом браузерного приймання чи релізу.
- [ ] Браузерне приймання: багато/мало/нуль даних; Details; mobile; keyboard scroll; суми й порядок без змін.
- [ ] Окремо далі: нормалізація EURUSD / EUR/USD для групування, без видалення угод. Цей пакет її не виконує.
- [ ] Production-реліз цього пакета не виконаний.

Гілка: feat/journal-layout-filters. Попередній NEXT PROPOSED пункт Top symbols/Monthly P&L тепер має реалізацію коду за цим уточненням; перевірка/реліз залишаються відкритими. Формули, Supabase та Market не змінювалися.

## Overview row alignment correction — 2026-10-31

Попередній пакет візуально НЕ прийнятий: незалежні висоти створили сходинки. Цей запис уточнює попередні пункти 320px/420px.

- [x] Код виправлення: desktop ряд Drawdown + R-Multiple має спільну висоту 560px; ліва колонка включає метрики, gap і flex-список епізодів. Графік використовує доступну висоту.
- [x] Код виправлення: Monthly P&L / Top symbols / Sessions мають висоту 360px; Sessions разом із Session detail у власному скролі.
- [x] Details лишаються всередині одного scroll-контейнера; не збільшують зовнішню висоту.
- [ ] Перевірити результат CI, Preview та фактичну геометрію в браузері; lint/TypeScript не є візуальним тестом.
- [ ] Приймання користувачем після попереднього відхилення; production-реліз окремо.

Формули, БД і нормалізацію пар не змінено.

## Shared UI + Spectral SC integration — 2026-10-31

- [x] Код: фундамент Claude 7046b2c адаптований до актуальної гілки журналу; попередня палітра збережена замість приглушеної.
- [x] Код: Spectral SC централізовано підключений для UI/контролів/таблиць/SVG і legacy font aliases, latin + cyrillic.
- [ ] Перевірити результат CI та Vercel build, завантаження шрифту й українські гліфи в браузері.
- [ ] Візуальне приймання обох тем, щільних таблиць і виправленої сітки після зміни метрик шрифту.
- [ ] Повна міграція екранів на семантичні токени й спільні примітиви; локальні кольори не вважати усунутими.
- [ ] English default / Ukrainian option та повні словники. Шрифт не означає переклад.
- [ ] Production-реліз; PR #18 не мержився автоматично.

## UI centralization: Inter and existing select — 2026-10-31

- [x] Inter replaced rejected Spectral SC in d4594d4; prior Spectral entry is historical, not current typography.
- [x] Shared primitives and first ConfirmDialog Button migration: b7c0e97. This is not all-screen adoption.
- [x] Code: GlideSelect CSS extracted into one shared stylesheet; default palette, radius and popup shadow use theme tokens; existing props/handlers retained. Existing explicit per-instance overrides still win and need a consumer audit.
- [x] Code: invalid font shorthand replaced with valid inherited family/size/weight rules; reduced-motion rule retained.
- [x] Verify workflow lint/TypeScript outcome and Vercel build: final PR #17 HEAD is green.
- [ ] Browser: both themes, dropdown clipping, keyboard, long labels, disabled state, controlled/uncontrolled values, explicit overrides.
- [ ] Next: audit and migrate screen consumers to shared primitives and remove per-instance styling; Field/Checkbox/DateTime; only then redesign shared components.
- [ ] Full English/Ukrainian dictionaries and switch; production release.

No database, financial logic, Market, screen layout or production changes. Active work branch: feat/journal-layout-filters.

## Shared UI: trade-ticket consumer migration — 2026-10-31

- [x] Code: manual-trade-modal fields (including native datetime), account Select, notes Textarea, footer Buttons and section Panels use shared primitives. Local GlideSelect colour/radius overrides removed; shared token defaults apply after select integration.
- [x] Code: error/warning field visuals have one stylesheet; semantic surface/border/status tokens replace ticket-specific dark colours. Form initialization, calculations, validation and save logic are guarded as unchanged by the migration script.
- [x] Verify workflow lint/TypeScript and Vercel build: final PR #17 HEAD is green.
- [ ] Browser acceptance: add/edit, errors/warnings, read-only values, submitting, symbol lookup, account selection, both themes, native date controls and mobile. No real-data destructive tests.
- [ ] Other consumers, shared Field/Checkbox/DateTime behavior, modal shell and local symbol picker buttons still need migration. Native datetime inputs are styled, not a custom calendar implementation.
- [ ] Full centralization and production release are not complete.

Recovery note: earlier attempts did not push app changes (generator, whitespace and workflow-permission failures). This recovery uses an in-memory generator correction, boolean aria-invalid and whitespace cleanup. Automated commit includes application/docs files only. Browser acceptance and production release remain pending.

## Unified Overview styling package — 2026-10-31

- [x] Code: Overview and Drawdown share surface/title/list/accordion styles and compact MetricTile; RiskSummary text uses theme tokens.
- [x] Code: gain/loss metric and chart fill/glow colours use semantic tokens; deliberately dark tooltip retains its own central palette.
- [x] Guard: original file SHAs verified; 360/560/320px height and scroll constraint counts retained. Styling substitutions do not alter financial formulas or hook calls.
- [ ] Verify this workflow lint/TypeScript, final push and Vercel deployment. No browser acceptance implied.
- [ ] Browser: both themes, row alignment, Details scroll, mobile, calendar selection/navigation, chart hover, all/single-account values.
- [ ] Full site centralization remains incomplete: calendar/nav buttons and day states, modal/table shells, remaining forms/checkboxes and other screens still require adoption. Overview class-based wrappers share styles but are not all Panel components.
- [ ] Production release and full English/Ukrainian localization.

No database, production settings, account rules or Market changes.

## Shared account forms package — 2026-10-31

- [x] Code: new-account-modal and account-rules-card native controls and primary/secondary/close/reload actions use shared primitives. Choice labels and selected/idle states use shared form styles.
- [x] Guard: pinned source SHAs checked; creation and API/revision blocks compared unchanged; disabled/modal/submit constraints retained.
- [ ] Verify package lint/TypeScript, final push, Vercel build and browser acceptance.
- [ ] Safe tests: four personal/prop × manual/MT5 combinations, optional blank fields, save/error/loading/conflict, cancel/reopen, both themes and mobile. Do not create or mutate real accounts for tests.
- [ ] AccountSwitcher, shared modal shells, full Field/Checkbox adoption and other screen consumers remain. Full site centralization and production release are not complete.

No account API, rules schema, Supabase, production settings or Market changes. Existing default account identity colour is retained as data, not reinterpreted as a UI token.

## Strategy UI shared controls package — 2026-10-31

- [x] Code: Strategy Control and builder use shared fields/selects/textarea/checkbox and primary actions. Local metric renderers/status palettes extracted to strategy-ui; repeated surfaces share style definition.
- [x] Guards: source SHAs, analysis/CRUD and builder-save blocks, callbacks/navigation counts checked unchanged. Engine, rule definitions, API and database are not modified.
- [ ] Verify lint/TypeScript/final push/Vercel build.
- [ ] Browser: create/cancel, numeric/list parameters, sessions, toggles, dates, strategy selection, duplicate/delete/Undo on safe test data, modal/evidence navigation and both themes.
- [ ] Rule/evidence clickable-card shells, complete modal keyboard behavior, remaining layout typography and other screen adoption still need review. Native date fields are not a custom DateTime picker.
- [ ] Full site centralization, localization and production release remain incomplete.

## Field/EmptyState and journal checkbox adoption — 2026-10-31

- [x] Code: shared Field links native helper-input labels and messages via useId/htmlFor/aria-describedby; error/warning state CSS is shared. Manual ticket input/read-only helpers use it. Symbol no-results uses EmptyState.
- [x] Code: journal column visibility uses shared Checkbox; loading/no-results table cells use EmptyState while preserving colSpan and handlers.
- [x] Verify lint/TypeScript/push/Vercel: final PR #17 HEAD is green.
- [ ] Browser acceptance (invalid/warning/read-only, first-error focus, filtered empty table, checkbox guard).
- [ ] Remaining explicit ticket labels, custom GlideSelect field linkage, other forms, modal shells and other empty-state consumers still need migration. The old unimported trade-ticket.css remains for cleanup; this is not a completed all-form migration.
- [ ] Full centralization, localization and production release remain pending. No database or financial logic changes.

Field adoption recovery: normalize helper indentation before comparing unchanged trade logic. Original protection remains enabled. Initial failed attempt did not commit consumer migration. Browser acceptance and production release remain pending.

## Shared modal appearance — 2026-10-31

- [x] Code: confirm, trade ticket, new account, prop-rules editor and two Strategy Control modal bodies share surface/backdrop definitions. Theme-aware backdrop/shadow tokens are centralized.
- [x] Scope: presentation only. Native/Radix/custom mechanisms and existing handlers, focus code, save guards, size and scroll constraints retained. Visual backdrop opacity/radius/shadow now follow shared defaults.
- [ ] Verify workflow lint/TypeScript/push and Vercel.
- [ ] Browser: open/close, Escape, outside click, saving guards, focus restoration, long content scroll, portal stacking, both themes/mobile. Existing custom modal focus-trap limitations are not claimed fixed.
- [ ] Other agents screens, popovers, full Field/EmptyState adoption and source cleanup still need audit. Full site centralization and production release remain incomplete. No Supabase/API/auth changes.

## UI source audit — snapshot e32d453

- [x] Static UI inventory generated in UI-CENTRALIZATION-AUDIT.md; source snapshot and regex limitations stated. No application changes.
- [ ] Classify candidates and consolidate duplicate shared wrappers before declaring centralized design complete.
- [ ] Confirm modal integration final commit/build, browser acceptance, other-agent coordination and source/workflow cleanup.
- [ ] Full localization, shared visual redesign and production release remain separate.

## Single-source shared UI core — 2026-11-01

- [x] Code: one surface definition and MetricCard implementation; legacy public metric/surface names delegate to them. Existing cn merging reused.
- [x] Confirm checks, final push, Vercel: final PR #17 HEAD is green.
- [ ] Next: classify and remove confirmed-unused CSS/temporary workflows after completed-run/reference checks; do not delete compatibility modules still imported by screens.
- [ ] Remaining screen adoption, full localization and production release are not complete.

## Agreed completion plan: steps 1–2 — 2026-11-01

- [x] Code: News/Screenshots removed from tab registry, rendering and navigation; their two component files deleted after reference check. Retired ?tab values fall back to Overview through the existing registry fallback.
- [x] Code: Market/Calendar retain data, providers, event/exposure logic and callbacks while adopting shared surfaces, MetricCard variants and common refresh/select controls. Unique calendar/event interactions remain.
- [x] Confirm checks/final push/Vercel: final PR #17 HEAD is green.
- [ ] Browser acceptance for five remaining tabs, calendar filters/details and market refresh.
- [ ] Next combined steps 3–4: unified Select/DateTime/Checkbox public controls, remove consumer overrides, verify adoption then cleanup unused files/completed workflows.

## UI controls unification — 2026-11-01

- [x] Code: journal filters and manual trade modal use shared Input, Select, Checkbox, Textarea and DateTimeField; GlideSelect component and styles removed.
- [x] Code: manual-trade-modal select fields migrated to shared Select with error state; residual GlideSelect import removed.
- [x] Checks: PR #17 final HEAD green — checks, layout-tests, account-setup, Vercel Preview Comments.
- [x] Merge: PR #17 squash-merged to main as 7b5f8ed; production deployment triggered by merge.
- [ ] Browser acceptance of unified controls in both themes; production URL verification after Vercel deploy.

Screenshot URLs, attachments, journal data, database, API and production settings are not deleted or modified. This UI removal is not a storage purge. Other data-source work must be rebased/reconciled rather than blindly merged over these UI changes.
