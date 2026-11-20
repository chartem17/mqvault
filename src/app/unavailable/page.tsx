"use client";

import { StatusPage } from "@/components/layout/status-page";
import { useI18n } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/primitives";

/** Shown with 503 during planned maintenance or when the deployment is not configured (see middleware). */
export default function UnavailablePage() {
  const { t } = useI18n();
  return <StatusPage code="503" title={t("Service temporarily unavailable")} text={t("We are doing maintenance or something is down on our side. Your data is safe. Try again in a few minutes.")}
    action={<Button onClick={() => window.location.reload()}>{t("Try again")}</Button>} home={false} />;
}
