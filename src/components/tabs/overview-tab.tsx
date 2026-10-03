"use client";

import { useCallback, useMemo, useState } from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Flag,
  ShieldAlert,
  Target,
  Wallet,
} from "lucide-react";

import { useTrades, type JournalTrade } from "@/hooks/use-trades";
import { phaseLabel, type TradingAccount } from "@/lib/account-data";
import {
  computeEquity,
  computeMonthly,
  computeStats,
  fmt,
  groupByKey,
} from "@/lib/utils-trade";
import { computeAdvancedStats, type RBucket } from "@/lib/advanced-stats";
import { StatCard } from "@/components/ui/stat-card";
import LightRays from "@/components/ui/light-rays";
import { DrawdownPanel } from "@/components/ui/drawdown-panel";
import { StreakStatCard } from "@/components/ui/streak-stat-card";
import { SectionHeader } from "@/components/ui/section-header";
import { RiskSummary } from "@/components/ui/risk-summary";

type EqPoint = {
  date: string;
  time?: string;
  symbol?: string;
  session?: string;
  emotion?: string;
  tradePnl?: number;
  resultR?: number;
  pnl: number;
};

type CalendarTrade = {
  date: string;
  symbol?: string;
  direction?: "Long" | "Short" | string;
  net_pnl?: number;
  result_r?: number;
};

const GREEN = "var(--color-green)";
const RED = "var(--color-red)";
const CARD = "rounded-2xl border border-white/10 bg-background";

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value));
}

