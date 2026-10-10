"use client";

import { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTrades, type JournalTrade } from "@/hooks/use-trades";
import { fmt } from "@/lib/utils-trade";

const GREEN = "var(--color-green)";
const RED = "var(--color-red)";

type StreakTrade = Pick<JournalTrade, "opened_at" | "net_pnl">;

type StreakInfo = {
  count: number;
  pnl: number;
  startDate: string;
  endDate: string;
};

type StreakSummary = {
  current: { type: "win" | "loss" | "none"; count: number; pnl: number };
  longestWin: StreakInfo | null;
  longestLoss: StreakInfo | null;
};

function computeStreaks(trades: StreakTrade[]): StreakSummary {
  const sorted = [...trades].sort((a, b) => {
    return (a.opened_at ?? "").localeCompare(b.opened_at ?? "");
  });

  let currentType: "win" | "loss" | "none" = "none";
  let currentCount = 0;
  let currentPnl = 0;
  let currentStart = "";

  let longestWin: StreakInfo | null = null;
  let longestLoss: StreakInfo | null = null;

  for (const trade of sorted) {
    const pnl = trade.net_pnl ?? 0;
    const type: "win" | "loss" | "none" = pnl > 0 ? "win" : pnl < 0 ? "loss" : "none";

    if (type === "none") {
      currentType = "none";
      currentCount = 0;
      currentPnl = 0;
      continue;
    }

    if (type === currentType) {
      currentCount += 1;
      currentPnl += pnl;
    } else {
      currentType = type;
      currentCount = 1;
      currentPnl = pnl;
      currentStart = (trade.opened_at ?? "").slice(0, 10);
    }

    const info: StreakInfo = { count: currentCount, pnl: currentPnl, startDate: currentStart, endDate: (trade.opened_at ?? "").slice(0, 10) };
    if (type === "win" && (!longestWin || currentCount > longestWin.count)) longestWin = info;
    if (type === "loss" && (!longestLoss || currentCount > longestLoss.count)) longestLoss = info;
  }

  return {
    current: { type: currentType, count: currentCount, pnl: currentPnl },
    longestWin,
    longestLoss,
  };
}

export function StreakStatCard() {
  const { visibleTrades, accounts, includedAccountIds, activeAccountId, activeAccount } = useTrades();
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | null>(null);

  const summary = useMemo(() => computeStreaks(visibleTrades), [visibleTrades]);

  const baseBalance = useMemo(() => {
    if (activeAccountId !== "all" && activeAccount) return activeAccount.initialBalance || 0;
    return accounts
      .filter((account) => includedAccountIds.includes(account.id))
      .reduce((sum, account) => sum + (account.initialBalance || 0), 0);
  }, [activeAccountId, activeAccount, accounts, includedAccountIds]);

  const pct = (pnl: number) => (baseBalance > 0 ? (pnl / baseBalance) * 100 : 0);

  const winCount = summary.longestWin?.count ?? 0;
  const lossCount = summary.longestLoss?.count ?? 0;
  const currentColor = summary.current.type === "win" ? GREEN : summary.current.type === "loss" ? RED : undefined;

  const cancelClose = () => {
    if (closeTimer.current) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  const showPopover = () => {
    cancelClose();
    const rect = cardRef.current?.getBoundingClientRect();
    if (rect) {
      const popoverWidth = 288;
      const left = Math.min(rect.left, window.innerWidth - popoverWidth - 16);
      setCoords({ top: rect.bottom + 8, left: Math.max(16, left) });
    }
    setOpen(true);
  };

  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = window.setTimeout(() => setOpen(false), 120);
  };

  return (
    <div
      ref={cardRef}
      className="relative rounded-2xl border border-white/10 bg-background p-4 cursor-pointer select-none"
      onMouseEnter={showPopover}
      onMouseLeave={scheduleClose}
      onClick={() => (open ? setOpen(false) : showPopover())}
    >
      <div className="mb-2 text-[11px] uppercase tracking-wide text-white/40">STREAKS</div>

      <div
        className="relative h-6 overflow-hidden rounded-md"
        style={{ background: "linear-gradient(135deg, rgba(118,208,90,0.16) 49%, rgba(240,106,115,0.16) 51%)" }}
      >
        <span className="absolute left-1.5 top-1/2 -translate-y-1/2 whitespace-nowrap text-xs font-semibold" style={{ color: GREEN }}>
          {winCount}W
        </span>
        <span className="absolute right-1.5 top-1/2 -translate-y-1/2 whitespace-nowrap text-xs font-semibold" style={{ color: RED }}>
          {lossCount}L
        </span>
      </div>

      <div className="mt-2 whitespace-nowrap text-[11px] text-white/40">
        Поточний:{" "}
        <span style={{ color: currentColor }}>
          {summary.current.type === "none" ? "—" : `${summary.current.count} ${summary.current.type === "win" ? "W" : "L"}`}
        </span>
      </div>

      {open && coords && typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed z-[100] w-72 rounded-xl border border-white/10 bg-background p-3 text-xs shadow-2xl"
            style={{ top: coords.top, left: coords.left }}
            onMouseEnter={cancelClose}
            onMouseLeave={scheduleClose}
          >
            <div className="mb-2 font-medium text-white/60">Streak details</div>

            <div className="mb-2">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-white/50">Поточний стрік</span>
                <span className="whitespace-nowrap" style={{ color: currentColor }}>
                  {summary.current.type === "none" ? "—" : `${summary.current.count} ${summary.current.type === "win" ? "перемог" : "поразок"}`}
                </span>
              </div>
              {summary.current.type !== "none" && (
                <div className="flex items-baseline justify-between gap-3 text-white/40">
                  <span>P&L / %</span>
                  <span className="whitespace-nowrap">{fmt.usd(summary.current.pnl)} · {fmt.pct(pct(summary.current.pnl))}</span>
                </div>
              )}
            </div>

            <div className="mb-2 border-t border-white/10 pt-2">
              <div className="flex items-baseline justify-between gap-3" style={{ color: GREEN }}>
                <span>Найдовший win</span>
                <span>{winCount}</span>
              </div>
              {summary.longestWin && (
                <>
                  <div className="flex items-baseline justify-between gap-3 text-white/40">
                    <span>Період</span>
                    <span className="whitespace-nowrap">{summary.longestWin.startDate} → {summary.longestWin.endDate}</span>
                  </div>
                  <div className="flex items-baseline justify-between gap-3 text-white/40">
                    <span>P&L / %</span>
                    <span className="whitespace-nowrap">{fmt.usd(summary.longestWin.pnl)} · {fmt.pct(pct(summary.longestWin.pnl))}</span>
                  </div>
                </>
              )}
            </div>

            <div className="border-t border-white/10 pt-2">
              <div className="flex items-baseline justify-between gap-3" style={{ color: RED }}>
                <span>Найдовший loss</span>
                <span>{lossCount}</span>
              </div>
              {summary.longestLoss && (
                <>
                  <div className="flex items-baseline justify-between gap-3 text-white/40">
                    <span>Період</span>
                    <span className="whitespace-nowrap">{summary.longestLoss.startDate} → {summary.longestLoss.endDate}</span>
                  </div>
                  <div className="flex items-baseline justify-between gap-3 text-white/40">
                    <span>P&L / %</span>
                    <span className="whitespace-nowrap">{fmt.usd(summary.longestLoss.pnl)} · {fmt.pct(pct(summary.longestLoss.pnl))}</span>
                  </div>
                </>
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
