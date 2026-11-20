"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronDown, Keyboard, LifeBuoy, Sparkles } from "lucide-react";
import { Panel } from "@/components/ui/primitives";
import { SiteFooter } from "@/components/layout/site-footer";
import { useI18n } from "@/components/providers/i18n-provider";
import { CHANGELOG, FAQ, LATEST_CHANGE, SHORTCUTS } from "@/lib/help/content";
import { msg } from "@/lib/i18n/core";

const SEEN_CHANGES_KEY = "mq_seen_changes";

/** Help: answers by section (anchors such as /help#connect), what changed recently and the keyboard shortcuts. */
export default function HelpPage() {
  const { t, intl } = useI18n();
  useEffect(() => { try { localStorage.setItem(SEEN_CHANGES_KEY, LATEST_CHANGE); } catch { /* storage may be blocked */ } }, []);
  const date = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString(intl, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

  return <><main className="page-enter mx-auto w-full max-w-2xl space-y-4 px-3 py-5 sm:px-6 sm:py-8">
    <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" aria-hidden="true" />{t("Back to workspace")}</Link>
    <h1 className="flex items-center gap-2.5 text-xl font-semibold"><LifeBuoy className="h-5 w-5 text-primary" aria-hidden="true" />{t("Help")}</h1>

    <nav aria-label={t("Contents")} className="flex flex-wrap gap-2">
      {[...FAQ.map(section => ({ id: section.id, title: section.title })), { id: "changes", title: msg("What's new") }, { id: "shortcuts", title: msg("Keyboard shortcuts") }].map(item =>
        <a key={item.id} href={`#${item.id}`} className="rounded-full border border-border bg-secondary px-3 py-1 text-xs text-secondary-foreground hover:bg-accent">{t(item.title)}</a>)}
    </nav>

    {FAQ.map(section => <Panel key={section.id} id={section.id} className="scroll-mt-4 p-5 sm:p-6">
      <h2 className="m-0 text-sm font-semibold uppercase tracking-wider text-muted-foreground">{t(section.title)}</h2>
      <div className="mt-2 divide-y divide-border">
        {section.items.map(item => <details key={item.q} className="group py-3">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium">{t(item.q)}<ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" /></summary>
          <p className="mb-0 mt-2 text-sm leading-relaxed text-muted-foreground">{t(item.a)}</p>
        </details>)}
      </div>
    </Panel>)}

    <Panel id="changes" className="scroll-mt-4 p-5 sm:p-6">
      <h2 className="m-0 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground"><Sparkles className="h-4 w-4" aria-hidden="true" />{t("What's new")}</h2>
      <div className="mt-3 space-y-4">{CHANGELOG.map(entry => <div key={entry.date}>
        <div className="text-xs text-muted-foreground">{date(entry.date)}</div>
        <ul className="mt-1.5 space-y-1 pl-4 text-sm">{entry.items.map(item => <li key={item} className="list-disc">{t(item)}</li>)}</ul>
      </div>)}</div>
    </Panel>

    <Panel id="shortcuts" className="scroll-mt-4 p-5 sm:p-6">
      <h2 className="m-0 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground"><Keyboard className="h-4 w-4" aria-hidden="true" />{t("Keyboard shortcuts")}</h2>
      <ul className="m-0 mt-3 space-y-2 p-0">{SHORTCUTS.map(item => <li key={item.label} className="flex list-none items-center justify-between gap-4 text-sm">
        <span>{t(item.label)}</span><span className="flex gap-1">{item.keys.map(key => <kbd key={key} className="rounded-md border border-border bg-secondary px-1.5 py-0.5 text-[11px] text-muted-foreground">{key}</kbd>)}</span>
      </li>)}</ul>
    </Panel>
  </main><SiteFooter /></>;
}
