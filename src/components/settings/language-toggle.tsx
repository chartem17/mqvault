"use client";

import { Languages } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { useI18n } from "@/components/providers/i18n-provider";
import { LOCALE_LABEL, type Locale } from "@/lib/i18n/core";

/** Header switch between English (default) and Ukrainian; the choice is kept in a cookie. */
export function LanguageToggle() {
  const { locale, setLocale, t } = useI18n();
  const next: Locale = locale === "en" ? "uk" : "en";
  const label = t("Switch language to {language}", { language: LOCALE_LABEL[next] });
  return <Button variant="secondary" className="px-2.5 sm:px-4" aria-label={label} title={label} onClick={() => setLocale(next)}>
    <Languages aria-hidden="true" className="hidden h-4 w-4 shrink-0 sm:block" />
    <span className="text-xs font-semibold uppercase tracking-wide">{locale === "en" ? "EN" : "UA"}</span>
  </Button>;
}
