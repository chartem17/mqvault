# Shared UI primitives — first migration

Branch: feat/journal-layout-filters. Active font: Inter (d4594d4), replacing the rejected Spectral SC preview. The historical Spectral entry in ROADMAP describes an earlier package, not the current typeface.

## Implemented scope

- Token-based Button (primary/secondary/ghost/destructive, sizes, disabled/loading), Panel, Input, Textarea and native Select exported from src/components/ui/primitives.tsx.
- ConfirmDialog uses Button; event callbacks, initial cancel focus, dialog semantics, Escape and focus restoration are preserved. Delete/Undo/API logic is unchanged.
- Primitives inherit active Inter typography and theme tokens. No global height on Panel: row layouts own their geometry.
- Native input/select props and refs are forwarded. Consumers must provide accessible labels. Icon-only buttons require aria-label. Loading disables a Button and sets aria-busy, but does not replace its label.

## Not implemented or verified

- Full screen migration, shared Field/Checkbox/DateTime, localization, hardcoded-colour cleanup.
- Existing GlideSelect still has local colours and embedded CSS; it was inspected but not replaced. Native Select is not a silent replacement for its API or behavior.
- CI, Vercel build, browser acceptance and production release are not confirmed by this source commit.
- Consumer className should be used for layout rather than conflicting variant utilities; no class-merging dependency has been added.

## Acceptance checklist

- Both themes: confirm/cancel contrast, focus visibility, keyboard Escape, focus return and long Ukrainian labels.
- Confirm invokes the same existing callback once; cancel does not invoke confirm.
- Inter stays active and the Overview equal-height layout is unchanged.
- Inputs and native Select require actual consumer migration before claiming site-wide adoption.
