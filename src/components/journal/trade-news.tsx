"use client";

import { Newspaper } from "lucide-react";
import { useI18n } from "@/components/providers/i18n-provider";
import { useTimezone } from "@/components/providers/timezone-provider";
import { msg } from "@/lib/i18n/core";
import { edgeNewsLinks, type EdgeNewsLink, type NewsRelation, type TradeNewsSummary } from "@/lib/news/news-trades";

export const RELATION_LABEL: Record<NewsRelation, string> = {
  open_at_release: msg("Open at the release"),
  opened_near: msg("Opened within 30 min"),
  closed_near: msg("Closed within 30 min"),
  within_2h: msg("Within 2 hours"),
};

/** Small red pill next to the symbol: a red release came within 1 hour of the trade's entry or exit. */
export function NewsBadge({ summary }: { summary: TradeNewsSummary | undefined }) {
  const { t } = useI18n();
  const first = summary ? edgeNewsLinks(summary.links)[0] : undefined;
  if (!first) return null;
  const label = t("Red news");
  const title = `${first.currency} · ${first.title} · ${offsetLabel(first, t)}`;
  return <span title={title} aria-label={title} className="inline-flex shrink-0 items-center gap-1 rounded-md border border-red/30 bg-red/10 px-1.5 py-0.5 text-[10px] font-medium leading-none text-red">
    <Newspaper className="h-3 w-3" aria-hidden="true" />{label}
  </span>;
}

/** "27 min after entry", "at exit", … relative to the nearer edge of the trade. */
export function edgeOffsetLabel(edge: "entry" | "exit", minutes: number, t: ReturnType<typeof useI18n>["t"]) {
  if (minutes === 0) return edge === "entry" ? t("at entry") : t("at exit");
  const amount = t("{minutes} min", { minutes: Math.abs(minutes) });
  if (edge === "entry") return minutes < 0 ? t("{amount} before entry", { amount }) : t("{amount} after entry", { amount });
  return minutes < 0 ? t("{amount} before exit", { amount }) : t("{amount} after exit", { amount });
}
const offsetLabel = (link: EdgeNewsLink, t: ReturnType<typeof useI18n>["t"]) => edgeOffsetLabel(link.edge, link.edgeMinutes, t);

/** Trade ticket section: red releases within 1 hour of the trade's entry or exit; nothing else. */
export function TradeNewsSection({ summary, loading, error }: { summary: TradeNewsSummary | undefined; loading: boolean; error: boolean }) {
  const { t, intl } = useI18n();
  const { timezone } = useTimezone();
  const links = summary ? edgeNewsLinks(summary.links) : [];
  const time = (iso: string) => new Date(iso).toLocaleString(intl, { timeZone: timezone, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  return <section aria-label={t("Red news near this trade")} className="space-y-2 rounded-xl border border-border bg-secondary/20 p-3">
    <div className="flex items-center gap-2 text-xs font-semibold"><Newspaper className="h-3.5 w-3.5 text-primary" aria-hidden="true" />{t("Red news within 1 hour of entry or exit")}</div>
    {loading ? <p className="m-0 text-xs text-muted-foreground">{t("Loading…")}</p>
      : error || !summary ? <p className="m-0 text-xs text-muted-foreground">{t("The economic calendar is not available for this trade.")}</p>
      : links.length === 0 ? <p className="m-0 text-xs text-muted-foreground">{summary.currencies.length ? t("No red news for {currencies} within 1 hour of entry or exit.", { currencies: summary.currencies.join(", ") }) : t("This instrument is not linked to calendar currencies.")}</p>
      : <ul className="m-0 list-none space-y-1 p-0">{links.map(link => <li key={link.eventId} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs">
        <span className="font-medium text-red">{link.currency}</span>
        <span className="min-w-0 flex-1 truncate">{link.title}</span>
        <span className="w-full text-muted-foreground sm:w-auto">{time(link.eventTime)} · {offsetLabel(link, t)}</span>
      </li>)}</ul>}
  </section>;
}
