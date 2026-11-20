"use client";

import { useMemo, useState } from "react";
import { Lightbulb } from "lucide-react";
import { Button, Select } from "@/components/ui/primitives";
import { useI18n } from "@/components/providers/i18n-provider";
import { useTimezone } from "@/components/providers/timezone-provider";
import { useTrades, type JournalTrade } from "@/hooks/use-trades";
import { fmt } from "@/lib/journal/utils-trade";
import { formatDateTimeOrDash } from "@/lib/time/timezone";
import { ideaCandidates, ideaTrades, summarizeIdea } from "@/lib/journal/trade-idea";

async function send(method: "POST" | "DELETE", body: Record<string, unknown>) {
  const response = await fetch("/api/journal/ideas", { method, credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json().catch(() => null) as { error?: string } | null;
  if (!response.ok) throw new Error(data?.error ?? "Could not save");
}

/**
 * One idea made of several trades (ADR 0022): link this trade with another entry on the same move and see the
 * idea as a whole — R = total net / total initial risk, planned RR weighted by risk, volume-weighted entry.
 */
export function TradeIdeaPanel({ trade }: { trade: JournalTrade }) {
  const { t, intl } = useI18n();
  const { timezone } = useTimezone();
  const { trades, refreshTrades } = useTrades();
  const current = trades.find(item => item.id === trade.id) ?? trade;
  const members = useMemo(() => current.idea ? ideaTrades(current.idea.id, trades) : [], [current.idea, trades]);
  const candidates = useMemo(() => ideaCandidates(current, trades).slice(0, 20), [current, trades]);
  const summary = members.length > 1 ? summarizeIdea(members) : null;
  const [pick, setPick] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const when = (iso: string) => formatDateTimeOrDash(iso, timezone, intl);

  async function run(action: () => Promise<void>) {
    setBusy(true); setError(null);
    try { await action(); await refreshTrades(); setPick(""); }
    catch (reason) { setError(reason instanceof Error ? t(reason.message) : t("Could not save")); }
    finally { setBusy(false); }
  }

  return <section aria-label={t("Trade idea")} className="space-y-2 rounded-xl border border-border bg-secondary/20 p-3">
    <div className="flex items-center gap-2 text-xs font-semibold"><Lightbulb className="h-3.5 w-3.5 text-primary" aria-hidden="true" />{t("Trade idea")}</div>
    {summary ? <>
      <p className="m-0 text-xs text-muted-foreground">{t("This trade is part of an idea of {count} trades. Each keeps its own R; the idea is judged as a whole.", { count: summary.count })}</p>
      <dl className="m-0 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-3">
        <div><dt className="text-muted-foreground">{t("Idea R")}</dt><dd className="m-0 font-medium tabular-nums">{summary.r !== null ? fmt.r(summary.r) : "—"}</dd></div>
        <div><dt className="text-muted-foreground">{t("Net")}</dt><dd className="m-0 tabular-nums">{summary.net !== null ? fmt.usd(summary.net) : "—"}</dd></div>
        <div><dt className="text-muted-foreground">{t("Total risk")}</dt><dd className="m-0 tabular-nums">{summary.riskPercent !== null ? `${summary.riskPercent}%` : summary.risk !== null ? fmt.usd(-summary.risk) : "—"}</dd></div>
        <div><dt className="text-muted-foreground">{t("Planned RR")}</dt><dd className="m-0 tabular-nums">{summary.plannedRR ?? "—"}</dd></div>
        <div><dt className="text-muted-foreground">{t("Average entry")}</dt><dd className="m-0 tabular-nums">{summary.averageEntry ?? "—"}</dd></div>
      </dl>
      {summary.open && <p className="m-0 text-xs text-muted-foreground">{t("Some trades are still open: net and R cover the closed ones.")}</p>}
      {summary.r === null && !summary.open && <p className="m-0 text-xs text-muted-foreground">{t("Idea R needs the initial risk of every trade.")}</p>}
      <ul className="m-0 list-none space-y-1 p-0">{members.map(member => <li key={member.id} className="flex flex-wrap items-baseline justify-between gap-2 text-xs">
        <span className={member.id === current.id ? "font-medium" : ""}>{member.symbol} {member.direction} · {when(member.opened_at)}{typeof member.risk_percent === "number" ? ` · ${member.risk_percent}%` : ""}</span>
        <span className="flex items-center gap-2"><span className="tabular-nums">{typeof member.result_r === "number" ? fmt.r(member.result_r) : "—"}</span>
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => void run(() => send("DELETE", { trade_id: member.id }))}>{t("Unlink")}</Button></span>
      </li>)}</ul>
    </> : <p className="m-0 text-xs text-muted-foreground">{t("Link this trade with another entry on the same move (same account, instrument and direction) to see the idea's R: total net over total initial risk.")}</p>}
    {candidates.length > 0 ? <div className="flex flex-wrap items-center gap-2">
      <Select aria-label={t("Trade to link")} className="min-w-0 flex-1" value={pick} onChange={event => setPick(event.target.value)}>
        <option value="">{t("Choose a trade…")}</option>
        {candidates.map(candidate => <option key={candidate.id} value={candidate.id}>{candidate.symbol} {candidate.direction} · {when(candidate.opened_at)}{typeof candidate.result_r === "number" ? ` · ${fmt.r(candidate.result_r)}` : ""}</option>)}
      </Select>
      <Button size="sm" variant="secondary" disabled={!pick || busy} loading={busy} onClick={() => void run(() => send("POST", { trade_ids: [current.id, pick] }))}>{t("Link")}</Button>
    </div> : !summary && <p className="m-0 text-xs text-muted-foreground">{t("No matching trades within 72 hours.")}</p>}
    {error && <p role="alert" className="m-0 text-xs text-red">{error}</p>}
  </section>;
}
