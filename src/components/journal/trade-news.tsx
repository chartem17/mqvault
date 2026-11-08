"use client";

import { Newspaper } from "lucide-react";
import { useI18n } from "@/components/providers/i18n-provider";
import { useTimezone } from "@/components/providers/timezone-provider";
import { msg } from "@/lib/i18n/core";
import type { NewsRelation, TradeNewsLink, TradeNewsSummary } from "@/lib/news/news-trades";

export const RELATION_LABEL: Record<NewsRelation, string> = {
  open_at_release: msg("Open at the release"),
  opened_near: msg("Opened within 30 min"),
  closed_near: msg("Closed within 30 min"),
  within_2h: msg("Within 2 hours"),
};
const RELATION_ORDER: NewsRelation[] = ["open_at_release", "opened_near", "closed_near", "within_2h"];
const TONE = {
  high: "border-red/30 bg-red/10 text-red",
  medium: "border-gold/30 bg-gold/10 text-gold",
} as const;

/** The strongest impact among links that touch the trade itself (not just the ±2 h band). */
function badgeImpact(summary: TradeNewsSummary | undefined): "high" | "medium" | null {
  if (!summary) return null;
  return summary.tags.includes("news:high") ? "high" : summary.tags.includes("news:medium") ? "medium" : null;
}

/** Small pill next to the symbol: red = a high-impact release hit the trade, amber = medium only. */
export function NewsBadge({ summary }: { summary: TradeNewsSummary | undefined }) {
  const { t } = useI18n();
  const impact = badgeImpact(summary);
  if (!impact || !summary) return null;
  const first = summary.links.filter(link => link.impact === impact && link.relation !== "within_2h")
    .sort((a, b) => RELATION_ORDER.indexOf(a.relation) - RELATION_ORDER.indexOf(b.relation))[0];
  const label = impact === "high" ? t("Red news") : t("News");
  const title = first ? `${first.currency} · ${first.title} · ${t(RELATION_LABEL[first.relation])}` : label;
  return <span title={title} aria-label={title} className={`inline-flex shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium leading-none ${TONE[impact]}`}>
    <Newspaper className="h-3 w-3" aria-hidden="true" />{label}
  </span>;
}

function offsetLabel(link: TradeNewsLink, t: ReturnType<typeof useI18n>["t"]) {
  const minutes = link.minutesFromOpen;
  if (minutes === 0) return t("at entry");
  const value = Math.abs(minutes);
  const amount = value < 60 ? t("{minutes} min", { minutes: value })
    : value % 60 === 0 ? t("{hours} h", { hours: value / 60 })
    : t("{hours} h {minutes} min", { hours: Math.floor(value / 60), minutes: value % 60 });
  return minutes < 0 ? t("{amount} before entry", { amount }) : t("{amount} after entry", { amount });
}

/** Trade ticket section: the releases around this trade, strongest relation first. */
export function TradeNewsSection({ summary, loading, error }: { summary: TradeNewsSummary | undefined; loading: boolean; error: boolean }) {
  const { t, intl } = useI18n();
  const { timezone } = useTimezone();
  const links = [...(summary?.links ?? [])].sort((a, b) =>
    (a.impact === b.impact ? 0 : a.impact === "high" ? -1 : 1) || RELATION_ORDER.indexOf(a.relation) - RELATION_ORDER.indexOf(b.relation) || a.eventTime.localeCompare(b.eventTime));
  const time = (iso: string) => new Date(iso).toLocaleString(intl, { timeZone: timezone, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  return <section aria-label={t("News around this trade")} className="space-y-2 rounded-xl border border-border bg-secondary/20 p-3">
    <div className="flex items-center gap-2 text-xs font-semibold"><Newspaper className="h-3.5 w-3.5 text-primary" aria-hidden="true" />{t("News around this trade")}</div>
    {loading ? <p className="m-0 text-xs text-muted-foreground">{t("Loading…")}</p>
      : error || !summary ? <p className="m-0 text-xs text-muted-foreground">{t("The economic calendar is not available for this trade.")}</p>
      : links.length === 0 ? <p className="m-0 text-xs text-muted-foreground">{summary.currencies.length ? t("No high or medium impact releases for {currencies} within 2 hours.", { currencies: summary.currencies.join(", ") }) : t("This instrument is not linked to calendar currencies.")}</p>
      : <ul className="m-0 list-none space-y-1.5 p-0">{links.map(link => <li key={link.eventId} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs">
        <span className={`rounded border px-1 py-px text-[10px] uppercase ${TONE[link.impact]}`}>{link.impact === "high" ? t("High") : t("Medium")}</span>
        <span className="font-medium">{link.currency}</span>
        <span className="min-w-0 flex-1 truncate">{link.title}</span>
        <span className="w-full text-muted-foreground sm:w-auto">{time(link.eventTime)} · {t(RELATION_LABEL[link.relation])} · {offsetLabel(link, t)}</span>
      </li>)}</ul>}
  </section>;
}
