# UI centralization audit

Source snapshot: `e32d453399221bd8699a06c7a57b60bb263b0c48` on `feat/journal-layout-filters`.

## Method and limitations

Static regex inventory of component TSX/CSS and app theme/layout files. Counts are candidate occurrences, not confirmed defects or an adoption percentage. They can include comments/strings. Shared native primitives intentionally contain native elements. Black backdrops, data-driven account colours, chart/tooltips and theme token definitions may be intentional. No browser, focus, accessibility or financial correctness certification is implied.

## Candidate totals

| Pattern | Occurrences |
| --- | ---: |
| button | 32 |
| input | 3 |
| select | 2 |
| textarea | 1 |
| checkbox | 1 |
| date/time | 9 |
| colour | 104 |
| palette | 80 |
| style tag | 2 |
| font override | 18 |

## Per-file inventory

| File | Scope | Native button/input/select/textarea | Checkbox / date-time | Literal colour / palette utility | Style tag / font override |
| --- | --- | --- | --- | --- | --- |
| `src/components/account-switcher.tsx` | consumer | 1/0/0/0 | 0 / 0 | 0 / 0 | 0 / 0 |
| `src/components/accounts/account-rules-card.tsx` | consumer | 0/0/0/0 | 0 / 1 | 0 / 0 | 0 / 0 |
| `src/components/accounts/new-account-modal.tsx` | consumer | 2/0/0/0 | 0 / 0 | 1 / 0 | 0 / 0 |
| `src/components/app-shell-layout.tsx` | consumer | 0/0/0/0 | 0 / 0 | 0 / 0 | 0 / 0 |
| `src/components/backgrounds/dot-field.tsx` | consumer | 0/0/0/0 | 0 / 0 | 3 / 4 | 0 / 0 |
| `src/components/backgrounds/profit.tsx` | consumer | 0/0/0/0 | 0 / 0 | 0 / 0 | 0 / 1 |
| `src/components/header-ink.tsx` | consumer | 0/0/0/0 | 0 / 0 | 1 / 0 | 0 / 0 |
| `src/components/journal/manual-trade-modal.tsx` | consumer | 4/0/0/0 | 0 / 1 | 0 / 0 | 1 / 0 |
| `src/components/providers/timezone-provider.tsx` | consumer | 0/0/0/0 | 0 / 0 | 0 / 0 | 0 / 0 |
| `src/components/providers/timezone-providers.tsx` | consumer | 0/0/0/0 | 0 / 0 | 0 / 0 | 0 / 0 |
| `src/components/settings/timezone-select.tsx` | consumer | 0/0/0/0 | 0 / 0 | 0 / 0 | 0 / 0 |
| `src/components/strategy-control/strategy-builder.tsx` | consumer | 0/0/0/0 | 0 / 0 | 0 / 0 | 0 / 0 |
| `src/components/tabs/calendar-tab.tsx` | coordinate with other agent | 5/0/1/0 | 0 / 0 | 1 / 5 | 0 / 1 |
| `src/components/tabs/journal-tab.tsx` | consumer | 0/0/0/0 | 0 / 0 | 0 / 0 | 0 / 0 |
| `src/components/tabs/market-tab.tsx` | coordinate with other agent | 1/0/0/0 | 0 / 0 | 0 / 0 | 0 / 1 |
| `src/components/tabs/news-tab.tsx` | coordinate with other agent | 5/0/0/0 | 0 / 0 | 0 / 0 | 0 / 1 |
| `src/components/tabs/overview-tab.tsx` | consumer | 4/0/0/0 | 0 / 0 | 4 / 8 | 0 / 0 |
| `src/components/tabs/screenshots-tab.tsx` | coordinate with other agent | 2/1/0/0 | 0 / 0 | 0 / 3 | 0 / 1 |
| `src/components/tabs/strategy-control-tab.tsx` | consumer | 2/0/0/0 | 0 / 1 | 0 / 0 | 0 / 0 |
| `src/components/theme-provider.tsx` | consumer | 0/0/0/0 | 0 / 0 | 0 / 0 | 0 / 0 |
| `src/components/ui/card-content.tsx` | shared/theme | 0/0/0/0 | 0 / 0 | 0 / 0 | 0 / 0 |
| `src/components/ui/checkbox.tsx` | shared/theme | 0/1/0/0 | 1 / 0 | 0 / 0 | 0 / 0 |
| `src/components/ui/confirm-dialog.tsx` | shared/theme | 0/0/0/0 | 0 / 0 | 0 / 0 | 0 / 0 |
| `src/components/ui/drawdown-panel.tsx` | shared/theme | 1/0/0/0 | 0 / 0 | 0 / 0 | 0 / 0 |
| `src/components/ui/empty-state.tsx` | shared/theme | 0/0/0/0 | 0 / 0 | 0 / 0 | 0 / 0 |
| `src/components/ui/field.tsx` | shared/theme | 0/0/0/0 | 0 / 0 | 0 / 0 | 0 / 0 |
| `src/components/ui/glide-select.tsx` | shared/theme | 2/0/0/0 | 0 / 0 | 0 / 0 | 0 / 0 |
| `src/components/ui/light-rays.tsx` | shared/theme | 0/0/0/0 | 0 / 0 | 0 / 0 | 0 / 0 |
| `src/components/ui/navigation-button.tsx` | shared/theme | 0/0/0/0 | 0 / 0 | 0 / 0 | 0 / 0 |
| `src/components/ui/overview-styles.tsx` | shared/theme | 0/0/0/0 | 0 / 0 | 2 / 0 | 0 / 0 |
| `src/components/ui/primitives.tsx` | shared/theme | 1/1/1/1 | 0 / 0 | 0 / 1 | 0 / 0 |
| `src/components/ui/risk-summary.tsx` | shared/theme | 0/0/0/0 | 0 / 0 | 0 / 0 | 0 / 0 |
| `src/components/ui/section-header.tsx` | shared/theme | 0/0/0/0 | 0 / 0 | 0 / 0 | 0 / 0 |
| `src/components/ui/stat-card.tsx` | shared/theme | 0/0/0/0 | 0 / 0 | 0 / 0 | 0 / 0 |
| `src/components/ui/strategy-ui.tsx` | shared/theme | 0/0/0/0 | 0 / 0 | 0 / 0 | 0 / 0 |
| `src/components/ui/streak-stat-card.tsx` | shared/theme | 0/0/0/0 | 0 / 0 | 0 / 0 | 0 / 0 |
| `src/components/ui/theme-provider.tsx` | shared/theme | 0/0/0/0 | 0 / 0 | 0 / 0 | 0 / 0 |
| `src/components/ui/undo-toast.tsx` | shared/theme | 2/0/0/0 | 0 / 0 | 0 / 0 | 1 / 0 |
| `src/components/journal/trade-ticket.css` | consumer | 0/0/0/0 | 0 / 0 | 0 / 0 | 0 / 0 |
| `src/components/ui/dialog.css` | shared/theme | 0/0/0/0 | 0 / 0 | 4 / 0 | 0 / 0 |
| `src/components/ui/field.css` | shared/theme | 0/0/0/0 | 0 / 0 | 0 / 0 | 0 / 0 |
| `src/components/ui/glide-select.css` | shared/theme | 0/0/0/0 | 0 / 0 | 0 / 0 | 0 / 2 |
| `src/app/globals.css` | shared/theme | 0/0/0/0 | 0 / 6 | 88 / 59 | 0 / 6 |
| `src/app/layout.tsx` | shared/theme | 0/0/0/0 | 0 / 0 | 0 / 0 | 0 / 0 |
| `src/app/typography.css` | shared/theme | 0/0/0/0 | 0 / 0 | 0 / 0 | 0 / 5 |

