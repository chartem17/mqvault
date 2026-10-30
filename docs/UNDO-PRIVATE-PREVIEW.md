# Private preview setup

The branch is not fully accepted until strategy UI integration, SQL application and checks are completed.

## Local configuration
Set these only in the existing local .env.local, never commit real values:

VAULT_ACCESS_PASSWORD=<unique ASCII password of at least 20 characters>
VAULT_SITE_ORIGIN=http://localhost:3000

Keep existing Supabase configuration. If the dev server uses another port or hostname, change VAULT_SITE_ORIGIN to that exact origin and restart the dev server.
Open the application and use browser HTTP authentication: username owner, password VAULT_ACCESS_PASSWORD.
If the password is missing or too short, the workspace responds 503 instead of exposing its APIs.
Use HTTPS outside localhost. Basic authentication is a temporary single-owner access gate, not multi-user profile authentication. Do not share the owner password or use it as a public product login system.

## Server deletion
After the undo timer expires, existing DELETE calls for /api/accounts and /api/journal/trades are internally rewritten to /api/deletions.
The new endpoint repeats access verification, rejects cross-origin/non-JSON mutation requests, resolves exactly one workspace owner server-side and calls the service-only transactional RPC.
Apply supabase/migrations/20261027205100_permanent_entity_deletion.sql separately before using final deletion. Committing this file does not apply it.
Do not put SUPABASE_SECRET_KEY or VAULT_ACCESS_PASSWORD in NEXT_PUBLIC variables.

## Testing limits
Preview/local builds using production Supabase settings operate on real database records. Use only disposable test accounts/trades.
Undo works only before the client timer expires. Closing/reloading during that window cancels the pending request.
A lost response after a committed DELETE needs a re-fetch to reconcile; do not assume a network error means nothing was deleted.
Shared news events and other phase accounts are preserved. Linked screenshot files are not yet cleaned by this SQL.
