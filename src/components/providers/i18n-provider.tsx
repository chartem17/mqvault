"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { DEFAULT_LOCALE, INTL_LOCALE, LOCALE_COOKIE, translate, translatePlural, type Dictionary, type Locale, type Vars } from "@/lib/i18n/core";
import { uk } from "@/lib/i18n/uk";

const DICTIONARIES: Record<Locale, Dictionary | null> = { en: null, uk };

type I18nValue = {
  locale: Locale;
  /** BCP-47 tag for Intl formatting (dates, numbers). */
  intl: string;
  setLocale: (locale: Locale) => void;
  /** Translate English source text; `{name}` placeholders are filled from `vars`. */
  t: (text: string, vars?: Vars) => string;
  /** Plural: English `one`/`other` forms, `{count}` is filled in. */
  tn: (count: number, one: string, other: string, vars?: Vars) => string;
};
const Context = createContext<I18nValue | null>(null);

export function I18nProvider({ initialLocale, children }: { initialLocale: Locale; children: ReactNode }) {
  const [locale, setCurrent] = useState<Locale>(initialLocale);
  const setLocale = useCallback((next: Locale) => {
    setCurrent(next);
    try { document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`; } catch { /* cookies may be blocked */ }
    document.documentElement.lang = next;
  }, []);
  const value = useMemo<I18nValue>(() => {
    const dictionary = DICTIONARIES[locale];
    return {
      locale, intl: INTL_LOCALE[locale], setLocale,
      t: (text, vars) => translate(dictionary, text, vars),
      tn: (count, one, other, vars) => translatePlural(locale, dictionary, count, one, other, vars),
    };
  }, [locale, setLocale]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

const FALLBACK: I18nValue = { locale: DEFAULT_LOCALE, intl: INTL_LOCALE[DEFAULT_LOCALE], setLocale: () => {}, t: (text, vars) => translate(null, text, vars), tn: (count, one, other, vars) => translatePlural(DEFAULT_LOCALE, null, count, one, other, vars) };
export function useI18n(): I18nValue { return useContext(Context) ?? FALLBACK; }