## Representative candidates

At most four examples per category per file; not a complete issue list.

| File:line | Category | Match |
| --- | --- | --- |
| `src/components/accounts/new-account-modal.tsx:47` | colour | `#4f8cff` |
| `src/components/backgrounds/dot-field.tsx:448` | colour | `#000` |
| `src/components/backgrounds/dot-field.tsx:448` | colour | `rgb(` |
| `src/components/backgrounds/dot-field.tsx:448` | colour | `#000` |
| `src/components/backgrounds/dot-field.tsx:440` | palette | `bg-white` |
| `src/components/backgrounds/dot-field.tsx:440` | palette | `text-zinc` |
| `src/components/backgrounds/dot-field.tsx:440` | palette | `bg-zinc` |
| `src/components/backgrounds/dot-field.tsx:440` | palette | `text-zinc` |
| `src/components/backgrounds/profit.tsx:692` | font override | `fontFamily` |
| `src/components/header-ink.tsx:19` | colour | `oklch(` |
| `src/components/journal/manual-trade-modal.tsx:487` | style tag | `<style` |
| `src/components/tabs/calendar-tab.tsx:96` | colour | `#0c1211` |
| `src/components/tabs/calendar-tab.tsx:13` | palette | `border-amber` |
| `src/components/tabs/calendar-tab.tsx:13` | palette | `bg-amber` |
| `src/components/tabs/calendar-tab.tsx:13` | palette | `text-amber` |
| `src/components/tabs/calendar-tab.tsx:13` | palette | `border-white/` |
| `src/components/tabs/calendar-tab.tsx:79` | font override | `fontFamily` |
| `src/components/tabs/market-tab.tsx:29` | font override | `fontFamily` |
| `src/components/tabs/news-tab.tsx:111` | font override | `fontFamily` |
| `src/components/tabs/overview-tab.tsx:71` | colour | `rgb(` |
| `src/components/tabs/overview-tab.tsx:74` | colour | `rgb(` |
| `src/components/tabs/overview-tab.tsx:75` | colour | `rgb(` |
| `src/components/tabs/overview-tab.tsx:76` | colour | `rgb(` |
| `src/components/tabs/overview-tab.tsx:78` | palette | `text-white` |
| `src/components/tabs/overview-tab.tsx:79` | palette | `text-white/` |
| `src/components/tabs/overview-tab.tsx:80` | palette | `text-white/` |
| `src/components/tabs/overview-tab.tsx:81` | palette | `border-white/` |
| `src/components/tabs/screenshots-tab.tsx:34` | palette | `bg-black/` |
| `src/components/tabs/screenshots-tab.tsx:34` | palette | `text-white` |
| `src/components/tabs/screenshots-tab.tsx:49` | palette | `bg-black/` |
| `src/components/tabs/screenshots-tab.tsx:20` | font override | `fontFamily` |
| `src/components/ui/overview-styles.tsx:13` | colour | `rgb(` |
| `src/components/ui/overview-styles.tsx:14` | colour | `rgb(` |
| `src/components/ui/primitives.tsx:11` | palette | `text-white` |
| `src/components/ui/undo-toast.tsx:49` | style tag | `<style` |
| `src/components/ui/dialog.css:2` | colour | `rgb(` |
| `src/components/ui/dialog.css:3` | colour | `rgb(` |
| `src/components/ui/dialog.css:6` | colour | `rgb(` |
| `src/components/ui/dialog.css:7` | colour | `rgb(` |
| `src/components/ui/glide-select.css:1` | font override | `font-family:` |
| `src/components/ui/glide-select.css:1` | font override | `font-family:` |
| `src/app/globals.css:8` | colour | `oklch(` |
| `src/app/globals.css:9` | colour | `oklch(` |
| `src/app/globals.css:10` | colour | `oklch(` |
| `src/app/globals.css:11` | colour | `oklch(` |
| `src/app/globals.css:109` | palette | `text-white/` |
| `src/app/globals.css:110` | palette | `text-white/` |
| `src/app/globals.css:111` | palette | `text-white/` |
| `src/app/globals.css:112` | palette | `text-white/` |
| `src/app/globals.css:43` | font override | `--font-sans:` |
| `src/app/globals.css:44` | font override | `--font-mono:` |
| `src/app/globals.css:50` | font override | `--font-display:` |
| `src/app/globals.css:91` | font override | `font-family:` |
| `src/app/typography.css:5` | font override | `--font-display:` |
| `src/app/typography.css:8` | font override | `--font-sans:` |
| `src/app/typography.css:9` | font override | `--font-mono:` |
| `src/app/typography.css:10` | font override | `--font-display:` |

