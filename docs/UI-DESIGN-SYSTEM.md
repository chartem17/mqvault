# UI design system — foundation (step 1)

Date: 2026-10-31. Base: `7a1ea52e59b8ff7b1b5916ea88d22dff9db3a2a0` (`feat/undo-delete-current`).
Scope of this step: tokens, fonts, and global styling only. No screen or component markup was changed.

## Principle

The look of the app is defined in one place (`src/app/globals.css`) and inherited. Components use semantic tokens
(`bg-card`, `bg-panel`, `border-border`, `text-primary`, `text-muted-foreground`, `rounded-xl`), not hex values or one-off
colour utilities. If a screen needs a new colour or radius, add a token first.

## What changed

- **Fonts** (`src/app/layout.tsx`): Manrope (UI) and JetBrains Mono (numbers, `font-mono`) via `next/font/google`, with the
  `latin` and `cyrillic` subsets so Ukrainian text renders in the same family. Previously the fonts were named in CSS but never loaded.
  `--font-display` now resolves to Manrope (Cabinet Grotesk was dropped).
- **Palette** (`@theme` in `globals.css`): graphite surfaces that step up in lightness (page, `card`, `panel`), a softer aqua `primary`,
  and muted gain/loss colours (`--color-green`, `--color-red`). The light theme keeps its own values in `.light`.
- **Radius scale**: `rounded-md/lg/xl/2xl/3xl` are slightly rounder than the Tailwind defaults and apply everywhere at once.
- **Panel finish** (dark theme): `bg-card*` and `bg-panel` get a faint light top edge. A soft aqua glow appears only on clickable
  panels (`cursor-pointer`) on hover and on panels that contain a focused control. Rules sit in `@layer components`, so a component's own
  `shadow-*` or `transition-*` classes still win.
- **Controls**: `accent-color` is the primary colour (checkboxes and radios), consistent focus ring, quieter date/time picker icon,
  thin scrollbars, `prefers-reduced-motion` respected.

## Not done yet (next steps)

- Shared primitives (Button, Field, Select, DateTime, Checkbox) and migrating screens to them.
- ~250 hard-coded colour utilities (`text-white`, `border-white/10`, `emerald-*`, `red-*`, `#hex`) still bypass tokens.
- English/Ukrainian i18n and the language switch.
- Signature element and any motion beyond the above.

## Not verified

Built and linted by CI only. No browser check of the result, and the light theme has not been looked at after this change.
