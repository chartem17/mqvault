"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Flame, Pencil, Target } from "lucide-react";
import { useTrades } from "@/hooks/use-trades";
import { usePreferences } from "@/components/providers/preferences-provider";
import { useI18n } from "@/components/providers/i18n-provider";
import { Button, Input } from "@/components/ui/primitives";
import { goalStatus, monthProgress, reviewStreak } from "@/lib/dashboard/goals";

function Bar({ label, value, share, done, invert }: { label: string; value: string; share: number; done: boolean; invert?: boolean }) {
  const color = done ? "var(--color-green)" : invert ? "var(--color-red)" : "var(--color-primary)";
  return <div>
    <div className="flex items-baseline justify-between gap-3 text-sm"><span>{label}</span><span className="tabular-nums text-muted-foreground">{value}</span></div>
    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[rgb(var(--ink)/0.1)]"><div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${Math.round(share * 100)}%`, background: color }} /></div>
  </div>;
}

/** Goals for the current month (R, red days, reviewed share) and the streak of fully reviewed days. */
export function MonthlyGoals({ timezone, now }: { timezone: string; now: Date }) {
  const { t, tn, intl } = useI18n();
  const { visibleTrades } = useTrades();
  const { preferences, update } = usePreferences();
  const progress = useMemo(() => monthProgress(visibleTrades, timezone, now), [visibleTrades, timezone, now]);
  const streak = useMemo(() => reviewStreak(visibleTrades, timezone, now), [visibleTrades, timezone, now]);
  const goals = preferences.goals?.month === progress.month ? preferences.goals : null;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ targetR: "", maxRedDays: "", reviewShare: "" });
  const status = goals ? goalStatus(progress, goals) : null;
  const monthName = new Date(`${progress.month}-15T12:00:00Z`).toLocaleDateString(intl, { month: "long", timeZone: "UTC" });

  function open() {
    setDraft({ targetR: goals?.targetR?.toString() ?? "", maxRedDays: goals?.maxRedDays?.toString() ?? "", reviewShare: goals?.reviewShare?.toString() ?? "" });
    setEditing(true);
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    const num = (value: string) => value.trim() === "" ? null : Number(value.replace(",", "."));
    update({ goals: { month: progress.month, targetR: num(draft.targetR), maxRedDays: num(draft.maxRedDays), reviewShare: num(draft.reviewShare) } });
    setEditing(false);
  }

  return <section aria-label={t("Goals for the month")} className="space-y-4">
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="m-0 flex items-center gap-2 text-base font-semibold"><Target className="h-4 w-4 text-primary" aria-hidden="true" />{t("Goals for {month}", { month: monthName })}</h2>
      {!editing && <button type="button" onClick={open} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><Pencil className="h-3.5 w-3.5" aria-hidden="true" />{goals ? t("Edit") : t("Set goals")}</button>}
    </div>
    {editing ? <form onSubmit={submit} className="grid gap-3 sm:grid-cols-3">
      <label className="space-y-1"><span className="text-xs text-muted-foreground">{t("Result, R")}</span><Input inputMode="decimal" value={draft.targetR} onChange={event => setDraft({ ...draft, targetR: event.target.value })} placeholder="10" /></label>
      <label className="space-y-1"><span className="text-xs text-muted-foreground">{t("Red days, at most")}</span><Input inputMode="numeric" value={draft.maxRedDays} onChange={event => setDraft({ ...draft, maxRedDays: event.target.value })} placeholder="4" /></label>
      <label className="space-y-1"><span className="text-xs text-muted-foreground">{t("Reviewed trades, %")}</span><Input inputMode="numeric" value={draft.reviewShare} onChange={event => setDraft({ ...draft, reviewShare: event.target.value })} placeholder="90" /></label>
      <div className="flex gap-2 sm:col-span-3"><Button type="submit" size="sm">{t("Save")}</Button><Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>{t("Cancel")}</Button></div>
    </form> : status ? <div className="space-y-3.5">
      {status.r && <Bar label={t("Result")} value={`${status.r.value > 0 ? "+" : ""}${status.r.value}R / ${status.r.target}R`} share={status.r.share} done={status.r.done} />}
      {status.redDays && <Bar label={t("Red days")} value={`${status.redDays.value} / ${status.redDays.target}`} share={status.redDays.share} done={status.redDays.done && status.redDays.value < status.redDays.target} invert={!status.redDays.done} />}
      {status.review && <Bar label={t("Reviewed trades")} value={`${status.review.value}% / ${status.review.target}%`} share={status.review.share} done={status.review.done} />}
    </div> : <p className="m-0 text-sm text-muted-foreground">{t("Set a result, a cap on red days and how many trades you review — progress is tracked through the month.")}</p>}
    <p className="m-0 flex items-center gap-2 text-sm">
      <Flame className={`h-4 w-4 ${streak > 0 ? "text-gold" : "text-muted-foreground"}`} aria-hidden="true" />
      {streak > 0 ? <span>{tn(streak, "Review streak: {count} trading day", "Review streak: {count} trading days")}</span> : <span className="text-muted-foreground">{t("Review every trade of a day to start a streak.")}</span>}
    </p>
  </section>;
}
