"use client";

import { useEffect } from "react";
import { StatusPage } from "@/components/layout/status-page";
import { useI18n } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/primitives";

/** Unexpected error inside a page: a plain message and a retry. Details go to the console only, never to the screen. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useI18n();
  useEffect(() => { console.error("Page error", error.digest ?? error.message); }, [error]);
  return <StatusPage code={t("Error")} title={t("Something went wrong")} text={t("Your data is safe. Try again; if it keeps happening, reload the page.")}
    action={<Button onClick={reset}>{t("Try again")}</Button>} />;
}
