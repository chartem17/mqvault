# Single-source UI core

Surface appearance: src/components/ui/surface-styles.ts. Panel, Overview, forms, strategy and dialog compatibility definitions derive from it; layout-specific padding and shadows are explicit variants.

Metric rendering: src/components/ui/metric-card.tsx. Standard/compact/dashboard/summary preserve their existing value-size and spacing configurations. StatCard, MetricTile, StrategyMetricCard and StrategySummaryMetric remain public compatibility wrappers, not independent renderers. CardLabel/CardValue/CardHint use the same metric typography configuration.

Primitives use the existing cn/tailwind-merge helper instead of plain concatenation, so explicit consumer layout overrides resolve consistently. No new dependencies.

No consumer financial calculations, handlers, routes, API, authentication or database updates. No claim of full-site adoption: deferred screens and remaining specialized controls still need audit.

Pending: CI/build and visual regression in both themes, wrapping, metric colour classes, custom value colours, panel variants, dialogs, 360/560px rows and dense tables. Cleanup of unused CSS and completed one-off workflows follows only after verification and exact deletion approval. Production release is separate.