function AccountProgressCard({
  activeAccount,
  activeAccountId,
  visibleTrades,
}: {
  activeAccount: TradingAccount | null;
  activeAccountId: "all" | string;
  visibleTrades: JournalTrade[];
}) {
  if (activeAccountId === "all" || !activeAccount) {
    return (
      <div className={`${CARD} relative overflow-hidden p-5`}>
        <div className="pointer-events-none absolute inset-0 opacity-60">
          <LightRays />
        </div>

        <div className="relative z-10">
          <div className="text-sm font-medium text-white">
            All accounts view
          </div>
          <div className="mt-1 text-sm text-white/60">
            Combined statistics across all included accounts
          </div>
        </div>
      </div>
    );
  }

  const totalPnl = visibleTrades.reduce(
    (sum, trade) => sum + (trade.net_pnl ?? 0),
    0,
  );

  const pnlPercent = activeAccount.initialBalance
    ? (totalPnl / activeAccount.initialBalance) * 100
    : 0;

  const targetPercent = activeAccount.targetPercent ?? 0;
  const maxLossPercent = activeAccount.maxLossPercent ?? 0;
  const dailyLossPercent = activeAccount.dailyLossPercent ?? 0;

  const targetProgress =
    targetPercent > 0 ? clampPercent((pnlPercent / targetPercent) * 100) : 0;

  const drawdownUsed =
    maxLossPercent > 0
      ? clampPercent((Math.abs(Math.min(pnlPercent, 0)) / maxLossPercent) * 100)
      : 0;

  const currentEquity = activeAccount.initialBalance + totalPnl;

  return (
    <div className={`${CARD} p-5`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-base font-semibold text-white">
            {activeAccount.name}
          </div>
          <div className="mt-1 text-xs text-white/60">
            {phaseLabel[activeAccount.phase]} · {activeAccount.broker || "—"} ·{" "}
            {activeAccount.platform.toUpperCase()} · старт{" "}
            {fmt.usd(activeAccount.initialBalance)}
          </div>
        </div>

        <div className="text-right">
          <div className="text-xs uppercase tracking-[0.18em] text-white/45">
            Current equity
          </div>
          <div
            className="mt-1 text-lg font-semibold"
            style={{ color: totalPnl >= 0 ? GREEN : RED }}
          >
            {fmt.usd(currentEquity)}
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <div>
          <div className="mb-1 flex items-center justify-between text-xs text-white/55">
            <span>Target progress</span>
            <span>{targetPercent ? `of ${fmt.pct(targetPercent)}` : "—"}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/8">
            <div
              className="h-full rounded-full bg-[var(--color-green)]"
              style={{ width: `${targetProgress}%` }}
            />
          </div>
          <div className="mt-2 text-sm text-white">{fmt.pct(pnlPercent)}</div>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between text-xs text-white/55">
            <span>Max loss used</span>
            <span>
              {maxLossPercent ? `of ${fmt.pct(maxLossPercent)}` : "—"}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/8">
            <div
              className="h-full rounded-full bg-[var(--color-red)]"
              style={{ width: `${drawdownUsed}%` }}
            />
          </div>
          <div className="mt-2 text-sm text-white">
            {fmt.pct(Math.abs(Math.min(pnlPercent, 0)))}
          </div>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between text-xs text-white/55">
            <span>Daily limit</span>
            <span>{dailyLossPercent ? fmt.pct(dailyLossPercent) : "—"}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/8">
            <div
              className="h-full rounded-full bg-white/30"
              style={{ width: `${dailyLossPercent ? 100 : 0}%` }}
            />
          </div>
          <div className="mt-2 text-sm text-white">
            Trade count: {visibleTrades.length}
          </div>
        </div>
      </div>
    </div>
  );
}

function EquityChart({
  points,
  totalPnl,
}: {
  points: EqPoint[];
  totalPnl: number;
}) {
  const [hover, setHover] = useState<{
    idx: number;
    px: number;
    py: number;
  } | null>(null);

  const W = 900;
  const H = 300;
  const PAD_L = 12;
  const PAD_R = 48;
  const PAD_T = 14;
  const PAD_B = 22;

  const eq = points.slice(-120);
  const chartW = W - PAD_L - PAD_R;
  const chartH = H - PAD_T - PAD_B;

  const pnlValues = eq.length > 0 ? eq.map((p) => p.pnl) : [0];
  const rawMin = Math.min(...pnlValues);
  const rawMax = Math.max(...pnlValues);
  const range = Math.max(rawMax - rawMin, 1);
  const yMin = Math.min(rawMin, 0) - range * 0.08;
  const yMax = Math.max(rawMax, 0) + range * 0.08;
  const ySpan = Math.max(yMax - yMin, 1);

  const toX = (i: number) => PAD_L + (i / Math.max(1, eq.length - 1)) * chartW;
  const toY = (v: number) => PAD_T + chartH - ((v - yMin) / ySpan) * chartH;
  const zeroY = toY(0);

  const buildPath = (pts: { x: number; y: number }[]) =>
    pts.reduce((acc, p, i, arr) => {
      if (i === 0) return `M${p.x},${p.y}`;
      const prev = arr[i - 1];
      const cx = (prev.x + p.x) / 2;
      return `${acc} C${cx},${prev.y} ${cx},${p.y} ${p.x},${p.y}`;
    }, "");

  const coords = eq.map((p, i) => ({ x: toX(i), y: toY(p.pnl) }));

  type Seg = { pts: { x: number; y: number }[]; positive: boolean };
  const segments: Seg[] = [];
  let current: Seg | null = null;

  for (let i = 0; i < coords.length; i++) {
    const isPos = eq[i].pnl >= 0;

    if (!current || current.positive !== isPos) {
      if (current && i > 0) {
        const prev = coords[i - 1];
        const cur = coords[i];
        const denom = cur.y - prev.y || 0.001;
        const t = (zeroY - prev.y) / denom;
        const crossX = prev.x + t * (cur.x - prev.x);
        current.pts.push({ x: crossX, y: zeroY });
        segments.push(current);
        current = { pts: [{ x: crossX, y: zeroY }], positive: isPos };
      } else {
        current = { pts: [], positive: isPos };
      }
    }

    current.pts.push(coords[i]);
  }

  if (current) segments.push(current);

  const yTicks = 4;
  const yLabels = Array.from({ length: yTicks + 1 }, (_, i) => {
    const val = yMin + (i / yTicks) * ySpan;
    return { y: toY(val), val };
  });

  const rawXLabelIndices = [
    0,
    Math.floor(eq.length / 3),
    Math.floor((eq.length * 2) / 3),
    eq.length - 1,
  ];

  const xLabelIndices = Array.from(new Set(rawXLabelIndices)).filter(
    (idx) => eq[idx],
  );

  const xLabels = xLabelIndices.map((idx) => ({
    x: toX(idx),
    label: eq[idx].date,
  }));

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      if (!rect || eq.length < 2) return;

      const mx = ((e.clientX - rect.left) / rect.width) * W;
      const idx = Math.round(((mx - PAD_L) / chartW) * (eq.length - 1));
      const clamped = Math.max(0, Math.min(eq.length - 1, idx));

      setHover({
        idx: clamped,
        px: toX(clamped),
        py: toY(eq[clamped].pnl),
      });
    },
    [eq, chartW],
  );

  const hoverPoint = hover !== null ? eq[hover.idx] : null;

  return (
    <div className={`${CARD} relative overflow-hidden p-5`}>
      <div
        className="pointer-events-none absolute inset-0 opacity-100"
        style={{
          background:
            totalPnl >= 0
              ? "radial-gradient(circle at 20% 0%, rgba(118,208,90,0.07), transparent 60%)"
              : "radial-gradient(circle at 20% 0%, rgba(240,106,115,0.07), transparent 60%)",
        }}
      />

      <div className="relative z-10 mb-4 flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-medium text-white">
            P&amp;L Equity Curve
          </div>
          <div className="mt-1 text-xs text-white/55">{eq.length} точок</div>
        </div>

        <div
          className="text-right text-lg font-semibold"
          style={{ color: totalPnl >= 0 ? GREEN : RED }}
        >
          {fmt.usd(totalPnl)}
        </div>
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-[300px] w-full"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHover(null)}
        >
          {yLabels.map((l, i) => (
            <line
              key={i}
              x1={PAD_L}
              x2={W - PAD_R}
              y1={l.y}
              y2={l.y}
              stroke="rgba(255,255,255,0.07)"
              strokeDasharray={l.val === 0 ? "0" : "4 6"}
            />
          ))}

          {segments.map((seg, si) => {
            if (seg.pts.length < 2) return null;
            const areaPath = `${buildPath(seg.pts)} L${
              seg.pts[seg.pts.length - 1].x
            },${zeroY} L${seg.pts[0].x},${zeroY} Z`;

            return (
              <path
                key={`area-${si}`}
                d={areaPath}
                fill={
                  seg.positive
                    ? "rgba(118,208,90,0.12)"
                    : "rgba(240,106,115,0.12)"
                }
              />
            );
          })}

          {segments.map((seg, si) => {
            if (seg.pts.length < 2) return null;
            return (
              <path
                key={`line-${si}`}
                d={buildPath(seg.pts)}
                fill="none"
                stroke={seg.positive ? GREEN : RED}
                strokeWidth="3"
                strokeLinecap="round"
              />
            );
          })}

          {hover && hoverPoint ? (
            <>
              <line
                x1={hover.px}
                x2={hover.px}
                y1={PAD_T}
                y2={H - PAD_B}
                stroke="rgba(255,255,255,0.22)"
                strokeDasharray="4 5"
              />
              <circle
                cx={hover.px}
                cy={hover.py}
                r="5"
                fill="rgba(9,10,15,0.98)"
                stroke={hoverPoint.pnl >= 0 ? GREEN : RED}
                strokeWidth="2"
              />
            </>
          ) : null}

          {yLabels.map((l, i) => (
            <text
              key={`ylabel-${i}`}
              x={W - PAD_R + 8}
              y={l.y + 4}
              fontSize="11"
              fill="rgba(255,255,255,0.45)"
            >
              {l.val === 0
                ? "0"
                : l.val > 0
                  ? `+${Math.round(l.val)}`
                  : `${Math.round(l.val)}`}
            </text>
          ))}

          {xLabels.map((l, i) => (
            <text
              key={`xlabel-${i}`}
              x={l.x}
              y={H - 4}
              textAnchor="middle"
              fontSize="11"
              fill="rgba(255,255,255,0.38)"
            >
              {l.label}
            </text>
          ))}
        </svg>

        {hover && hoverPoint ? (
          <div
            className="pointer-events-none absolute rounded-xl px-3 py-2 text-xs text-white"
            style={{
              left:
                hover.px / W > 0.68 ? "auto" : `${(hover.px / W) * 100 + 1.5}%`,
              right: hover.px / W > 0.68 ? "36px" : "auto",
              top: "8px",
              background: "rgba(9,10,15,0.96)",
              border: "1px solid rgba(255,255,255,0.10)",
              backdropFilter: "blur(14px)",
              minWidth: 148,
            }}
          >
            <div className="font-medium text-white/95">
              {hoverPoint.date}
              {hoverPoint.time ? ` · ${hoverPoint.time}` : ""}
            </div>

            <div className="mt-1 flex items-center justify-between gap-4">
              <span className="text-white/55">P&amp;L</span>
              <span style={{ color: hoverPoint.pnl >= 0 ? GREEN : RED }}>
                {fmt.usd(hoverPoint.pnl)}
              </span>
            </div>

            {hoverPoint.symbol ||
            hoverPoint.session ||
            hoverPoint.emotion ||
            hoverPoint.tradePnl !== undefined ? (
              <div className="mt-2 space-y-1 border-t border-white/10 pt-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-white/55">Пара</span>
                  <span>{hoverPoint.symbol || "—"}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-white/55">Сесія</span>
                  <span>{hoverPoint.session || "—"}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-white/55">Емоція</span>
                  <span>{hoverPoint.emotion || "—"}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-white/55">Trade P&amp;L</span>
                  <span
                    style={{
                      color: (hoverPoint.tradePnl ?? 0) >= 0 ? GREEN : RED,
                    }}
                  >
                    {fmt.usd(hoverPoint.tradePnl ?? 0)}
                  </span>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function TradesCalendar({ trades }: { trades: CalendarTrade[] }) {
  const [cursor, setCursor] = useState(() => new Date());
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const monthLabel = cursor.toLocaleString("uk-UA", {
    month: "long",
    year: "numeric",
  });

  const weekDays = ["Нд", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
  const year = cursor.getFullYear();
  const month = cursor.getMonth();

  const dayMap = useMemo(() => {
    const list = Array.isArray(trades) ? trades : [];
    const map: Record<string, { pnl: number; trades: CalendarTrade[] }> = {};

    for (const t of list) {
      const key = t.date;
      if (!key) continue;

      if (!map[key]) map[key] = { pnl: 0, trades: [] };
      map[key].pnl += t.net_pnl ?? 0;
      map[key].trades.push(t);
    }

    return map;
  }, [trades]);

  const firstOfMonth = new Date(year, month, 1);
  const startDate = new Date(firstOfMonth);
  startDate.setDate(firstOfMonth.getDate() - firstOfMonth.getDay());

  const days: { date: Date; inMonth: boolean; key: string }[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);

    days.push({
      date: d,
      inMonth: d.getMonth() === month,
      key: d.toISOString().slice(0, 10),
    });
  }

  const today = new Date();
  const isToday = (d: Date) =>
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();

  const selectedDay = selectedKey ? dayMap[selectedKey] : null;

  return (
    <div className={`${CARD} p-5`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-white">Trades Calendar</div>
          <div className="mt-1 text-xs text-white/55">
            Натисни на день з угодами
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setCursor(new Date(year, month - 1, 1));
              setSelectedKey(null);
            }}
            className="rounded-md p-1 text-white/50 transition-colors hover:bg-white/5"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <div className="min-w-[140px] text-center text-sm text-white/80">
            {monthLabel}
          </div>

          <button
            type="button"
            onClick={() => {
              setCursor(new Date(year, month + 1, 1));
              setSelectedKey(null);
            }}
            className="rounded-md p-1 text-white/50 transition-colors hover:bg-white/5"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-white/35">
        {weekDays.map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1">
        {days.map((day) => {
          const info = dayMap[day.key];
          const hasTrade = day.inMonth && !!info;
          const isSelected = selectedKey === day.key;

          return (
            <button
              key={day.key}
              type="button"
              onClick={() =>
                setSelectedKey(isSelected ? null : hasTrade ? day.key : null)
              }
              className={`relative flex min-h-[54px] flex-col items-center justify-center rounded-md py-1 text-[11px] transition-colors ${
                !day.inMonth
                  ? "cursor-default text-white/20"
                  : hasTrade
                    ? "cursor-pointer text-white/80 hover:bg-white/5"
                    : "cursor-default text-white/50"
              } ${isToday(day.date) ? "font-bold" : ""} ${
                isSelected ? "bg-white/10" : ""
              }`}
            >
              {isToday(day.date) ? (
                <span className="absolute left-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-white/80" />
              ) : null}

              <span>{day.date.getDate()}</span>

              {hasTrade ? (
                <span
                  className="mt-1 text-[10px]"
                  style={{ color: info.pnl >= 0 ? GREEN : RED }}
                >
                  {info.pnl >= 0 ? "+" : ""}
                  {Math.abs(info.pnl) >= 1000
                    ? `${(info.pnl / 1000).toFixed(1)}k`
                    : info.pnl.toFixed(0)}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex items-center gap-4 text-[11px] text-white/45">
        <div className="flex items-center gap-1.5">
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: GREEN }}
          />
          <span>Прибуток</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: RED }} />
          <span>Збиток</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-white/80" />
          <span>Сьогодні</span>
        </div>
      </div>

      {selectedDay ? (
        <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-white">
                {selectedKey}
              </div>
              <div
                className="mt-1 text-xs"
                style={{ color: selectedDay.pnl >= 0 ? GREEN : RED }}
              >
                {fmt.usd(selectedDay.pnl)}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSelectedKey(null)}
              className="text-sm leading-none text-white/40 transition-colors hover:text-white/70"
            >
              ×
            </button>
          </div>

          <div className="space-y-2">
            {selectedDay.trades.map((t, i) => (
              <div
                key={`${t.date}-${t.symbol}-${i}`}
                className="flex items-center justify-between gap-3 rounded-lg border border-white/6 bg-white/[0.02] px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm text-white">
                    {t.symbol || "—"}
                  </div>
                  <div className="text-xs text-white/45">
                    {t.direction || "—"}{" "}
                    {typeof t.result_r === "number"
                      ? `· ${t.result_r.toFixed(1)}R`
                      : ""}
                  </div>
                </div>

                <div
                  className="shrink-0 text-sm font-medium"
                  style={{ color: (t.net_pnl ?? 0) >= 0 ? GREEN : RED }}
                >
                  {fmt.usd(t.net_pnl ?? 0)}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function RDistributionChart({ buckets }: { buckets: RBucket[] }) {
  const max = Math.max(...buckets.map((b) => b.count), 1);
  const totalTrades = buckets.reduce((s, b) => s + b.count, 0);
  const bestBucket =
    buckets.length > 0
      ? buckets.reduce((a, b) => (b.count > a.count ? b : a), buckets[0])
      : null;

  return (
    <div className={`${CARD} p-5`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-white">
            R-Multiple розподіл
          </div>
          <div className="mt-1 text-xs text-white/55">{totalTrades} угод</div>
        </div>

        <div className="text-right text-xs text-white/55">
          Найчастіше: {bestBucket?.range ?? "—"}
        </div>
      </div>

      <div className="flex h-48 items-end gap-2">
        {buckets.map((b) => {
          const heightPct = Math.max(
            (b.count / max) * 100,
            b.count > 0 ? 6 : 0,
          );
          const isNeg =
            b.range.trim().startsWith("<") ||
            b.range.startsWith("-2") ||
            b.range.startsWith("-1");

          const color = isNeg ? RED : GREEN;

          return (
            <div
              key={b.range}
              className="flex flex-1 flex-col items-center gap-2"
            >
              <div className="text-[10px] text-white/45">{b.count}</div>
              <div className="flex h-36 w-full items-end">
                <div
                  className="w-full rounded-t-md"
                  style={{
                    height: `${heightPct}%`,
                    background: color,
                    opacity: b.count > 0 ? 0.9 : 0.18,
                  }}
                />
              </div>
              <div className="text-[10px] text-white/55">{b.range}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function OverviewTab() {
  const { visibleTrades, activeAccount, activeAccountId } = useTrades();

  const stats = useMemo(() => computeStats(visibleTrades), [visibleTrades]);
  const advanced = useMemo(
    () => computeAdvancedStats(visibleTrades),
    [visibleTrades],
  );
  const equity = useMemo(
    () => computeEquity(visibleTrades) as EqPoint[],
    [visibleTrades],
  );
  const monthly = useMemo(() => computeMonthly(visibleTrades), [visibleTrades]);

  const byPair = useMemo(() => {
    return groupByKey(visibleTrades, "symbol")
      .sort((a, b) => b.pnl - a.pnl)
      .slice(0, 8);
  }, [visibleTrades]);

  const bySession = useMemo(() => {
    return groupByKey(visibleTrades, "session").sort((a, b) => b.pnl - a.pnl);
  }, [visibleTrades]);

  const byEmotion = useMemo(() => {
    return groupByKey(visibleTrades, "emotion").sort(
      (a, b) => b.trades - a.trades,
    );
  }, [visibleTrades]);

  const calendarTrades = useMemo<CalendarTrade[]>(
    () =>
      visibleTrades.map((trade) => ({
        date: String(trade.opened_at ?? "").slice(0, 10),
        symbol: trade.symbol,
        direction: trade.direction,
        net_pnl: trade.net_pnl ?? 0,
        result_r: trade.result_r ?? undefined,
      })),
    [visibleTrades],
  );

  let overviewSubtitle = `${visibleTrades.length} угод · Combined view`;
  if (activeAccountId !== "all") {
    const accountName = activeAccount ? activeAccount.name : "Account";
    const accountPhase = activeAccount
      ? phaseLabel[activeAccount.phase]
      : "Manual";

    overviewSubtitle = `${visibleTrades.length} угод · ${accountName} · ${accountPhase}`;
  }

  const monthlyAbsMax = Math.max(...monthly.map((x) => Math.abs(x.pnl)), 1);

  return (
    <div className="space-y-6 p-6">
      <SectionHeader
        title="Огляд рахунку"
        subtitle={overviewSubtitle}
        icon={CalendarIcon}
      />

      <AccountProgressCard
        activeAccount={activeAccount}
        activeAccountId={activeAccountId}
        visibleTrades={visibleTrades}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Net P&L"
          value={fmt.usd(stats.totalPnl)}
          icon={Wallet}
          valueClassName={
            stats.totalPnl >= 0
              ? "text-[var(--color-green)]"
              : "text-[var(--color-red)]"
          }
        />
        <StatCard
          title="Win rate"
          value={fmt.pct(stats.winRate)}
          icon={Target}
          valueClassName={
            stats.winRate >= 50
              ? "text-[var(--color-green)]"
              : "text-[var(--color-red)]"
          }
        />
        <StatCard
          title="Avg R"
          value={fmt.r(stats.avgR)}
          icon={Flag}
          valueClassName={
            stats.avgR >= 0
              ? "text-[var(--color-green)]"
              : "text-[var(--color-red)]"
          }
        />
        <StatCard
          title="Profit factor"
          value={fmt.num(stats.profitFactor, 2)}
          icon={ShieldAlert}
          valueClassName={
            stats.profitFactor >= 1
              ? "text-[var(--color-green)]"
              : "text-[var(--color-red)]"
          }
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <EquityChart points={equity} totalPnl={stats.totalPnl} />
        <TradesCalendar trades={calendarTrades} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <DrawdownPanel
          equity={equity.map((point) => point.pnl)}
          title="Drawdown"
          subtitle="Поточна та максимальна просадка"
        />
        <RDistributionChart buckets={advanced.rDistribution} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StreakStatCard
          title="Best trade"
          value={fmt.usd(stats.bestTrade)}
          positive={stats.bestTrade >= 0}
        />
        <StreakStatCard
          title="Worst trade"
          value={fmt.usd(stats.worstTrade)}
          positive={stats.worstTrade >= 0}
        />
        <StreakStatCard
          title="Avg win"
          value={fmt.usd(stats.avgWin)}
          positive={stats.avgWin >= 0}
        />
        <StreakStatCard
          title="Avg loss"
          value={fmt.usd(stats.avgLoss)}
          positive={stats.avgLoss >= 0}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className={`${CARD} p-5`}>
          <div className="mb-4 text-sm font-medium text-white">
            Monthly P&amp;L
          </div>

          <div className="space-y-3">
            {monthly.length ? (
              monthly.map((m) => {
                const isPos = m.pnl >= 0;
                const width = (Math.abs(m.pnl) / monthlyAbsMax) * 100;

                return (
                  <div key={m.month} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-white/65">{m.month}</span>
                      <span style={{ color: isPos ? GREEN : RED }}>
                        {fmt.usd(m.pnl)}
                      </span>
                    </div>

                    <div className="h-2 overflow-hidden rounded-full bg-white/8">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${width}%`,
                          background: isPos ? GREEN : RED,
                        }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-sm text-white/45">Немає даних.</div>
            )}
          </div>
        </div>

        <div className={`${CARD} p-5`}>
          <div className="mb-4 text-sm font-medium text-white">Top symbols</div>

          <div className="space-y-3">
            {byPair.length ? (
              byPair.map((item) => (
                <div
                  key={item.name}
                  className="flex items-center justify-between gap-3 rounded-lg border border-white/6 bg-white/[0.02] px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm text-white">
                      {item.name || "—"}
                    </div>
                    <div className="text-xs text-white/45">
                      {item.trades} trades · WR {fmt.pct(item.winRate)}
                    </div>
                  </div>

                  <div
                    className="shrink-0 text-sm font-medium"
                    style={{ color: item.pnl >= 0 ? GREEN : RED }}
                  >
                    {fmt.usd(item.pnl)}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-white/45">Немає даних.</div>
            )}
          </div>
        </div>

        <div className={`${CARD} p-5`}>
          <div className="mb-4 text-sm font-medium text-white">Sessions</div>

          <div className="flex flex-wrap gap-2">
            {bySession.length ? (
              bySession.map((item) => (
                <div
                  key={item.name}
                  className="rounded-full border px-3 py-1.5 text-xs"
                  style={
                    item.pnl >= 0
                      ? {
                          borderColor: "rgba(118,208,90,0.25)",
                          background: "rgba(118,208,90,0.10)",
                          color: GREEN,
                        }
                      : {
                          borderColor: "rgba(240,106,115,0.25)",
                          background: "rgba(240,106,115,0.10)",
                          color: RED,
                        }
                  }
                >
                  {item.name || "—"} · {item.trades} угод · {fmt.usd(item.pnl)}{" "}
                  · WR {fmt.pct(item.winRate)}
                </div>
              ))
            ) : (
              <div className="text-sm text-white/45">Немає даних.</div>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <RiskSummary stats={advanced} />

        <div className={`${CARD} p-5`}>
          <div className="mb-4 text-sm font-medium text-white">Emotions</div>

          <div className="space-y-3">
            {byEmotion.length ? (
              byEmotion.map((item) => (
                <div
                  key={item.name}
                  className="flex items-center justify-between gap-3 rounded-lg border border-white/6 bg-white/[0.02] px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm text-white">
                      {item.name || "—"}
                    </div>
                    <div className="text-xs text-white/45">
                      {item.trades} угод
                    </div>
                  </div>

                  <div
                    className="shrink-0 text-sm font-medium"
                    style={{ color: item.pnl >= 0 ? GREEN : RED }}
                  >
                    {fmt.usd(item.pnl)}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-white/45">Немає даних.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
