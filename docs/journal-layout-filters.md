# Journal layout and filters

Work branch only; not a completed production release. GET/PATCH /api/preferences/journal-layout uses the private server-resolved owner. Browser cannot supply user_id. The current private owner access model is not multi-user Supabase Auth.

Layout drafts include full column order and hidden fields. At least one data column stays visible; actions stays fixed on the right. Hidden fields keep their order. Confirm persists; cancel restores the fetched/saved snapshot. Conflict 409 requires an explicit reload. No localStorage fallback.

The combined panel has field search, column visibility and text contains filters. Filters are temporary and independent of hidden columns. Number range operators and dedicated date-range filters are not implemented in this package. Sorting supports all displayed fields, compares numbers numerically and timestamps chronologically, and places missing values last. Session group/subsession selection and evidence ID narrowing remain separate constraints.

Desktop drag is available only in reorder mode. Left/right buttons also support touch and keyboard operation. Browser interactions, API concurrency and production build must be verified before release.

Migration SQL mirrors the already applied migration; do not blindly apply it again to the live database. Reconcile its migration history version before a future CLI db push.

Run layout tests:

```sh
npx tsc src/lib/journal-layout.ts --outDir .tmp-journal-layout-tests --module commonjs --target ES2020 --strict --skipLibCheck
node --test tests/journal-layout.test.mjs
npm run lint
npx tsc --noEmit
npm run build
```

Acceptance: save/reload order and hidden fields; cancel/reset; two-tab conflict; hidden active filters; numeric/date sorting; evidence navigation; edit/delete/Undo. Preview may use the same database: do not perform destructive tests on real accounts.
