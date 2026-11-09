"use client";

import { useMemo, useState } from "react";
import { useTrades } from "@/hooks/use-trades";
import { tradeNewsKey, useTradeNews } from "@/hooks/use-trade-news";
import { useI18n } from "@/components/providers/i18n-provider";
import { WidgetPanel } from "./widget-panel";
import { RELATION_LABEL } from "@/components/journal/trade-news";
import { fmt } from "@/lib/journal/utils-trade";
import { msg } from "@/lib/i18n/core";
import { MIN_SAMPLE } from "@/lib/journal/performance-breakdown";
import { NEWS_RELATIONS, newsImpactReport, type NewsBucket, type NewsStats, type TradeNewsSummary } from "@/lib/news/news-trades";

const GREEN = "var(--color-green)", RED = "var(--color-red)";
type View = "event" | "currency" | "relation";
const VIEWS: View[] = ["event", "currency", "relation"];
const VIEW_LABEL: Record<View, string> = { event: msg("Event"), currency: msg("Currency"), relation: msg("Relation") };
const BUCKETS: NewsBucket[] = ["near_high", "around_high", "clear"];
const BUCKET_LABEL: Record<NewsBucket, string> = { near_high: msg("Near red news"), around_high: msg("Red news within 2 h"), clear: msg("No red news") };
const BUCKET_HINT: Record<NewsBucket, string> = {
  near_high: msg("Open at a high-impact release, or opened / closed within 30 min of it"),
  around_high: msg("A high-impact release within 2 hours, but not closer"),
  clear: msg("No high-impact release of the trade's currencies within 2 hours"),
};
const tone = (value: number | null) => (value === null || value === 0 ? undefined : { color: value > 0 ? GREEN : RED });
const signedR = (value: number | null) => (value === null ? "—" : `${value > 0 ? "+" : ""}${value.toFixed(2)}R`);

type Row = { key: string; label: string; hint?: string; stats: NewsStats };

/** "News ↔ trades": results near red news vs without, then by event, currency or relation. n is always visible. */
export function NewsImpactWidget() {
  const { trades, visibleTrades } = useTrades();
  const { t } = useI18n();
  const key = useMemo(() => tradeNewsKey(trades), [trades]);
  const { byTrade, loading, error } = useTradeNews(key);
  const [view, setView] = useState<View>("event");

  const report = useMemo(() => {
    if (!byTrade) return null;
    const summaries = visibleTrades.map(trade => byTrade.get(trade.id)).filter((s): s is TradeNewsSummary => !!s);
    return newsImpactReport(visibleTrades, summaries);
  }, [byTrade, visibleTrades]);

  const bucketRows: Row[] = report ? BUCKETS.map(bucket => ({ key: bucket, label: t(BUCKET_LABEL[bucket]), hint: t(BUCKET_HINT[bucket]), stats: report.buckets[bucket] })) : [];
  const detailRows: Row[] = !report ? [] : view === "relation"
    ? NEWS_RELATIONS.map(relation => ({ key: relation, label: t(RELATION_LABEL[relation]), stats: report.byRelation[relation] })).filter(row => row.stats.trades > 0)
    : (view === "event" ? report.byEvent : report.byCurrency).map(group => ({ key: group.key, label: view === "event" ? `${group.currency} · ${group.label}` : group.label, stats: group }));

  const table = (rows: Row[], first: string) => <table className="w-full table-fixed text-xs tabular-nums">
    <thead className="sticky top-0 z-10 bg-card"><tr className="border-b border-border text-left text-muted-foreground">
      <th scope="col" className="w-[44%] py-2 pr-2 font-medium sm:w-[38%]">{first}</th>
      <th scope="col" className="px-2 py-2 text-right font-medium whitespace-nowrap">{t("Trades")}</th>
      <th scope="col" className="px-2 py-2 text-right font-medium">{t("Win %")}</th>
      <th scope="col" className="hidden px-2 py-2 text-right font-medium sm:table-cell">{t("Avg net")}</th>
      <th scope="col" className="hidden px-2 py-2 text-right font-medium sm:table-cell">{t("Avg R")}</th>
      <th scope="col" className="py-2 pl-2 text-right font-medium">{t("Net P&L")}</th>
    </tr></thead>
    <tbody>{rows.map(row => { const small = row.stats.trades < MIN_SAMPLE; return <tr key={row.key} className={`border-b border-border/50 ${small ? "opacity-55" : ""}`} title={small ? t("Small sample") : row.hint}>
      <th scope="row" className="py-2 pr-2 text-left font-normal leading-snug text-foreground sm:truncate">{row.label}</th>
      <td className="px-2 py-2 text-right" title={row.stats.rCount < row.stats.trades ? t("{count} with a known R", { count: row.stats.rCount }) : undefined}>{row.stats.trades}{row.stats.rCount < row.stats.trades && <span className="text-muted-foreground">*</span>}</td>
      <td className="px-2 py-2 text-right">{row.stats.winRate === null ? "—" : `${Math.round(row.stats.winRate)}%`}</td>
      <td className="hidden px-2 py-2 text-right sm:table-cell" style={tone(row.stats.avgNet)}>{row.stats.avgNet === null ? "—" : fmt.usd(row.stats.avgNet)}</td>
      <td className="hidden px-2 py-2 text-right sm:table-cell" style={tone(row.stats.avgR)}>{signedR(row.stats.avgR)}</td>
      <td className="py-2 pl-2 text-right" style={tone(row.stats.totalNet)}>{fmt.usd(row.stats.totalNet)}</td>
    </tr>; })}</tbody>
  </table>;

  return <WidgetPanel title={t("News ↔ trades")} sub={t("Closed trades · high-impact releases · fewer than {count} trades are dimmed", { count: MIN_SAMPLE })} scroll
    aside={report && <div role="radiogroup" aria-label={t("Group by")} className="flex flex-wrap gap-1">{VIEWS.map(item => <button key={item} type="button" role="radio" aria-checked={view === item} onClick={() => setView(item)} className={`min-h-8 rounded-full border px-2.5 text-xs transition-colors ${view === item ? "border-primary bg-primary text-primary-foreground" : "border-border bg-secondary/40 text-muted-foreground hover:text-foreground"}`}>{t(VIEW_LABEL[item])}</button>)}</div>}>
    {loading && !report ? <p role="status" className="text-sm text-muted-foreground">{t("Loading…")}</p>
      : error ? <p className="text-sm text-muted-foreground">{t("Could not load the economic calendar.")}</p>
      : !report ? <p className="text-sm text-muted-foreground">{t("No calendar data for the period of your trades.")}</p>
      : <div className="space-y-5">
        {table(bucketRows, t("Trades by news"))}
        {detailRows.length === 0 ? <p className="text-xs text-muted-foreground">{t("No trades near red news in this selection.")}</p>
          : <div><p className="mb-1 text-[11px] text-muted-foreground">{t("Near red news only; a trade near two releases counts in both rows.")}</p>{table(detailRows, t(VIEW_LABEL[view]))}</div>}
      </div>}
  </WidgetPanel>;
}
