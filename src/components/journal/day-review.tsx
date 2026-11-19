"use client";

import { Hint } from "@/components/ui/hint";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { screenshotImageUrl } from "@/lib/journal/screenshot-gallery";
import { ArrowLeft, ArrowRight, Check, CheckCheck, Plus, X } from "lucide-react";
import { Button, Input } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/empty-state";
import { useI18n } from "@/components/providers/i18n-provider";
import { useTimezone } from "@/components/providers/timezone-provider";
import type { JournalTrade, UpdateTradeInput } from "@/hooks/use-trades";
import type { TradingAccount } from "@/lib/accounts/account-data";
import { fmt } from "@/lib/journal/utils-trade";
import { getSessionLabel } from "@/lib/time/sessions";
import { timeLabel } from "@/lib/time/timezone";
import {
  DEFAULT_MISTAKES, DEFAULT_SETUPS, REVIEW_EMOTIONS, chipOptions, cleanChip, draftFor, markReviewedPatch, needsReview,
  parseReviewChips, reviewPatch, reviewQueue, usedValues, type ReviewChips, type ReviewDraft,
} from "@/lib/journal/trade-review";

const POS = "var(--color-green)", NEG = "var(--color-red)";
type Item = { id: string; day: string };
type Props = {
  trades: JournalTrade[];
  accounts: TradingAccount[];
  updateTrade: (input: UpdateTradeInput) => Promise<JournalTrade>;
  onExit: () => void;
};

function session(trade: JournalTrade) { try { return getSessionLabel(trade.opened_at); } catch { return trade.session || "—"; } }

/** Chips for one field: click to pick, click again to clear. Optional inline "add your own". */
function ChipRow({ label, options, value, onChange, allowAdd, translate }: { label: string; options: string[]; value: string; onChange: (value: string) => void; allowAdd?: boolean; translate: (text: string) => string }) {
  const { t } = useI18n();
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState("");
  const list = value && !options.some(option => option.toLowerCase() === value.toLowerCase()) ? [value, ...options] : options;
  function add() { const chip = cleanChip(text); if (chip) onChange(chip); setText(""); setAdding(false); }
  function onKey(event: ReactKeyboardEvent<HTMLInputElement>) {
    event.stopPropagation();
    if (event.key === "Enter") { event.preventDefault(); add(); }
    if (event.key === "Escape") { event.preventDefault(); setText(""); setAdding(false); }
  }
  return <fieldset className="m-0 min-w-0 space-y-2 border-0 p-0">
    <legend className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{label}</legend>
    <div className="flex flex-wrap gap-2">
      {list.map(option => {
        const selected = option.toLowerCase() === value.toLowerCase();
        return <button key={option} type="button" aria-pressed={selected} onClick={() => onChange(selected ? "" : option)} className={`min-h-9 rounded-full border px-3.5 text-sm transition-colors ${selected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-secondary/50 text-foreground hover:border-primary/50"}`}>{translate(option)}</button>;
      })}
      {allowAdd && (adding
        ? <span className="flex items-center gap-1"><Input autoFocus aria-label={t("New value for {label}", { label })} value={text} maxLength={60} onChange={event => setText(event.target.value)} onKeyDown={onKey} onBlur={add} className="h-9 w-40" /></span>
        : <button type="button" onClick={() => setAdding(true)} aria-label={t("Add your own: {label}", { label })} className="flex min-h-9 items-center gap-1 rounded-full border border-dashed border-border px-3 text-sm text-muted-foreground hover:text-foreground"><Plus className="h-3.5 w-3.5" />{t("Own")}</button>)}
    </div>
  </fieldset>;
}

/**
 * Day review: one trade at a time, chips instead of text fields, Enter saves and moves on.
 * The queue is fixed when the review starts, so a saved trade does not shift the order under the cursor.
 */
