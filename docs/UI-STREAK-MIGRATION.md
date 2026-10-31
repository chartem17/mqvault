# Streak card shared surfaces

Branch: feat/journal-layout-filters. Direct source edit; no migration workflow.

StreakStatCard and its portal use shared Panel. Label uses CardLabel. Hardcoded white text/borders replaced with semantic theme tokens; win/loss gradient now derives from green/red tokens. Shared Panel's bg-card and radius replace previous bespoke bg-panel/card-popover surfaces.

Streak ordering, zero-result reset, longest/current calculations, balance denominator, formatting, coordinates, 120ms close timer and click/hover behavior retained. No global row heights, financial APIs or database updates.

Pending: CI/build, both themes, empty/win/loss/break-even sequences, all/single-account totals, popover position and hover/click regression. Existing keyboard/touch/viewport limitations are not claimed fixed. Overview inline CARD, chart/list headings and Drawdown still need migration. Not a full Overview redesign or production release.
