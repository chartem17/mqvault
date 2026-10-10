"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, TrendingDown } from "lucide-react";
import { useTrades, type JournalTrade } from "@/hooks/use-trades";
import { fmt } from "@/lib/utils-trade";

const RED = "var(--color-red)";
const GREEN = "var(--color-green)";
const CARD = "rounded-2xl border border-white/10 bg-background";

type DDTrade = JournalTrade;

type Point = {
  trade: DDTrade;
  pnl: number;
  peak: number;
  ddAmount: number;
  ddPct: number;
};

type Episode = {
  id: string;
  peakIndex: number;
  troughIndex: number;
  recoverIndex: number | null;
  peakDate: string;
  troughDate: string;
  recoverDate: string | null;
  ddAmount: number;
  ddPct: number;
  trades: DDTrade[];
};

function dayOf(trade: { opened_at?: string | null }) {
  return (trade.opened_at ?? "").slice(0, 10);
}

function chronological<T extends { opened_at?: string | null }>(items: T[]) {
  return [...items].sort((a, b) => (a.opened_at ?? "").localeCompare(b.opened_at ?? ""));
}

function daysBetween(a: string, b: string) {
  const start = new Date(a).getTime();
  const end = new Date(b).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return 0;
  return Math.max(0, Math.round((end - start) / 86400000));
}

function buildEpisodes(trades: DDTrade[], baseBalance: number) {
  const sorted = chronological(trades);
  const points: Point[] = [];
  let pnl = 0;
  let peak = 0;

  for (const trade of sorted) {
    pnl += trade.net_pnl ?? 0;
    peak = Math.max(peak, pnl);
    const ddAmount = pnl - peak;
    const denominator = baseBalance + peak;
    const ddPct = denominator > 0 ? (ddAmount / denominator) * 100 : 0;
    points.push({ trade, pnl, peak, ddAmount, ddPct });
  }

  const episodes: Episode[] = [];
  let peakIndex: number | null = null;
  let troughIndex: number | null = null;

  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];

    if (point.ddAmount < 0) {
      if (peakIndex === null) peakIndex = Math.max(0, index - 1);
      if (troughIndex === null || point.ddAmount < points[troughIndex].ddAmount) troughIndex = index;
      continue;
    }

    if (peakIndex !== null) {
      const trough = troughIndex ?? peakIndex;
      episodes.push({
        id: `${points[peakIndex].trade.id}-${points[index].trade.id}`,
        peakIndex,
        troughIndex: trough,
        recoverIndex: index,
        peakDate: dayOf(points[peakIndex].trade),
        troughDate: dayOf(points[trough].trade),
        recoverDate: dayOf(point.trade),
        ddAmount: points[trough].ddAmount,
        ddPct: points[trough].ddPct,
        trades: sorted.slice(peakIndex + 1, index + 1),
      });
      peakIndex = null;
      troughIndex = null;
    }
  }

  if (peakIndex !== null) {
    const trough = troughIndex ?? peakIndex;
    episodes.push({
      id: `${points[peakIndex].trade.id}-active`,
      peakIndex,
      troughIndex: trough,
      recoverIndex: null,
      peakDate: dayOf(points[peakIndex].trade),
      troughDate: dayOf(points[trough].trade),
      recoverDate: null,
      ddAmount: points[trough].ddAmount,
      ddPct: points[trough].ddPct,
      trades: sorted.slice(peakIndex + 1),
    });
  }

  return { points, episodes };
}

