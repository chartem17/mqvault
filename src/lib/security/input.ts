/**
 * Server-side checks for free-form fields (security pass 2026-11-26). Pure, so the limits are unit-tested.
 * The browser validates too, but the API trusts nothing it receives: every text is trimmed and capped, and a
 * link is kept only if it is a plain http(s) address (no `javascript:`, `data:` or other schemes).
 */

/** Trimmed text cut to `max` characters, or null when empty or not a string/number. */
export function boundedText(value: unknown, max: number): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const text = String(value).trim();
  return text ? text.slice(0, max) : null;
}

export const MAX_URL_LENGTH = 500;

/** The value as an absolute http(s) URL without credentials, or null. */
export function httpUrl(value: unknown, max = MAX_URL_LENGTH): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text || text.length > max || /[\s\u0000-\u001f]/.test(text)) return null;
  try {
    const url = new URL(text);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (url.username || url.password) return null;
    return text;
  } catch {
    return null;
  }
}

/**
 * Longest stored value per free-text trade field. Notes get room for a real write-up; labels stay short.
 * The same numbers apply to the form, the CSV import and the API.
 */
export const TRADE_TEXT_LIMITS = {
  market: 40,
  session: 40,
  setup: 200,
  htf_bias: 60,
  entry_reason: 2000,
  exit_reason: 2000,
  emotion: 60,
  mistake: 200,
  notes: 10000,
  external_id: 120,
} as const;

export const MAX_SYMBOL_LENGTH = 40;
