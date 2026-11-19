"use client";

import { useI18n } from "@/components/providers/i18n-provider";

export function WorkspaceLoading() {
  const { t } = useI18n();
  return <div role="status" className="p-6 text-sm text-muted-foreground">{t("Loading workspace…")}</div>;
}
