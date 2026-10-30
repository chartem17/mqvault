# Prop rules v1: foundation, not a completed feature

This commit adds a settings contract, pure reference calculation, tests and an unapplied additive migration. Existing form, account API, Overview and data are not changed. CI does not apply or execute the SQL migration.

## Semantics
- Each condition has unknown, not_applicable or configured state. Inactive values can be retained without activating the rule.
- Legacy non-null values remain configured; legacy null means unknown, not absence of a requirement. Zero legacy minimum days is preserved as an explicit numeric value.
- Funded is a stage label, not a rule template and not proof of live capital.
- EOD trailing formula: max(initial capital, finalized EOD balances) * (1 - percent / 100). Example: 10400 * 0.95 = 9880.
- Percentage uses the EOD peak, never the initial balance as the deductible base. Static mode is a separate configuration.
- Rule timezone, day close and balance/equity control basis remain explicit nullable settings. Missing parameters must not receive guessed defaults.

## Reference calculation boundary
The pure function accepts finalized snapshots prepared by a trusted server adapter. It does not aggregate journal trades, determine EOD boundaries, prove provenance or coverage, reconcile cash flows, infer payout/reset behavior, apply a trailing cap, or decide breach/pass status. Historical setup changes and payout/reset events need an explicit supported policy before integrating historical results.

Completeness and source flags are trusted adapter assertions, not claims accepted from request JSON. Manual snapshots and journal estimates do not produce a broker reference. The function rejects mixed accounts, duplicate cutoff timestamps, future cutoff data and invalid decimals. Initial balance participates in the high-water mark. Monetary input supports up to 8 decimal places; percentage supports up to 6. BigInt arithmetic returns the exact unrounded decimal threshold. Broker tick/currency rounding is not selected here.

## Next integration steps
1. Test and separately approve/apply the migration to mqvault-dev; reconcile migration history before any blanket CLI migration push.
2. Extend owner-scoped account reads and sparse edits; enforce expected revision with a conditional update and return 409 for stale rule edits.
3. Add editing with explicit condition states and existing values preserved; integrate Overview visibility with those states.
4. Define and implement trusted finalized EOD data capture/coverage and cash-flow handling. Until available, display unavailable rather than a fabricated threshold.
5. Run API/database and browser acceptance tests. No automatic pass/fail or public launch is authorized by this foundation commit.

Do not drop old financial fields, rewrite existing accounts, disable RLS, expose service credentials or merge main as part of this step. SQL constraints and trigger require database testing separately; a green TypeScript run is not database validation.