export function DayReview({ trades, accounts, updateTrade, onExit }: Props) {
  const { t, tn, intl } = useI18n();
  const { timezone } = useTimezone();
  const [items] = useState<Item[]>(() => reviewQueue(trades, timezone).flatMap(day => day.trades.map(trade => ({ id: trade.id, day: day.day }))));
  const [index, setIndex] = useState(0);
  const [draft, setDraft] = useState<ReviewDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(0);
  const [skipped, setSkipped] = useState(0);
  const [strategyChips, setStrategyChips] = useState<Map<string, ReviewChips>>(() => new Map());
  const root = useRef<HTMLDivElement | null>(null);

  const byId = useMemo(() => new Map(trades.map(trade => [trade.id, trade])), [trades]);
  const item = items[index] as Item | undefined;
  const trade = item ? byId.get(item.id) : undefined;
  const done = index >= items.length;

  // The draft starts from what the trade already has; it resets only when the cursor moves.
  useEffect(() => { setDraft(trade ? draftFor(trade) : null); setError(null); }, [item?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const abort = new AbortController();
    fetch("/api/strategies?accountId=all", { cache: "no-store", credentials: "same-origin", signal: abort.signal })
      .then(response => (response.ok ? response.json() : null))
      .then((payload: { strategies?: { account_id?: unknown; definition?: { review?: unknown } }[] } | null) => {
        const map = new Map<string, ReviewChips>();
        for (const row of payload?.strategies ?? []) {
          if (typeof row.account_id !== "string") continue;
          const chips = parseReviewChips(row.definition?.review), current = map.get(row.account_id);
          map.set(row.account_id, current ? { setups: [...current.setups, ...chips.setups], mistakes: [...current.mistakes, ...chips.mistakes] } : chips);
        }
        setStrategyChips(map);
      })
      .catch(() => { /* Without strategy lists the review still offers journal values and defaults. */ });
    return () => abort.abort();
  }, []);

  const usedSetups = useMemo(() => usedValues(trades.map(item => item.setup)), [trades]);
  const usedMistakes = useMemo(() => usedValues(trades.map(item => item.mistake)), [trades]);
  const own = trade ? strategyChips.get(trade.account_id) : undefined;
  const setupOptions = chipOptions(own?.setups ?? [], usedSetups, DEFAULT_SETUPS);
  const mistakeOptions = chipOptions(own?.mistakes ?? [], usedMistakes, DEFAULT_MISTAKES);

  const dayItems = useMemo(() => items.filter(entry => entry.day === item?.day), [items, item?.day]);
  const dayPosition = item ? dayItems.findIndex(entry => entry.id === item.id) + 1 : 0;
  const dayNet = useMemo(() => {
    const values = dayItems.map(entry => byId.get(entry.id)?.net_pnl);
    return values.every(value => typeof value === "number") ? (values as number[]).reduce((sum, value) => sum + value, 0) : null;
  }, [dayItems, byId]);
  const dayLabel = item ? new Date(`${item.day}T12:00:00Z`).toLocaleDateString(intl, { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) : "";

  const move = useCallback((step: number) => setIndex(current => Math.min(Math.max(current + step, 0), items.length)), [items.length]);

  const save = useCallback(async () => {
    if (!trade || !draft || saving) return;
    setSaving(true); setError(null);
    try { await updateTrade(reviewPatch(trade.id, draft)); setSaved(count => count + 1); move(1); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Failed to update trade"); }
    finally { setSaving(false); }
  }, [trade, draft, saving, updateTrade, move]);

  function skip() { if (saving) return; setSkipped(count => count + 1); move(1); }

  /** Marks the rest of this day reviewed without changing any field; for days that need no notes. */
  async function finishDay() {
    if (!item || saving) return;
    setSaving(true); setError(null);
    const rest = items.slice(index).filter(entry => entry.day === item.day);
    let marked = 0;
    try {
      for (const entry of rest) {
        const current = byId.get(entry.id);
        if (!current || !needsReview(current)) { marked++; continue; }
        await updateTrade(markReviewedPatch(current));
        marked++;
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Failed to update trade"); }
    finally {
      setSaving(false);
      setSaved(count => count + marked);
      if (marked) setIndex(current => current + marked);
    }
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA";
      if (event.key === "Escape" && !typing) { event.preventDefault(); onExit(); return; }
      if (typing || event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key === "Enter" && target?.tagName !== "BUTTON") { event.preventDefault(); void save(); }
      else if (event.key === "ArrowRight") { event.preventDefault(); skip(); }
      else if (event.key === "ArrowLeft") { event.preventDefault(); move(-1); }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  useEffect(() => { root.current?.scrollIntoView({ block: "nearest" }); }, [index]);

  const update = (patch: Partial<ReviewDraft>) => setDraft(current => (current ? { ...current, ...patch } : current));
  const accountName = (id: string) => accounts.find(account => account.id === id)?.name ?? t("Unknown account");
  const translate = (text: string) => t(text);

  const header = <div className="flex flex-wrap items-center gap-3">
    <div className="min-w-0 flex-1">
      <h2 className="m-0 text-lg font-semibold">{t("Day review")}</h2>
      <p className="m-0 text-xs text-muted-foreground">{items.length ? t("{done} of {total} · saved {saved}, skipped {skipped}", { done: Math.min(index, items.length), total: items.length, saved, skipped }) : t("Nothing to review")}</p>
    </div>
    <Button variant="secondary" size="sm" onClick={onExit}><X className="h-4 w-4" />{t("Close review")}</Button>
  </div>;

  if (!items.length || done) return <div ref={root} className="space-y-6">
    {header}
    <EmptyState title={items.length ? t("Review finished") : t("Every trade is reviewed.")} description={items.length ? tn(saved, "{count} trade marked", "{count} trades marked") : t("New trades appear here until you mark them.")} action={<div className="flex flex-wrap justify-center gap-2">{items.length > 0 && <Button variant="secondary" size="sm" onClick={() => setIndex(Math.max(items.length - 1, 0))}><ArrowLeft className="h-4 w-4" />{t("Back")}</Button>}<Button size="sm" onClick={onExit}>{t("Back to journal")}</Button></div>} />
  </div>;

  if (!trade || !draft) return <div ref={root} className="space-y-6">{header}<EmptyState title={t("This trade is no longer available.")} action={<Button size="sm" onClick={() => move(1)}>{t("Next")}</Button>} /></div>;

  const pnl = typeof trade.net_pnl === "number" ? trade.net_pnl : null;
  return <div ref={root} className="space-y-6">
    {header}
    <div className="h-1 overflow-hidden rounded-full bg-secondary" aria-hidden="true"><div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${(index / items.length) * 100}%` }} /></div>

    <section aria-label={t("Day")} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
      <h3 className="m-0 text-base font-medium first-letter:uppercase">{dayLabel}</h3>
      <p className="m-0 text-sm text-muted-foreground">{t("Trade {position} of {count} this day", { position: dayPosition, count: dayItems.length })}{dayNet !== null && <> · <span style={{ color: dayNet >= 0 ? POS : NEG }}>{fmt.usd(dayNet)}</span></>}</p>
    </section>

    <article aria-label={t("Trade {symbol}", { symbol: trade.symbol })} className="grid gap-6 rounded-2xl border border-border bg-card p-4 sm:p-6 lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
      <div className="space-y-3">
        <div className="flex items-baseline justify-between gap-3"><span className="text-2xl font-semibold">{trade.symbol}</span><span className="text-sm font-medium" style={{ color: trade.direction === "Long" ? POS : NEG }}>{trade.direction}</span></div>
        <dl className="m-0 grid grid-cols-2 gap-x-4 gap-y-2 text-sm lg:grid-cols-1">
          <div><dt className="text-xs text-muted-foreground">{t("Time")}</dt><dd className="m-0 tabular-nums">{timeLabel(trade.opened_at, timezone)}{trade.closed_at ? ` → ${timeLabel(trade.closed_at, timezone)}` : ""}</dd></div>
          <div><dt className="text-xs text-muted-foreground">{t("Session")}</dt><dd className="m-0">{session(trade)}</dd></div>
          <div><dt className="text-xs text-muted-foreground">{t("Net P&L")}</dt><dd className="m-0 tabular-nums" style={pnl === null ? undefined : { color: pnl >= 0 ? POS : NEG }}>{pnl === null ? "—" : fmt.usd(pnl)}</dd></div>
          <div><dt className="text-xs text-muted-foreground">R</dt><dd className="m-0 tabular-nums">{typeof trade.result_r === "number" ? fmt.r(trade.result_r) : "—"}</dd></div>
          <div className="col-span-2 lg:col-span-1"><dt className="text-xs text-muted-foreground">{t("Account")}</dt><dd className="m-0 truncate">{accountName(trade.account_id)}</dd></div>
        </dl>
        {screenshotImageUrl(trade.screenshot_url) && <a href={trade.screenshot_url ?? undefined} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl border border-border"><img src={screenshotImageUrl(trade.screenshot_url) ?? undefined} alt={t("Chart of the trade")} className="h-32 w-full object-cover" /></a>}
      </div>

      <div className="min-w-0 space-y-5">
        <ChipRow label={t("Setup")} options={setupOptions} value={draft.setup} onChange={setup => update({ setup })} allowAdd translate={translate} />
        <ChipRow label={t("Emotion")} options={[...REVIEW_EMOTIONS]} value={draft.emotion} onChange={emotion => update({ emotion })} translate={translate} />
        <fieldset className="m-0 space-y-2 border-0 p-0">
          <legend className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{t("Followed the plan")}</legend>
          <div className="flex flex-wrap gap-2">{([[true, t("Yes")], [false, t("No")]] as const).map(([value, label]) => {
            const selected = draft.followedPlan === value;
            return <button key={String(value)} type="button" aria-pressed={selected} onClick={() => update({ followedPlan: selected ? null : value })} className={`min-h-9 min-w-16 rounded-full border px-4 text-sm transition-colors ${selected ? "border-transparent text-white" : "border-border bg-secondary/50 hover:border-primary/50"}`} style={selected ? { background: value ? POS : NEG } : undefined}>{label}</button>;
          })}</div>
        </fieldset>
        <ChipRow label={t("Mistake")} options={mistakeOptions} value={draft.mistake} onChange={mistake => update({ mistake })} allowAdd translate={translate} />
        <label className="block space-y-2">
          <span className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{t("Note")}</span>
          <Input value={draft.notes} onChange={event => update({ notes: event.target.value })} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); void save(); } }} placeholder={t("One line, optional")} />
        </label>
      </div>
    </article>

    {error && <div role="alert" className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive">{t(error)}</div>}

    <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] z-10 flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card/95 p-2 backdrop-blur md:bottom-4">
      <Button variant="ghost" size="md" aria-label={t("Previous trade")} disabled={index === 0 || saving} onClick={() => move(-1)}><ArrowLeft className="h-4 w-4" /><span className="hidden sm:inline">{t("Back")}</span></Button>
      <Button variant="secondary" size="md" disabled={saving} onClick={skip}>{t("Skip")}<ArrowRight className="h-4 w-4" /></Button>
      <Hint label={t("Marks the remaining trades of this day as reviewed without changing them")}><Button variant="ghost" size="md" disabled={saving} onClick={() => void finishDay()}><CheckCheck className="h-4 w-4" /><span className="hidden sm:inline">{t("Day is fine")}</span></Button></Hint>
      <span className="ml-auto hidden text-xs text-muted-foreground lg:inline">{t("Enter — save · → skip · ← back · Esc — close")}</span>
      <Button size="md" className="w-full sm:ml-auto sm:w-auto lg:ml-0" loading={saving} onClick={() => void save()}><Check className="h-4 w-4" />{t("Save and next")}</Button>
    </div>
  </div>;
}
