"use client";

import { StatusPage } from "@/components/layout/status-page";
import { useI18n } from "@/components/providers/i18n-provider";

export default function NotFound() {
  const { t } = useI18n();
  return <StatusPage code="404" title={t("Page not found")} text={t("The address may be mistyped, or the page has moved.")} />;
}
