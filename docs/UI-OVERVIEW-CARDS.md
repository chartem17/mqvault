# Overview shared cards: first step

Branch: feat/journal-layout-filters. Direct source edits; no migration workflow.

StatCard now composes Panel plus shared CardLabel/CardValue/CardHint. SectionHeader delegates to a shared SectionHeading and accepts optional actions without changing existing title/sub callers. Metric label/hint text and borders use semantic theme tokens instead of white-opacity utilities. Panel's default bg-card surface replaces StatCard's old bg-panel surface intentionally; no layout height is set by these primitives.

StatCard public props (including existing unused trend) and caller colorClass/className compatibility retained. No statistics, formatting, account scope, chart paths, scroll regions or 360px/560px row constraints modified. Existing Overview callers already use StatCard and SectionHeader and inherit these changes without rewriting the screen.

Not complete: Overview's inline CARD constant, chart/list headings, StreakStatCard and DrawdownPanel still have their own markup. Caller-provided emerald/rose classes remain until the screen is migrated to semantic gain/loss variants. Shared card content is reusable, not proof of full site adoption.

Pending: lint/TypeScript/Vercel result and browser review of metric text, contrast in both themes, wrapping at mobile widths and unchanged row geometry. Production release not included.
