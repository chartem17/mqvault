"use client";

import Link from "next/link";
import { useI18n } from "@/components/providers/i18n-provider";
import { LEGAL_LINKS } from "@/lib/legal/documents";
import { msg } from "@/lib/i18n/core";

const COLUMNS: { title: string; links: { href: string; label: string }[] }[] = [
  { title: msg("Product"), links: [
    { href: "/journal", label: msg("Journal") }, { href: "/playbook", label: msg("Playbook") },
    { href: "/strategy-control", label: msg("Strategy control") }, { href: "/bridge/connect", label: msg("MT5 Bridge") },
  ] },
  { title: msg("Help"), links: [
    { href: "/help", label: msg("Help and FAQ") }, { href: "/help#connect", label: msg("Connecting accounts") },
    { href: "/help#troubleshooting", label: msg("Troubleshooting") }, { href: "/help#changes", label: msg("What's new") },
  ] },
  { title: msg("Legal"), links: LEGAL_LINKS.map(link => ({ href: `/${link.slug}`, label: link.label })) },
];

/** Bottom of every page: where to find things, the legal texts and the risk warning. */
export function SiteFooter({ className = "" }: { className?: string }) {
  const { t } = useI18n();
  return <footer className={`border-t border-border px-4 pb-8 pt-8 text-sm sm:px-6 xl:px-8 ${className}`}>
    <div className="mx-auto grid max-w-5xl grid-cols-2 gap-6 sm:grid-cols-4">
      <div className="col-span-2 sm:col-span-1">
        <div className="font-semibold tracking-tight">Trade Vault</div>
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{t("A private trading journal: record, review, improve.")}</p>
      </div>
      {COLUMNS.map(column => <nav key={column.title} aria-label={t(column.title)}>
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t(column.title)}</div>
        <ul className="m-0 mt-2 space-y-1.5 p-0">{column.links.map(link => <li key={link.href} className="list-none">
          <Link href={link.href} prefetch={false} className="text-muted-foreground hover:text-foreground">{t(link.label)}</Link>
        </li>)}</ul>
      </nav>)}
    </div>
    <p className="mx-auto mt-8 max-w-5xl text-xs leading-relaxed text-muted-foreground">
      {t("Trading involves a high risk of loss. Trade Vault is a journal and analysis tool, not a broker and not investment advice.")}{" "}
      <Link href="/risk-disclosure" className="underline underline-offset-2 hover:text-foreground">{t("Risk disclosure")}</Link>
    </p>
    <p className="mx-auto mt-2 max-w-5xl text-xs text-muted-foreground">© {new Date().getUTCFullYear()} Trade Vault</p>
  </footer>;
}
