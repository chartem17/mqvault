# Timezone settings: shared control migration

Branch: feat/journal-layout-filters. Application code changed directly, without a migration workflow.

- TimezoneSelect now uses shared Button, Input and native Select.
- Removed local zinc/blue/hex surface colours and duplicated control borders/padding.
- Added an explicit label association and accessible search name.
- Retained native size=8 list behavior, current value, search/filter, offset labels, browser detection and existing provider setter.
- No timezone conversion, financial calculations, database values or production settings changed.
- Trade-ticket migration is now committed as 1214db7; this source record does not certify its Vercel or browser acceptance.

Pending: CI/build results; both-theme/mobile check; timezone search/selection persistence and automatic detection regression. Shared primitives still need other screen consumers migrated. Full site centralization is not complete.
