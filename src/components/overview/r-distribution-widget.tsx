"use client";

import { useMemo } from "react";
import { useTrades } from "@/hooks/use-trades";
import { computeAdvancedStats, type RBucket } from "@/lib/advanced-stats";
import { useTimezone } from "@/components/providers/timezone-provider";
import { WidgetPanel } from "./widget-panel";

const GREEN = "var(--color-green)";
const RED = "var(--color-red)";
function RDistributionChart({ buckets }: { buckets: RBucket[] }) {
  const max = Math.max(...buckets.map(bucket => bucket.count), 1);
  const totalTrades = buckets.reduce((sum, bucket) => sum + bucket.count, 0);
  const bestBucket = buckets.length ? buckets.reduce((best, bucket) => bucket.count > best.count ? bucket : best, buckets[0]) : null;
  return <WidgetPanel title="R-розподіл" sub={`${totalTrades} угод`} aside={<div className="text-right text-xs text-muted-foreground">Найчастіше: {bestBucket?.range ?? "—"}</div>}>
    <div role="region" aria-label="R-Multiple distribution chart" tabIndex={0} className="h-full overflow-auto overscroll-contain focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"><div className="flex h-full min-h-[192px] min-w-[300px] items-end gap-1.5 sm:min-w-[420px] sm:gap-2">{buckets.map(bucket => { const heightPct = Math.max(bucket.count / max * 100, bucket.count > 0 ? 6 : 0), isNeg = bucket.range.trim().startsWith("<") || bucket.range.startsWith("-2") || bucket.range.startsWith("-1"); return <div key={bucket.range} className="flex h-full min-h-0 flex-1 flex-col items-center gap-2"><div className="text-[10px] text-muted-foreground">{bucket.count}</div><div className="flex min-h-0 w-full flex-1 items-end"><div className="w-full rounded-t-md" style={{ height: `${heightPct}%`, background: isNeg ? RED : GREEN, opacity: bucket.count > 0 ? 0.9 : 0.18 }} /></div><div className="text-[10px] text-muted-foreground">{bucket.range}</div></div>; })}</div></div>
  </WidgetPanel>;
}

export function RDistributionWidget() {
  const { visibleTrades } = useTrades();
  const { timezone } = useTimezone();
  const advanced = useMemo(() => computeAdvancedStats(visibleTrades, timezone), [visibleTrades, timezone]);
  return <RDistributionChart buckets={advanced.rDistribution} />;
}
