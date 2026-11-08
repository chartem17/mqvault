/**
 * News ↔ trades. Links every trade to the calendar releases of its currencies and splits trades into
 * "near red news" / "around red news" / "clear" for statistics, tags and the Strategy Control rule.
 * Pure and dependency-free (see economic-calendar.ts); links are computed on the fly (ADR 0014).
 *
 * Windows (minutes, relative to the release time T):
 *  - open_at_release — the position was open at T (opened ≤ T ≤ closed);
 *  - opened_near     — opened within ±30 of T;
 *  - closed_near     — closed within ±30 of T;
 *  - within_2h       — any part of the trade within ±120 of T.
 * A pair gets the first matching relation in that order.
 */

export type NewsRelation = "open_at_release" | "opened_near" | "closed_near" | "within_2h";
export const NEWS_RELATIONS: readonly NewsRelation[] = ["open_at_release", "opened_near", "closed_near", "within_2h"];
const CORE_RELATIONS = new Set<NewsRelation>(["open_at_release", "opened_near", "closed_near"]);
export const NEWS_NEAR_MINUTES = 30;
/** What the UI shows next to a trade and in the calendar: red releases within this many minutes of entry or exit. */
export const NEWS_EDGE_MINUTES = 60;
export const NEWS_WIDE_MINUTES = 120;
/** How far the nearest red release is searched for the "±N minutes" rule (N ≤ this). */
export const NEWS_RULE_HORIZON_MINUTES = 240;
const MIN = 60_000;

export type NewsTradeInput = {
  id: string;
  symbol: string;
  base_asset?: string | null;
  quote_asset?: string | null;
  opened_at: string;
  closed_at?: string | null;
  net_pnl?: number | string | null;
  result_r?: number | string | null;
};
export type NewsEventInput = {
  id: string;
  title: string;
  currency: string | null;
  impact: string | null;
  event_time: string;
  event_code?: string | null;
  all_day?: boolean | null;
  event_type?: string | null;
};
export type TradeNewsLink = {
  eventId: string;
  title: string;
  eventKey: string;
  currency: string;
  impact: "high" | "medium";
  eventTime: string;
  relation: NewsRelation;
  /** Release time minus trade open, in whole minutes: negative = the release came before the entry. */
  minutesFromOpen: number;
  /** Same, relative to the exit; null while the trade is open. */
  minutesFromClose: number | null;
};
export type NewsBucket = "near_high" | "around_high" | "clear";
export type TradeNewsSummary = {
  tradeId: string;
  currencies: string[];
  bucket: NewsBucket;
  /** Signed minutes from entry to the closest red release of the trade's currencies within the horizon; null = none. */
  nearestHighMinutes: number | null;
  tags: string[];
  links: TradeNewsLink[];
};

// ---------- symbols ----------

const CALENDAR = new Set(["USD", "EUR", "GBP", "JPY", "AUD", "CAD", "NZD", "CHF"]);
const INDEX_CURRENCY: Record<string, string> = {
  US30: "USD", DJI30: "USD", DJ30: "USD", WS30: "USD", US500: "USD", SPX500: "USD", SP500: "USD", US100: "USD", NAS100: "USD", NDX100: "USD", USTEC: "USD",
  GER40: "EUR", GER30: "EUR", DE40: "EUR", DE30: "EUR", DAX40: "EUR", FRA40: "EUR", EU50: "EUR", STOXX50: "EUR", ESP35: "EUR",
  UK100: "GBP", FTSE100: "GBP", JP225: "JPY", JPN225: "JPY", NIKKEI225: "JPY", AUS200: "AUD",
};
const QUOTED_IN_USD = /^(XAU|XAG|XPT|XPD|BTC|ETH|SOL|XRP|LTC|BNB|ADA|DOGE)(USDT?|USDC)$/;

/**
 * Calendar currencies whose releases move this instrument. Forex: both legs; metals and crypto
 * quoted in USD: USD; known indices: their home currency. Broker suffixes (".m", "-ecn", "cash") are ignored.
 */
