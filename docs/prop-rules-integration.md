# Editable prop rules integration

The prop account card in Overview loads owner-scoped settings from GET /api/accounts/:id/prop-rules and exposes an inline editor. PATCH accepts expectedRevision plus sparse settings and/or phase. Conditional database update enforces the expected revision. A conflict does not automatically retry or overwrite changes.

Apply the separately approved prop_rule_settings_v1 migration before enabling editing. Until then the new endpoint returns 503 schema_pending and the card retains a read-only legacy summary. No migration runs from CI or application startup.

Configured conditions are visible, not_applicable conditions are hidden without erasing values, and unknown conditions produce a neutral configuration notice. Funded does not imply live capital or alter conditions. New accounts still use the existing create form; advanced states and EOD parameters are edited after creation.

The EOD arithmetic remains isolated and unit-tested. The endpoint deliberately reports unavailable because trusted finalized balance history and cash-flow reconciliation are not integrated. No broker threshold, pass/fail, remaining-risk guarantee or automatic phase transition is fabricated. Payout/reset/cap policies and historical rule versions remain unsupported for calculations.

Revision protection applies to this dedicated editor endpoint. Legacy /api/accounts PATCH remains a compatibility path and is not advertised as revision-safe. Private single-owner authentication is unchanged; public multi-user launch is not part of this commit. SQL CI uses a disposable database and does not replace testing against actual Supabase policies and triggers. Browser acceptance is still required before merging main.