function mostFrequent(values: string[]) {
  const valid = values.filter(Boolean);
  if (!valid.length) return "—";
  const counts = valid.reduce<Record<string, number>>((map, value) => {
    map[value] = (map[value] ?? 0) + 1;
    return map;
  }, {});
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

function EpisodeDetails({ episode, accountNames }: { episode: Episode; accountNames: Record<string, string> }) {
  const trades = episode.trades;
  const wins = trades.filter((trade) => (trade.net_pnl ?? 0) > 0).length;
  const losses = trades.filter((trade) => (trade.net_pnl ?? 0) < 0).length;
  const totalPnl = trades.reduce((sum, trade) => sum + (trade.net_pnl ?? 0), 0);
  const averageRisk = trades.filter((trade) => (trade.risk_percent ?? 0) > 0).reduce((sum, trade, _, list) => sum + (trade.risk_percent ?? 0) / list.length, 0);
  const largestLoss = Math.min(0, ...trades.map((trade) => trade.net_pnl ?? 0));
  const involvedAccounts = [...new Set(trades.map((trade) => accountNames[trade.account_id] || "Unknown account"))];
  const durationEnd = episode.recoverDate ?? episode.troughDate;

  return (
    <div className="grid gap-3 border-t border-white/10 px-4 py-4 text-xs sm:grid-cols-2 xl:grid-cols-4">
      <div className="space-y-1">
        <div className="text-[10px] uppercase tracking-wide text-white/35">Timeline</div>
        <div className="text-white/70">Peak → trough: {episode.peakDate} → {episode.troughDate}</div>
        <div className="text-white/45">{daysBetween(episode.peakDate, durationEnd)} days · {trades.length} trades</div>
      </div>

      <div className="space-y-1">
        <div className="text-[10px] uppercase tracking-wide text-white/35">Execution</div>
        <div className="text-white/70">{wins} wins · {losses} losses</div>
        <div className="text-white/45">Largest loss: <span style={{ color: RED }}>{fmt.usd(largestLoss)}</span></div>
        <div className="text-white/45">Average risk: {averageRisk > 0 ? fmt.pct(averageRisk) : "—"}</div>
      </div>

      <div className="space-y-1">
        <div className="text-[10px] uppercase tracking-wide text-white/35">Pattern</div>
        <div className="text-white/70">Worst pair: {mostFrequent(trades.map((trade) => trade.symbol || ""))}</div>
        <div className="text-white/45">Main session: {mostFrequent(trades.map((trade) => trade.session || ""))}</div>
        <div className="text-white/45">Episode P&L: <span style={{ color: totalPnl < 0 ? RED : GREEN }}>{fmt.usd(totalPnl)}</span></div>
      </div>

      <div className="space-y-1">
        <div className="text-[10px] uppercase tracking-wide text-white/35">Context</div>
        <div className="text-white/70">{episode.recoverDate ? `Recovered ${episode.recoverDate}` : "Recovery in progress"}</div>
        <div className="text-white/45">Accounts: {involvedAccounts.join(" · ")}</div>
      </div>
    </div>
  );
}

function MetricTile({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className={`${CARD} p-4`}>
      <div className="text-[11px] uppercase tracking-wide text-white/40">{label}</div>
      <div className="mt-1 text-lg font-semibold" style={{ color }}>{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-white/40">{sub}</div>}
    </div>
  );
}

export function DrawdownPanel() {
  const { visibleTrades, accounts, includedAccountIds, activeAccountId, activeAccount } = useTrades();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const baseBalance = useMemo(() => {
    if (activeAccountId !== "all" && activeAccount) return activeAccount.initialBalance || 0;
    return accounts
      .filter((account) => includedAccountIds.includes(account.id))
      .reduce((sum, account) => sum + (account.initialBalance || 0), 0);
  }, [activeAccountId, activeAccount, accounts, includedAccountIds]);

  const trades = visibleTrades as DDTrade[];
  const { points, episodes } = useMemo(() => buildEpisodes(trades, baseBalance), [trades, baseBalance]);
  const accountNames = useMemo(() => Object.fromEntries(accounts.map((account) => [account.id, account.name])), [accounts]);

  const worstEpisode = useMemo(
    () => episodes.reduce<Episode | null>((worst, episode) => (!worst || episode.ddPct < worst.ddPct ? episode : worst), null),
    [episodes],
  );

  const latestPoint = points[points.length - 1];
  const activeEpisode = latestPoint?.ddAmount < 0 ? episodes[episodes.length - 1] : null;
  const lastRecovered = [...episodes].reverse().find((episode) => episode.recoverIndex !== null) ?? null;
  const longestUnderwaterDays = episodes.reduce((max, episode) => {
    const end = episode.recoverDate ?? (latestPoint ? dayOf(latestPoint.trade) : undefined) ?? episode.troughDate;
    return Math.max(max, daysBetween(episode.peakDate, end));
  }, 0);

  const recoveryTrades = activeEpisode
    ? activeEpisode.trades.length
    : lastRecovered?.trades.length ?? 0;
  const recoveryDays = activeEpisode
    ? daysBetween(activeEpisode.peakDate, (latestPoint ? dayOf(latestPoint.trade) : undefined) ?? activeEpisode.troughDate)
    : lastRecovered
      ? daysBetween(lastRecovered.peakDate, lastRecovered.recoverDate ?? lastRecovered.troughDate)
      : 0;

  const displayedEpisodes = [...episodes].sort((a, b) => a.ddPct - b.ddPct).slice(0, 5);

  if (!points.length) {
    return (
      <section className={`${CARD} p-5`}>
        <div className="text-sm font-medium text-white">Drawdown episodes</div>
        <p className="mt-2 text-sm text-white/40">Недостатньо угод для аналізу просадок.</p>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricTile
          label="MAX DD"
          value={`${(worstEpisode?.ddPct ?? 0).toFixed(2)}%`}
          sub={fmt.usd(worstEpisode?.ddAmount ?? 0)}
          color={RED}
        />
        <MetricTile
          label="CURRENT DD"
          value={activeEpisode ? `${latestPoint.ddPct.toFixed(2)}%` : "0%"}
          sub={activeEpisode ? fmt.usd(latestPoint.ddAmount) : "At equity high"}
          color={activeEpisode ? RED : GREEN}
        />
        <MetricTile
          label="RECOVERY"
          value={activeEpisode ? `${recoveryTrades} trades` : recoveryTrades ? `${recoveryTrades} trades` : "—"}
          sub={activeEpisode ? `${recoveryDays} days underwater` : recoveryDays ? `${recoveryDays} days to recover` : "No completed cycles"}
          color={activeEpisode ? RED : GREEN}
        />
        <MetricTile
          label="LONGEST UNDERWATER"
          value={`${longestUnderwaterDays} days`}
          sub={`${episodes.length} episodes in period`}
        />
      </div>

      <div className={`${CARD} overflow-hidden`}>
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div className="flex items-center gap-2">
            <TrendingDown className="h-4 w-4" style={{ color: RED }} />
            <div>
              <div className="text-sm font-medium text-white">Drawdown episodes</div>
              <div className="text-[11px] text-white/40">Peak → trough → recovery across all included trades</div>
            </div>
          </div>
          <div className="text-xs text-white/40">{episodes.length} total</div>
        </div>

        {displayedEpisodes.length === 0 ? (
          <div className="p-5 text-sm text-white/40">No drawdown episodes detected.</div>
        ) : (
          <div className="divide-y divide-white/10">
            {displayedEpisodes.map((episode, index) => {
              const recovered = episode.recoverIndex !== null;
              const durationEnd = episode.recoverDate ?? (latestPoint ? dayOf(latestPoint.trade) : undefined) ?? episode.troughDate;
              const durationDays = daysBetween(episode.peakDate, durationEnd);
              const isOpen = expandedId === episode.id;
              const normalizedDepth = Math.min(100, Math.abs(episode.ddPct) / Math.max(Math.abs(worstEpisode?.ddPct ?? 1), 1) * 100);

              return (
                <div key={episode.id}>
                  <button
                    type="button"
                    className="group grid w-full grid-cols-1 gap-3 px-4 py-4 text-left transition hover:bg-white/[0.025] md:grid-cols-[minmax(150px,1.1fr)_minmax(220px,2fr)_minmax(150px,1fr)_auto] md:items-center"
                    onClick={() => setExpandedId((current) => current === episode.id ? null : episode.id)}
                  >
                    <div>
                      <div className="text-sm font-medium text-white">{index === 0 ? "Worst episode" : `Episode #${index + 1}`}</div>
                      <div className="mt-0.5 text-[11px] text-white/40">{episode.peakDate} → {episode.troughDate}</div>
                    </div>

                    <div>
                      <div className="mb-1 flex justify-between gap-3 text-xs">
                        <span style={{ color: RED }}>{episode.ddPct.toFixed(2)}% · {fmt.usd(episode.ddAmount)}</span>
                        <span className="text-white/35">{episode.trades.length} trades</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
                        <div className="h-full rounded-full" style={{ width: `${normalizedDepth}%`, backgroundColor: RED }} />
                      </div>
                    </div>

                    <div className="text-xs">
                      <div className="font-medium" style={{ color: recovered ? GREEN : RED }}>
                        {recovered ? "Recovered" : "In progress"}
                      </div>
                      <div className="mt-0.5 text-white/40">
                        {durationDays} days · {recovered ? `${episode.trades.length} trades` : "still underwater"}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 text-xs text-white/40 group-hover:text-white/70">
                      Details
                      {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                  </button>

                  {isOpen && <EpisodeDetails episode={episode} accountNames={accountNames} />}
                </div>
              );
            })}
          </div>
        )}

        {episodes.length > displayedEpisodes.length && (
          <div className="border-t border-white/10 px-4 py-2 text-xs text-white/35">
            Showing 5 deepest episodes out of {episodes.length}.
          </div>
        )}
      </div>
    </section>
  );
}
