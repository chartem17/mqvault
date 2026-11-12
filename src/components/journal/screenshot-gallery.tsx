"use client";

import { Segmented } from "@/components/ui/segmented";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, Pencil, X } from "lucide-react";
import { Button, Select } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/empty-state";
import { useI18n } from "@/components/providers/i18n-provider";
import { useTimezone } from "@/components/providers/timezone-provider";
import type { JournalTrade } from "@/hooks/use-trades";
import type { TradingAccount } from "@/lib/accounts/account-data";
import { fmt } from "@/lib/journal/utils-trade";
import { formatDateTimeOrDash } from "@/lib/time/timezone";
import { msg } from "@/lib/i18n/core";
import { symbolKey } from "@/lib/journal/performance-breakdown";
import { GALLERY_PRESETS, galleryItems, isMistake, type GalleryPreset } from "@/lib/journal/screenshot-gallery";

const POS = "var(--color-green)", NEG = "var(--color-red)";
const PRESET_LABEL: Record<GalleryPreset, string> = { all: msg("All"), best: msg("Best"), worst: msg("Worst"), mistakes: msg("Mistakes") };
const signedR = (value: number | null | undefined) => (typeof value === "number" ? `${value > 0 ? "+" : ""}${value.toFixed(2)}R` : "—");
const rTone = (value: number | null | undefined) => (typeof value === "number" && value !== 0 ? { color: value > 0 ? POS : NEG } : undefined);

