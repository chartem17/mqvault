# Journal control migration

Branch: feat/journal-layout-filters. Direct application edit; no new migration workflow.

Journal search, column search, contains filters, session/sort selects, toolbar actions, filter chips, preference actions, ID copy, reorder arrows and row actions now use shared Button/Input/Select. Local button-style constant removed. Existing filtering/sorting/focus/account selection, preference hook calls, create/update/delete callbacks and drag handlers retained. Error colour now references destructive theme token.

Still pending: native checkbox migration; shared popover/table/empty-state shells; full-screen adoption across the rest of the site; localization. Bigger shared button/control metrics can affect table row/header height and panel density; browser review required, not assumed pixel-identical.

Acceptance: search and ID focus, contains filters, hidden filters retained, session filter, sorting both directions, one-visible-column guard, drag/arrow reorder, save/cancel/default/reload conflict, copy ID, add/edit/delete/Undo on safe test data, both themes and narrow screen. CI and Vercel build must be checked separately; production release not included.
