"use client";

import Link from "next/link";
import { ArrowLeft, FileText, TriangleAlert } from "lucide-react";
import { Panel } from "@/components/ui/primitives";
import { SiteFooter } from "@/components/layout/site-footer";
import { useI18n } from "@/components/providers/i18n-provider";
import { LEGAL_DOCUMENTS, LEGAL_OPERATOR, legalDraft, type LegalDocument } from "@/lib/legal/documents";

/** One legal document. Public: readable before sign-up (the sign-up form links here). */
export function LegalPage({ slug }: { slug: LegalDocument["slug"] }) {
  const { t, intl } = useI18n();
  const doc = LEGAL_DOCUMENTS[slug];
  const pending = t("[to be announced]");
  const fill = { operator: LEGAL_OPERATOR.name ?? pending, contact: LEGAL_OPERATOR.contact ?? pending, jurisdiction: LEGAL_OPERATOR.jurisdiction ?? pending };
  const updated = new Date(`${doc.updated}T12:00:00Z`).toLocaleDateString(intl, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

  return <div className="flex min-h-dvh flex-col">
    <main className="page-enter mx-auto w-full max-w-2xl flex-1 space-y-4 px-4 py-6 sm:px-6 sm:py-10">
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" aria-hidden="true" />{t("Back to Trade Vault")}</Link>
      <header>
        <h1 className="m-0 flex items-center gap-2.5 text-2xl font-semibold"><FileText className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />{t(doc.title)}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t(doc.summary)}</p>
        <p className="mt-1 text-xs text-muted-foreground">{t("Last updated: {date}", { date: updated })}</p>
      </header>
      {legalDraft() && <div role="note" className="flex gap-2.5 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm leading-relaxed">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden="true" />
        <span>{t("Draft for the closed beta. The operator, contact address and governing law will be added before the public launch.")}</span>
      </div>}
      <Panel className="p-5 sm:p-7">
        <ol className="m-0 space-y-6 p-0">
          {doc.sections.map((section, index) => <li key={section.heading} className="list-none">
            <h2 className="m-0 text-base font-semibold"><span className="mr-2 tabular-nums text-muted-foreground">{index + 1}.</span>{t(section.heading)}</h2>
            {section.paragraphs.map(paragraph => <p key={paragraph} className="mb-0 mt-2 text-sm leading-relaxed text-muted-foreground">{t(paragraph, fill)}</p>)}
          </li>)}
        </ol>
      </Panel>
    </main>
    <SiteFooter />
  </div>;
}
