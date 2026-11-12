"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { TrendingUp } from "lucide-react";
import { useI18n } from "@/components/providers/i18n-provider";

/** Full-page message for 404 and unexpected errors: the site's look, no technical details. */
export function StatusPage({ code, title, text, action }: { code: string; title: string; text: string; action?: ReactNode }) {
  const { t } = useI18n();
  return <main className="flex min-h-dvh items-center justify-center px-4 py-16">
    <div className="w-full max-w-md text-center">
      <div className="mx-auto mb-6 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10"><TrendingUp className="h-5 w-5 text-primary" aria-hidden="true" /></div>
      <p className="m-0 text-sm font-semibold tabular-nums text-primary">{code}</p>
      <h1 className="mt-2 text-2xl font-semibold">{title}</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        {action}
        <Link href="/" className="inline-flex min-h-10 items-center rounded-xl border border-border bg-secondary px-4 text-sm font-medium text-secondary-foreground hover:bg-accent">{t("Go to Home")}</Link>
      </div>
    </div>
  </main>;
}