## Shared module references

Files containing a matching module import path; this is not a count of rendered controls. Inline wrappers and explicit consumer overrides still require review.

- `primitives`: `src/components/account-switcher.tsx`, `src/components/accounts/account-rules-card.tsx`, `src/components/accounts/new-account-modal.tsx`, `src/components/app-shell-layout.tsx`, `src/components/journal/manual-trade-modal.tsx`, `src/components/settings/timezone-select.tsx`, `src/components/strategy-control/strategy-builder.tsx`, `src/components/tabs/journal-tab.tsx`, `src/components/tabs/strategy-control-tab.tsx`, `src/components/ui/confirm-dialog.tsx`, `src/components/ui/navigation-button.tsx`, `src/components/ui/overview-styles.tsx`, `src/components/ui/stat-card.tsx`, `src/components/ui/strategy-ui.tsx`, `src/components/ui/streak-stat-card.tsx`
- `checkbox`: `src/components/account-switcher.tsx`, `src/components/strategy-control/strategy-builder.tsx`, `src/components/tabs/journal-tab.tsx`
- `field`: `src/components/journal/manual-trade-modal.tsx`
- `empty-state`: `src/components/journal/manual-trade-modal.tsx`, `src/components/tabs/journal-tab.tsx`
- `card-content`: `src/components/ui/section-header.tsx`, `src/components/ui/stat-card.tsx`, `src/components/ui/streak-stat-card.tsx`
- `dialog-styles`: `src/components/accounts/account-rules-card.tsx`, `src/components/accounts/new-account-modal.tsx`, `src/components/journal/manual-trade-modal.tsx`, `src/components/tabs/strategy-control-tab.tsx`, `src/components/ui/confirm-dialog.tsx`
- `navigation-button`: `src/components/app-shell-layout.tsx`
- `overview-styles`: `src/components/tabs/overview-tab.tsx`, `src/components/ui/drawdown-panel.tsx`
- `strategy-ui`: `src/components/strategy-control/strategy-builder.tsx`, `src/components/tabs/strategy-control-tab.tsx`
- `form-styles`: `src/components/accounts/account-rules-card.tsx`, `src/components/accounts/new-account-modal.tsx`