export function newsCurrenciesForSymbol(symbol: string, base?: string | null, quote?: string | null): string[] {
  const out = new Set<string>();
  for (const leg of [base, quote]) { const c = (leg ?? "").toUpperCase(); if (CALENDAR.has(c)) out.add(c); }
  const raw = (symbol ?? "").toUpperCase().split(/[.\-_ ]/)[0].replace(/[^A-Z0-9/]/g, "");
  const s = raw.replace("/", "").replace(/(CASH|SPOT|PRO|ECN)$/, "");
  if (INDEX_CURRENCY[s]) out.add(INDEX_CURRENCY[s]);
  else if (QUOTED_IN_USD.test(s)) out.add("USD");
  else if (/^[A-Z]{6}$/.test(s)) { for (const c of [s.slice(0, 3), s.slice(3, 6)]) if (CALENDAR.has(c)) out.add(c); }
  return [...CALENDAR].filter(c => out.has(c));
}

// ---------- classification ----------

/** Relation of one trade to one release, or null when the release is outside every window. */
export function classifyTradeEvent(openMs: number, closeMs: number | null, eventMs: number): NewsRelation | null {
  const close = closeMs ?? openMs;
  if (closeMs !== null && openMs <= eventMs && eventMs <= closeMs) return "open_at_release";
  if (Math.abs(eventMs - openMs) <= NEWS_NEAR_MINUTES * MIN) return "opened_near";
  if (closeMs !== null && Math.abs(eventMs - closeMs) <= NEWS_NEAR_MINUTES * MIN) return "closed_near";
  if (openMs - NEWS_WIDE_MINUTES * MIN <= eventMs && eventMs <= close + NEWS_WIDE_MINUTES * MIN) return "within_2h";
  return null;
}

/**
 * How close a release is to the trade's entry or exit: the nearer edge and the signed minutes
 * (negative = the release came before that edge). Null when both edges are farther than `maxMinutes`.
 * A position that merely stayed open during a release is not "near" it.
 */
export function nearestTradeEdge(minutesFromOpen: number, minutesFromClose: number | null, maxMinutes = NEWS_EDGE_MINUTES): { edge: "entry" | "exit"; minutes: number } | null {
  const exit = minutesFromClose;
  const useExit = exit !== null && Math.abs(exit) < Math.abs(minutesFromOpen);
  const minutes = useExit ? (exit as number) : minutesFromOpen;
  return Math.abs(minutes) <= maxMinutes ? { edge: useExit ? "exit" : "entry", minutes } : null;
}
export type EdgeNewsLink = TradeNewsLink & { edge: "entry" | "exit"; edgeMinutes: number };

/** Red releases within `maxMinutes` of the trade's entry or exit, in time order. */
export function edgeNewsLinks(links: readonly TradeNewsLink[], maxMinutes = NEWS_EDGE_MINUTES): EdgeNewsLink[] {
  const out: EdgeNewsLink[] = [];
  for (const link of links) {
    if (link.impact !== "high") continue;
    const near = nearestTradeEdge(link.minutesFromOpen, link.minutesFromClose ?? null, maxMinutes);
    if (near) out.push({ ...link, edge: near.edge, edgeMinutes: near.minutes });
  }
  return out.sort((a, b) => a.eventTime.localeCompare(b.eventTime) || a.title.localeCompare(b.title));
}

type PreparedEvent = { ms: number; event: NewsEventInput; impact: "high" | "medium"; currency: string };

function prepareEvents(events: NewsEventInput[]): PreparedEvent[] {
  const out: PreparedEvent[] = [];
  for (const event of events) {
    const impact = (event.impact ?? "").toLowerCase();
    if (impact !== "high" && impact !== "medium") continue;
    // Holidays and all-day items have no release minute.
    if (event.all_day || event.event_type === "holiday") continue;
    const ms = Date.parse(event.event_time);
    const currency = (event.currency ?? "").toUpperCase();
    if (!Number.isFinite(ms) || !CALENDAR.has(currency)) continue;
    out.push({ ms, event, impact, currency });
  }
  return out.sort((a, b) => a.ms - b.ms);
}

function firstAtOrAfter(sorted: PreparedEvent[], ms: number) {
  let lo = 0, hi = sorted.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (sorted[mid].ms < ms) lo = mid + 1; else hi = mid; }
  return lo;
}

const toNum = (v: number | string | null | undefined) => { if (v === null || v === undefined || v === "") return null; const n = Number(v); return Number.isFinite(n) ? n : null; };

