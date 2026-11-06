/**
 * Minimal i18n. English is the source language: UI code writes English strings and wraps them
 * in `t()`. Other languages map the English text to a translation; anything missing falls back
 * to English, so an untranslated string is never blank.
 */
export const LOCALES = ["en", "uk"] as const;
export type Locale = typeof LOCALES[number];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "mq_locale";
export const LOCALE_LABEL: Record<Locale, string> = { en: "English", uk: "Українська" };
/** BCP-47 tag for Intl date/number formatting. */
export const INTL_LOCALE: Record<Locale, string> = { en: "en-GB", uk: "uk-UA" };

export type PluralForms = { one: string; few?: string; many?: string; other?: string };
export type Dictionary = Record<string, string | PluralForms>;
export type Vars = Record<string, string | number>;

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

export function interpolate(text: string, vars?: Vars): string {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) => name in vars ? String(vars[name]) : match);
}

/** Plural category with the same rules as Intl.PluralRules for en/uk. */
export function pluralCategory(locale: Locale, count: number): "one" | "few" | "many" | "other" {
  const n = Math.abs(count);
  if (!Number.isInteger(n)) return "other";
  if (locale === "en") return n === 1 ? "one" : "other";
  const mod10 = n % 10, mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "one";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "few";
  return "many";
}

export function translate(dictionary: Dictionary | null, text: string, vars?: Vars): string {
  const entry = dictionary?.[text];
  return interpolate(typeof entry === "string" ? entry : text, vars);
}

/**
 * Pluralised text. `one`/`other` are the English forms; the translation is looked up by `other`.
 * `{count}` is always available in the template.
 */
export function translatePlural(locale: Locale, dictionary: Dictionary | null, count: number, one: string, other: string, vars?: Vars): string {
  const all = { count, ...vars };
  const entry = dictionary?.[other];
  if (entry && typeof entry === "object") {
    const category = pluralCategory(locale, count);
    const form = entry[category] ?? entry.many ?? entry.other ?? entry.one;
    return interpolate(form, all);
  }
  if (typeof entry === "string") return interpolate(entry, all);
  return interpolate(pluralCategory("en", count) === "one" ? one : other, all);
}

/** Marks English text defined outside components (catalogues, labels) for translation at render time with `t()`. */
export const msg = (text: string): string => text;
