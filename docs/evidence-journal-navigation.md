# Strategy evidence to journal

Existing Strategy Control links to /journal?focusTradeIds=... now redirect to the existing root workspace with tab=journal. Tabs are represented in URL state; the root uses Suspense around useSearchParams. Sidebar navigation explicitly clears the evidence filter; browser history restores URL navigation. The journal can explicitly clear evidence selection with a replace navigation.

Selection is a fixed snapshot of exact existing journal UUIDs, not a strategy rerun, cloned trades, ticket lookup or search by symbol/date. The strategy adapter already preserves trade.id. No engine, database, Supabase policy, trade timestamp, financial field or Undo flow changes.

The client applies the focus only to current visibleTrades supplied by useTrades, then applies normal search/market/session filters. It never broadens account inclusion or fetches missing IDs from another scope. Missing IDs remain missing, including deleted/temporarily hidden trades or trades outside the active account selection. A fresh evidence list remounts journal filter state so old search filters do not hide the initial evidence view.

Absent focus means normal journal. Explicit empty focus means no evidence. Malformed/ambiguous/oversized focus means no rows and an explanation, never the whole journal. URL mode is deliberately bounded to 150 requested UUIDs and 6000 decoded characters; larger sets must narrow the Strategy Control period for now. No silent truncation. An opaque selection mechanism for larger lists is a future enhancement.

New trades do not automatically join the fixed evidence ID list. Editing/deleting uses original records and existing owner-checked API paths. A focused URL is not an authorization token. Reload preserves the ID selection but does not pin the account: the current active/included account selection still restricts results.

Browser acceptance: open a finding and navigate to evidence; compare exact IDs; refresh; use Back/Forward; switch account without exposing other rows; clear focus; test empty/invalid links; edit/delete a test trade and check existing Undo. A green unit suite does not replace browser acceptance. main is not merged by this package.