/** Links, bucket, nearest red release and tags for every trade. Trades with an invalid open time are skipped. */
export function summarizeTradesNews(trades: NewsTradeInput[], events: NewsEventInput[]): TradeNewsSummary[] {
  const sorted = prepareEvents(events);
  const out: TradeNewsSummary[] = [];
  for (const trade of trades) {
    const openMs = Date.parse(trade.opened_at);
    if (!Number.isFinite(openMs)) continue;
    const closeParsed = trade.closed_at ? Date.parse(trade.closed_at) : NaN;
    const closeMs = Number.isFinite(closeParsed) && closeParsed >= openMs ? closeParsed : null;
    const currencies = newsCurrenciesForSymbol(trade.symbol, trade.base_asset, trade.quote_asset);
    const wanted = new Set(currencies);
    const links: TradeNewsLink[] = [];
    let nearest: number | null = null;
    const horizon = Math.max(NEWS_WIDE_MINUTES, NEWS_RULE_HORIZON_MINUTES) * MIN;
    const from = openMs - horizon, to = (closeMs ?? openMs) + horizon;
    for (let i = firstAtOrAfter(sorted, from); i < sorted.length && sorted[i].ms <= to; i++) {
      const item = sorted[i];
      if (!wanted.has(item.currency)) continue;
      const minutes = Math.round((item.ms - openMs) / MIN);
      if (item.impact === "high" && Math.abs(minutes) <= NEWS_RULE_HORIZON_MINUTES && (nearest === null || Math.abs(minutes) < Math.abs(nearest))) nearest = minutes;
      const relation = classifyTradeEvent(openMs, closeMs, item.ms);
      if (!relation) continue;
      links.push({
        eventId: item.event.id, title: item.event.title, eventKey: item.event.event_code || item.event.title,
        currency: item.currency, impact: item.impact, eventTime: new Date(item.ms).toISOString(), relation, minutesFromOpen: minutes,
        minutesFromClose: closeMs === null ? null : Math.round((item.ms - closeMs) / MIN),
      });
    }
    const highCore = links.some(l => l.impact === "high" && CORE_RELATIONS.has(l.relation));
    const highAny = links.some(l => l.impact === "high");
    const bucket: NewsBucket = highCore ? "near_high" : highAny ? "around_high" : "clear";
    out.push({ tradeId: trade.id, currencies, bucket, nearestHighMinutes: nearest, tags: tagsFor(links), links });
  }
  return out;
}

/** Tags shown on a trade: strongest impact with a core relation, plus that relation. */
function tagsFor(links: TradeNewsLink[]): string[] {
  for (const impact of ["high", "medium"] as const) {
    const core = links.filter(l => l.impact === impact && CORE_RELATIONS.has(l.relation));
    if (!core.length) continue;
    const relation = NEWS_RELATIONS.find(r => core.some(l => l.relation === r)) as NewsRelation;
    return [`news:${impact}`, `news:${relation}`];
  }
  return [];
}

// ---------- statistics ----------

export type NewsStats = {
  trades: number;
  wins: number;
  losses: number;
  winRate: number | null;
  totalNet: number;
  avgNet: number | null;
  /** Trades with a known R; avgR is over these only. */
  rCount: number;
  avgR: number | null;
};

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Win = net P&L > 0 (same as the news_impact_stats view). Only closed trades with a known net P&L count. */
export function newsStats(trades: NewsTradeInput[]): NewsStats {
  const counted = trades.filter(t => t.closed_at && toNum(t.net_pnl) !== null);
  const nets = counted.map(t => toNum(t.net_pnl) as number);
  const rs = counted.map(t => toNum(t.result_r)).filter((v): v is number => v !== null);
  const wins = nets.filter(n => n > 0).length;
  const total = nets.reduce((a, b) => a + b, 0);
  return {
    trades: counted.length,
    wins,
    losses: nets.filter(n => n < 0).length,
    winRate: counted.length ? r2((100 * wins) / counted.length) : null,
    totalNet: r2(total),
    avgNet: counted.length ? r2(total / counted.length) : null,
    rCount: rs.length,
    avgR: rs.length ? r2(rs.reduce((a, b) => a + b, 0) / rs.length) : null,
  };
}

