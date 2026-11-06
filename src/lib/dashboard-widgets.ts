/** Widget catalogue for the customisable Overview grid. Pure data, shared by the UI, the API validation and tests.
 *  Titles are English source text; the UI translates them with `t()`. */
import { msg } from "./i18n/core";
export const GRID_COLUMNS = 12;
export const ROW_HEIGHT = 40;
export const GRID_GAP = 16;

export type WidgetGroup = "metrics" | "charts" | "breakdowns";
export type WidgetMeta = {
  key: string; title: string; description: string; group: WidgetGroup;
  w: number; h: number; minW: number; minH: number; maxW: number; maxH: number;
};

const stat = (key: string, title: string, description: string): WidgetMeta => ({ key, title, description, group: "metrics", w: 3, h: 2, minW: 2, minH: 2, maxW: 6, maxH: 3 });

export const WIDGETS: readonly WidgetMeta[] = [
  stat("net_pnl", msg("Net P&L"), msg("Total result")),
  stat("winrate", msg("Winrate"), msg("Share of winning trades")),
  stat("avg_r", msg("Avg R"), msg("Average R-multiple")),
  stat("profit_factor", msg("Profit factor"), msg("Gross profit to gross loss")),
  { key: "equity", title: msg("Equity curve"), description: msg("Equity curve by trade"), group: "charts", w: 8, h: 7, minW: 4, minH: 5, maxW: 12, maxH: 14 },
  { key: "calendar", title: msg("Trade calendar"), description: msg("Result by day of the month"), group: "charts", w: 4, h: 7, minW: 4, minH: 6, maxW: 8, maxH: 12 },
  { key: "drawdown", title: msg("Drawdowns"), description: msg("Drawdown episodes and recovery"), group: "charts", w: 7, h: 10, minW: 5, minH: 6, maxW: 12, maxH: 16 },
  { key: "r_distribution", title: msg("R distribution"), description: msg("How many trades fall in each R range"), group: "charts", w: 5, h: 10, minW: 4, minH: 5, maxW: 12, maxH: 16 },
  stat("best_trade", msg("Best trade"), msg("Largest single win")),
  stat("worst_trade", msg("Worst trade"), msg("Largest single loss")),
  stat("avg_win", msg("Avg win"), msg("Average win")),
  stat("avg_loss", msg("Avg loss"), msg("Average loss")),
  { key: "streaks", title: msg("Streaks"), description: msg("Winning and losing streaks"), group: "metrics", w: 12, h: 2, minW: 3, minH: 2, maxW: 12, maxH: 3 },
  { key: "monthly", title: msg("Monthly P&L"), description: msg("Result by month"), group: "breakdowns", w: 4, h: 7, minW: 3, minH: 4, maxW: 12, maxH: 14 },
  { key: "symbols", title: msg("Top symbols"), description: msg("Result by instrument"), group: "breakdowns", w: 4, h: 7, minW: 3, minH: 4, maxW: 12, maxH: 14 },
  { key: "sessions", title: msg("Sessions"), description: msg("Result by trading session"), group: "breakdowns", w: 4, h: 7, minW: 3, minH: 4, maxW: 12, maxH: 14 },
  { key: "risk", title: msg("Risk"), description: msg("Average and maximum risk per trade"), group: "breakdowns", w: 5, h: 5, minW: 3, minH: 3, maxW: 12, maxH: 10 },
  { key: "emotions", title: msg("Emotions"), description: msg("Result by emotion"), group: "breakdowns", w: 7, h: 5, minW: 3, minH: 3, maxW: 12, maxH: 14 },
];

export const GROUP_LABEL: Record<WidgetGroup, string> = { metrics: msg("Metrics"), charts: msg("Charts"), breakdowns: msg("Breakdowns") };
const BY_KEY = new Map(WIDGETS.map(widget => [widget.key, widget]));
export function widgetMeta(key: string): WidgetMeta | undefined { return BY_KEY.get(key); }

export type LayoutItem = { key: string; x: number; y: number; w: number; h: number };
export type DashboardLayout = { version: 1; items: LayoutItem[]; mobile: string[] };

/** The default arrangement: the Overview as it looked before it became customisable. */
const DEFAULT_POSITIONS: Record<string, [number, number]> = {
  net_pnl: [0, 0], winrate: [3, 0], avg_r: [6, 0], profit_factor: [9, 0],
  equity: [0, 2], calendar: [8, 2],
  drawdown: [0, 9], r_distribution: [7, 9],
  best_trade: [0, 19], worst_trade: [3, 19], avg_win: [6, 19], avg_loss: [9, 19],
  streaks: [0, 21],
  monthly: [0, 23], symbols: [4, 23], sessions: [8, 23],
  risk: [0, 30], emotions: [5, 30],
};

export function defaultItems(): LayoutItem[] {
  return WIDGETS.map(widget => { const [x, y] = DEFAULT_POSITIONS[widget.key] ?? [0, 0]; return { key: widget.key, x, y, w: widget.w, h: widget.h }; });
}
export function defaultDashboardLayout(): DashboardLayout {
  const items = defaultItems();
  return { version: 1, items, mobile: readingOrder(items) };
}

/** Top-to-bottom, left-to-right order of the items (also the default mobile order). */
export function readingOrder(items: readonly LayoutItem[]): string[] {
  return [...items].sort((a, b) => a.y - b.y || a.x - b.x).map(item => item.key);
}
