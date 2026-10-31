# Shared account manager controls

Branch: feat/journal-layout-filters. Direct source changes.

AccountSwitcher now uses Button/Panel and a shared native Checkbox. All-accounts state, active account selection, inclusion toggle, deleteAccount handler and upsertAccount flow are retained. Stored per-account colours are not modified; badge alpha uses colour-mix so token-based fallback colours work too. Local menu/trigger/danger colours now reference shared theme tokens.

Native checkbox replaces the include/exclude icon button and provides checked semantics and an account-specific accessible label. Delete gets an account-specific label. This does not alter deletion confirmation/Undo logic in the hook. Backdrop remains a labelled native button; popup is not claimed to implement a complete ARIA menu or focus trap.

Shared button sizes may change row density. Menu width is viewport-bounded. Layout-only alignment/padding is explicit; no local palette values are added. Journal and other native checkbox consumers are not migrated by this package.

Pending: build/CI and browser tests for both themes, narrow screens, all/single selection, include totals, open/close, create and safe delete/Undo. No production release, auth or Supabase modifications.