export type NewsGroupStats = NewsStats & { key: string; label: string; currency: string | null };
export type NewsImpactReport = {
  buckets: Record<NewsBucket, NewsStats>;
  /** Red-news relations: trades with at least one high-impact link of that relation. */
  byRelation: Record<NewsRelation, NewsStats>;
  /** Near red news, per event currency (a trade near USD and EUR releases counts in both). */
  byCurrency: NewsGroupStats[];
  /** Near red news, per event (MT5 event code). Sorted by trade count. */
  byEvent: NewsGroupStats[];
};

export function newsImpactReport(trades: NewsTradeInput[], summaries: TradeNewsSummary[]): NewsImpactReport {
  const byId = new Map(trades.map(t => [t.id, t]));
  const pick = (ids: Iterable<string>) => [...ids].map(id => byId.get(id)).filter((t): t is NewsTradeInput => !!t);
  const buckets = { near_high: [] as string[], around_high: [] as string[], clear: [] as string[] };
  const relations = Object.fromEntries(NEWS_RELATIONS.map(r => [r, new Set<string>()])) as Record<NewsRelation, Set<string>>;
  const currencies = new Map<string, Set<string>>();
  const eventsMap = new Map<string, { label: string; currency: string; ids: Set<string> }>();
  for (const s of summaries) {
    buckets[s.bucket].push(s.tradeId);
    for (const link of s.links) {
      if (link.impact !== "high") continue;
      relations[link.relation].add(s.tradeId);
      if (!CORE_RELATIONS.has(link.relation)) continue;
      if (!currencies.has(link.currency)) currencies.set(link.currency, new Set());
      currencies.get(link.currency)!.add(s.tradeId);
      const key = `${link.currency}:${link.eventKey}`;
      if (!eventsMap.has(key)) eventsMap.set(key, { label: link.title, currency: link.currency, ids: new Set() });
      eventsMap.get(key)!.ids.add(s.tradeId);
    }
  }
  const group = (key: string, label: string, currency: string | null, ids: Set<string>): NewsGroupStats => ({ key, label, currency, ...newsStats(pick(ids)) });
  return {
    buckets: { near_high: newsStats(pick(buckets.near_high)), around_high: newsStats(pick(buckets.around_high)), clear: newsStats(pick(buckets.clear)) },
    byRelation: Object.fromEntries(NEWS_RELATIONS.map(r => [r, newsStats(pick(relations[r]))])) as Record<NewsRelation, NewsStats>,
    byCurrency: [...currencies].map(([c, ids]) => group(c, c, c, ids)).sort((a, b) => b.trades - a.trades || a.key.localeCompare(b.key)),
    byEvent: [...eventsMap].map(([k, v]) => group(k, v.label, v.currency, v.ids)).sort((a, b) => b.trades - a.trades || a.key.localeCompare(b.key)),
  };
}

// ---------- upcoming releases ----------

export type UpcomingEvent = { id: string; title: string; currency: string | null; impact: string; time: string };

/** Releases that have not happened yet (time ≥ now), soonest first; all-day items are skipped. */
export function upcomingEvents<T extends UpcomingEvent & { allDay?: boolean }>(events: T[], now: number, limit = 3): T[] {
  return events
    .filter(e => !e.allDay && Number.isFinite(Date.parse(e.time)) && Date.parse(e.time) >= now)
    .sort((a, b) => Date.parse(a.time) - Date.parse(b.time))
    .slice(0, limit);
}

/**
 * The red-news window the user is in right now, for the "±N minutes" rule: the release whose window
 * [T − N, T + N] contains now (the latest-ending one when windows overlap), and when it ends. Null when clear.
 */
export function activeNewsWindow<T extends UpcomingEvent>(events: T[], now: number, minutes: number): { event: T; endsAt: string } | null {
  let best: { event: T; end: number } | null = null;
  for (const event of events) {
    if (event.impact !== "high") continue;
    const at = Date.parse(event.time);
    if (!Number.isFinite(at)) continue;
    const start = at - minutes * MIN, end = at + minutes * MIN;
    if (now >= start && now <= end && (!best || end > best.end)) best = { event, end };
  }
  return best ? { event: best.event, endsAt: new Date(best.end).toISOString() } : null;
}
