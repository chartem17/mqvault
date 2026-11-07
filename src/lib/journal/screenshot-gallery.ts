import { symbolKey } from "./performance-breakdown";

/**
 * Trade screenshots: TradingView "snapshot" links point at an HTML page
 * (https://www.tradingview.com/x/<id>/); the picture itself lives at
 * https://s3.tradingview.com/snapshots/<first letter of id, lower-case>/<id>.png.
 */
const TRADINGVIEW = /^https?:\/\/(?:www\.|[a-z]{2}\.)?tradingview\.com\/x\/([A-Za-z0-9]+)\/?(?:[?#].*)?$/i;
const IMAGE = /^https?:\/\/[^\s]+\.(?:png|jpe?g|gif|webp|avif)(?:[?#][^\s]*)?$/i;

/** Displayable image for a stored screenshot link, or null when the link is not an image we can show. */
export function screenshotImageUrl(url: string | null | undefined): string | null {
  const value = url?.trim();
  if (!value) return null;
  const match = TRADINGVIEW.exec(value);
  if (match) return `https://s3.tradingview.com/snapshots/${match[1][0].toLowerCase()}/${match[1]}.png`;
  return IMAGE.test(value) ? value : null;
}

export type GalleryPreset = "all" | "best" | "worst" | "mistakes";
export const GALLERY_PRESETS: readonly GalleryPreset[] = ["all", "best", "worst", "mistakes"];
export type GalleryTrade = {
  id: string; opened_at: string; symbol: string; screenshot_url?: string | null; result_r?: number | null; net_pnl?: number | null;
  setup?: string | null; mistake?: string | null; review?: { followed_plan: boolean | null } | null;
};
export type GalleryFilter = { preset: GalleryPreset; symbol?: string; setup?: string };
export type GalleryItem<T> = { trade: T; image: string };

/** A result to compare by: R when known, otherwise nothing (net P&L depends on position size). */
const rOf = (trade: GalleryTrade) => (typeof trade.result_r === "number" && Number.isFinite(trade.result_r) ? trade.result_r : null);
export const isMistake = (trade: GalleryTrade) => Boolean(trade.mistake?.trim()) || trade.review?.followed_plan === false;

/**
 * Trades with a showable screenshot for a preset:
 * - all: newest first;
 * - best: winners by R, highest first; worst: losers by R, lowest first (trades without R are left out);
 * - mistakes: a mistake is marked or the trade was reviewed as "not to plan", newest first.
 * Symbol (EURUSD = EUR/USD) and setup narrow any preset.
 */
export function galleryItems<T extends GalleryTrade>(trades: readonly T[], filter: GalleryFilter): GalleryItem<T>[] {
  const symbol = filter.symbol ? symbolKey(filter.symbol) : null;
  const setup = filter.setup?.trim().toLowerCase() || null;
  const items: GalleryItem<T>[] = [];
  for (const trade of trades) {
    const image = screenshotImageUrl(trade.screenshot_url);
    if (!image) continue;
    if (symbol && symbolKey(trade.symbol) !== symbol) continue;
    if (setup && (trade.setup?.trim().toLowerCase() ?? "") !== setup) continue;
    const r = rOf(trade);
    if (filter.preset === "best" && !(r !== null && r > 0)) continue;
    if (filter.preset === "worst" && !(r !== null && r < 0)) continue;
    if (filter.preset === "mistakes" && !isMistake(trade)) continue;
    items.push({ trade, image });
  }
  const newest = (a: GalleryItem<T>, b: GalleryItem<T>) => Date.parse(b.trade.opened_at) - Date.parse(a.trade.opened_at) || a.trade.id.localeCompare(b.trade.id);
  if (filter.preset === "best") return items.sort((a, b) => (rOf(b.trade) as number) - (rOf(a.trade) as number) || newest(a, b));
  if (filter.preset === "worst") return items.sort((a, b) => (rOf(a.trade) as number) - (rOf(b.trade) as number) || newest(a, b));
  return items.sort(newest);
}