## Shared-layer consolidation review

- Review whether StatCard, MetricTile, StrategyMetricCard and StrategySummaryMetric should share a single configurable metric implementation; extraction alone does not remove all duplication.
- Review CARD_SURFACE, FORM_SURFACE, STRATEGY_SURFACE and Panel before changing panel appearance: not every wrapper currently delegates to one component.
- Review compatibility font aliases separately from actual loaded next/font imports. A legacy Spectral variable name does not mean the Spectral font is still loaded.
- Review unimported legacy CSS and explicit per-instance GlideSelect props. Do not delete data-driven account colours as if they were hardcoded theme defects.
- Do not treat native date input styling as a custom date/time picker implementation.

## One-off workflow cleanup inventory

Candidates only. Do not delete active runs, standard regression CI or other agents workflows without reviewing references.

- `.github/workflows/audit-ui-centralization.yml`
- `.github/workflows/centralize-glide-select.yml`
- `.github/workflows/centralize-trade-ticket.yml`
- `.github/workflows/recover-field-states.yml`
- `.github/workflows/recover-trade-ticket.yml`
- `.github/workflows/spectral-ui-package.yml`
- `.github/workflows/unify-account-forms.yml`
- `.github/workflows/unify-dialog-appearance.yml`
- `.github/workflows/unify-field-states.yml`
- `.github/workflows/unify-overview.yml`
- `.github/workflows/unify-strategy-ui.yml`

## Next acceptance gates

1. Review and classify candidates: intentional, shared token source, migrate, consolidate or coordinate.
2. Complete adoption/consolidation in the owned screens as one bounded cleanup package; preserve event handlers, account scope and financial calculations.
3. Coordinate Market/calendar/news/screenshots changes separately; this audit does not authorize editing their logic.
4. Verify both themes, mobile, modal focus/close/save guards, dropdown clipping, errors/empty states and 360/560px row geometry.
5. Only then approve a visual redesign of the shared primitives. Full localization and production promotion remain separate approvals.
