# Undo deletion: integration and acceptance checklist

Branch: feat/undo-delete-current. Do not merge without owner review.

## Current status
- Shared Undo UI and confirmation dialog are committed and the provider is mounted.
- Transactional deletion migration and helper are prepared, not applied or wired to APIs.
- Trades/account UI handlers and the actual strategy-control-tab.tsx still need integration.
- Strategy UI currently uses mockStrategies in React state. Do not equate these IDs with database strategy_rules UUIDs. Persistence needs an explicit mapping/API before database deletion is connected.
- No build, lint, SQL execution or browser test results have been claimed.

## Required behavior
- No server DELETE before the 10-second undo window ends.
- Cancel restores visibility without recreating database records.
- Closing/reloading before expiry leaves database records intact.
- Accounts and strategies require confirmation before the undo window starts.
- Concurrent pending operations remain individually cancellable; do not truncate notifications.
- Refreshes must respect pending local deletion masks.
- API/network errors must not be shown as successful deletion. A lost response may follow a committed server deletion; re-fetch to reconcile.
- A refresh after successful final deletion must not resurrect the record.

## Backend safety
- Resolve the trusted owner from authenticated server context or a verified private-site access gate. Legacy is_owner lookup is not request authentication.
- RPC execution is restricted to service_role. Never expose a service key to the browser.
- Trade deletion removes its news links/checks, not shared news events or raw MT5 source history.
- Account deletion removes owned trades, checks, links, strategies, raw deals, broker symbols and import runs atomically.
- Other phase accounts and copied strategies are preserved; their parent/source references are detached.
- Any unexpected dependency or ownership inconsistency must fail and roll back the transaction.
- Linked screenshot blobs are not deleted by this SQL. Storage ownership, shared references and retries need handling before claiming complete media cleanup.

## Verification before owner preview
- [ ] Wire UI handlers and strategy persistence correctly.
- [ ] Add verified server access control and wire RPC-backed endpoints.
- [ ] Apply migration after approval; no destructive live-data test.
- [ ] Test SQL on disposable fixtures: success, repeat request, wrong owner, dependency failure and rollback.
- [ ] Test several pending deletions, undo, navigation, reload, API errors and account/trade overlap.
- [ ] Test dialog Escape, focus restoration, mobile and reduced-motion.
- [ ] Run lint, TypeScript and production build; distinguish pre-existing failures.
- [ ] Provide branch/preview instructions and warn if preview uses production Supabase.
