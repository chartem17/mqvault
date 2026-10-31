# Shared app shell controls

Branch: feat/journal-layout-filters. Direct source changes.

Verified src/app/page.tsx actually renders AppShellLayout. Page routing and focusTradeIds logic are not modified. All seven tab IDs, labels and icons remain. NavigationButton now composes shared Button, centralizes active/idle styling and navigation-specific spacing, and exposes aria-current for the active page. Theme toggle uses shared Button and has an accessible name when its visual text is hidden. It is disabled until mount, preserving hydration-safe theme resolution.

Sidebar width 248px, main/header padding, content wrappers and account switcher placement remain. app-sidebar hook is now present for the existing light-theme CSS rule. HeaderInk is not mounted by this shell; no unused decorative component is modified.

Pending: CI/Vercel and browser regression for every tab, evidence navigation, theme persistence, both themes and keyboard focus. Existing small-screen sidebar/header overflow is not claimed fixed. Shared modal/Field/empty-state adoption and native journal checkbox migration remain separate work. No production, API or Supabase changes.