/** Screenshot gallery of the journal: big charts, presets for best/worst/mistakes, a full-screen viewer with arrows. */
export function ScreenshotGallery({ trades, accounts, onExit, onOpenTrade }: { trades: JournalTrade[]; accounts: TradingAccount[]; onExit: () => void; onOpenTrade: (trade: JournalTrade) => void }) {
  const { t, intl } = useI18n();
  const { timezone } = useTimezone();
  const [preset, setPreset] = useState<GalleryPreset>("all");
  const [symbol, setSymbol] = useState("");
  const [setup, setSetup] = useState("");
  const [open, setOpen] = useState<number | null>(null);
  const [failed, setFailed] = useState<Set<string>>(() => new Set());

  const items = useMemo(() => galleryItems(trades, { preset, symbol, setup }), [trades, preset, symbol, setup]);
  const symbols = useMemo(() => [...new Set(trades.filter(trade => trade.screenshot_url).map(trade => symbolKey(trade.symbol)))].filter(Boolean).sort(), [trades]);
  const setups = useMemo(() => [...new Set(trades.filter(trade => trade.screenshot_url && trade.setup?.trim()).map(trade => (trade.setup as string).trim()))].sort(), [trades]);
  const current = open === null ? null : items[open] ?? null;
  const date = (iso: string) => formatDateTimeOrDash(iso, timezone, intl);
  const accountName = (id: string) => accounts.find(account => account.id === id)?.name ?? t("Unknown account");

  useEffect(() => { setOpen(null); }, [preset, symbol, setup]);
  useEffect(() => {
    if (open === null) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") { event.preventDefault(); setOpen(null); }
      else if (event.key === "ArrowRight") { event.preventDefault(); setOpen(index => index === null ? null : Math.min(index + 1, items.length - 1)); }
      else if (event.key === "ArrowLeft") { event.preventDefault(); setOpen(index => index === null ? null : Math.max(index - 1, 0)); }
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [open, items.length]);

  return <div className="space-y-4">
    <div className="flex flex-wrap items-center gap-2">
      <h2 className="m-0 mr-2 text-lg font-semibold">{t("Screenshot gallery")}</h2>
      <Segmented aria-label={t("Gallery filter")} size="md" wrap value={preset} onChange={setPreset} options={GALLERY_PRESETS.map(item => ({ value: item, label: t(PRESET_LABEL[item]) }))} />
      <div className="flex min-w-0 flex-1 flex-wrap gap-2 sm:flex-none">
        <Select aria-label={t("Symbol")} value={symbol} onChange={event => setSymbol(event.target.value)} className="min-w-0 flex-1 rounded-full sm:w-auto sm:flex-none"><option value="">{t("All symbols")}</option>{symbols.map(item => <option key={item} value={item}>{item}</option>)}</Select>
        <Select aria-label={t("Setup")} value={setup} onChange={event => setSetup(event.target.value)} className="min-w-0 flex-1 rounded-full sm:w-auto sm:flex-none"><option value="">{t("All setups")}</option>{setups.map(item => <option key={item} value={item}>{t(item)}</option>)}</Select>
      </div>
      <Button variant="secondary" size="sm" className="ml-auto" onClick={onExit}><X className="h-4 w-4" />{t("Close gallery")}</Button>
    </div>
    <p role="status" className="m-0 text-xs text-muted-foreground">{preset === "best" ? t("Winning trades by R, best first.") : preset === "worst" ? t("Losing trades by R, worst first.") : preset === "mistakes" ? t("Trades with a marked mistake or reviewed as not to plan.") : t("Newest first.")} {t("{count} screenshots", { count: items.length })}</p>

    {items.length === 0 ? <EmptyState title={preset === "mistakes" ? t("No trades with marked mistakes yet.") : t("No screenshots match these filters.")} description={preset === "mistakes" ? t("Mark mistakes in the day review — they will show up here.") : undefined} /> :
      <ul className="m-0 grid list-none gap-3 p-0 [grid-template-columns:repeat(auto-fill,minmax(min(100%,300px),1fr))]">
        {items.map(({ trade, image }, index) => <li key={trade.id}>
          <button type="button" onClick={() => setOpen(index)} className="group block w-full overflow-hidden rounded-2xl border border-border bg-card text-left transition hover:border-primary/40 hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary" aria-label={t("Open chart {symbol} · {date}", { symbol: trade.symbol, date: date(trade.opened_at) })}>
            {failed.has(trade.id)
              ? <div className="flex aspect-[16/9] items-center justify-center bg-secondary/40 text-xs text-muted-foreground">{t("Image unavailable")}</div>
              : <img src={image} alt="" loading="lazy" decoding="async" onError={() => setFailed(current => new Set(current).add(trade.id))} className="aspect-[16/9] w-full bg-secondary/40 object-cover" />}
            <div className="space-y-1 p-3">
              <div className="flex items-center justify-between gap-2"><span className="font-semibold">{trade.symbol} <span className="text-xs font-normal" style={{ color: trade.direction === "Long" ? POS : NEG }}>{trade.direction}</span></span><span className="text-sm font-medium tabular-nums" style={rTone(trade.result_r)}>{signedR(trade.result_r)}</span></div>
              <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground"><span>{date(trade.opened_at)}</span>{(trade.setup || isMistake(trade)) && <span className="truncate">{[trade.setup ? t(trade.setup) : null, trade.mistake ? t(trade.mistake) : isMistake(trade) ? t("Not to plan") : null].filter(Boolean).join(" · ")}</span>}</div>
            </div>
          </button>
        </li>)}
      </ul>}

    {current && open !== null && <div role="dialog" aria-modal="true" aria-label={t("Chart {symbol}", { symbol: current.trade.symbol })} className="fixed inset-0 z-50 flex flex-col bg-black/90 text-white lg:flex-row" onClick={() => setOpen(null)}>
      <div className="relative flex min-h-0 flex-1 items-center justify-center p-2 sm:p-6">
        <img src={current.image} alt={t("Chart {symbol}", { symbol: current.trade.symbol })} className="max-h-full max-w-full rounded-lg object-contain" onClick={event => event.stopPropagation()} />
        <button type="button" aria-label={t("Previous")} disabled={open === 0} onClick={event => { event.stopPropagation(); setOpen(open - 1); }} className="absolute left-2 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30"><ChevronLeft className="h-6 w-6" /></button>
        <button type="button" aria-label={t("Next")} disabled={open === items.length - 1} onClick={event => { event.stopPropagation(); setOpen(open + 1); }} className="absolute right-2 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30"><ChevronRight className="h-6 w-6" /></button>
      </div>
      <aside className="max-h-[40vh] shrink-0 space-y-3 overflow-y-auto bg-black/60 p-4 text-sm lg:max-h-none lg:w-80" onClick={event => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-2"><div><div className="text-lg font-semibold">{current.trade.symbol} <span className="text-sm font-normal" style={{ color: current.trade.direction === "Long" ? POS : NEG }}>{current.trade.direction}</span></div><div className="text-xs text-white/60">{t("{position} of {count}", { position: open + 1, count: items.length })}</div></div><button type="button" aria-label={t("Close")} onClick={() => setOpen(null)} className="rounded-full p-1 hover:bg-white/10"><X className="h-5 w-5" /></button></div>
        <dl className="m-0 grid grid-cols-2 gap-x-4 gap-y-2">
          <div><dt className="text-xs text-white/60">{t("Opened")}</dt><dd className="m-0">{date(current.trade.opened_at)}</dd></div>
          <div><dt className="text-xs text-white/60">{t("Account")}</dt><dd className="m-0 truncate">{accountName(current.trade.account_id)}</dd></div>
          <div><dt className="text-xs text-white/60">R</dt><dd className="m-0 tabular-nums" style={rTone(current.trade.result_r)}>{signedR(current.trade.result_r)}</dd></div>
          <div><dt className="text-xs text-white/60">{t("Net P&L")}</dt><dd className="m-0 tabular-nums" style={rTone(current.trade.net_pnl)}>{typeof current.trade.net_pnl === "number" ? fmt.usd(current.trade.net_pnl) : "—"}</dd></div>
          <div><dt className="text-xs text-white/60">{t("Setup")}</dt><dd className="m-0">{current.trade.setup ? t(current.trade.setup) : "—"}</dd></div>
          <div><dt className="text-xs text-white/60">{t("Emotion")}</dt><dd className="m-0">{current.trade.emotion ? t(current.trade.emotion) : "—"}</dd></div>
          <div><dt className="text-xs text-white/60">{t("Mistake")}</dt><dd className="m-0">{current.trade.mistake ? t(current.trade.mistake) : "—"}</dd></div>
          <div><dt className="text-xs text-white/60">{t("Followed the plan")}</dt><dd className="m-0">{current.trade.review?.followed_plan === true ? t("Yes") : current.trade.review?.followed_plan === false ? t("No") : "—"}</dd></div>
        </dl>
        {current.trade.notes && <p className="m-0 whitespace-pre-wrap text-white/80">{current.trade.notes}</p>}
        <div className="flex flex-wrap gap-2 pt-1">
          <Button size="sm" onClick={() => { const trade = current.trade; setOpen(null); onOpenTrade(trade); }}><Pencil className="h-4 w-4" />{t("Open trade")}</Button>
          {current.trade.screenshot_url && <a href={current.trade.screenshot_url} target="_blank" rel="noreferrer" className="inline-flex min-h-8 items-center gap-1.5 rounded-xl border border-white/20 px-3 text-xs hover:bg-white/10"><ExternalLink className="h-3.5 w-3.5" />{t("Open on TradingView")}</a>}
        </div>
        <p className="m-0 text-xs text-white/50">{t("← → to browse · Esc to close")}</p>
      </aside>
    </div>}
  </div>;
}
