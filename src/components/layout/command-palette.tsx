"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import type { TabId } from "@/app/page";
import { SECTION_LABEL, visiblePages } from "./nav-pages";
import { useProfile } from "@/components/providers/profile-provider";
import { useI18n } from "@/components/providers/i18n-provider";

/**
 * Ctrl/⌘K page search. Lists every destination, filters as you type (English and translated names),
 * ↑/↓ + Enter navigate, Esc closes.
 */
export function CommandPalette({ open, onClose, setActiveTab }: { open: boolean; onClose: () => void; setActiveTab: (tab: TabId) => void }) {
  const { t } = useI18n();
  const router = useRouter();
  const isOwner = useProfile().profile?.plan === "owner";
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  const pages = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return visiblePages(isOwner)
      .filter(page => !needle || page.label.toLowerCase().includes(needle) || t(page.label).toLowerCase().includes(needle));
  }, [query, t, isOwner]);

  useEffect(() => { if (open) { setQuery(""); setIndex(0); setTimeout(() => input.current?.focus(), 10); } }, [open]);
  useEffect(() => { setIndex(0); }, [query]);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); onClose(); } };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;

  function go(page: (typeof pages)[number]) {
    onClose();
    if (page.target.kind === "tab") setActiveTab(page.target.tab);
    else router.push(page.target.href);
  }

  return <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[14vh]" role="dialog" aria-modal="true" aria-label={t("Search pages")}>
    <button type="button" aria-label={t("Close")} onClick={onClose} className="absolute inset-0 cursor-default bg-black/40 backdrop-blur-[2px]" />
    <div className="relative w-full animate-[ui-pop-in_0.25s_cubic-bezier(0.22,1,0.36,1)] max-w-md overflow-hidden rounded-2xl border border-border bg-popover shadow-2xl">
      <div className="flex items-center gap-2.5 border-b border-border px-4">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <input ref={input} value={query} onChange={event => setQuery(event.target.value)} placeholder={t("Search pages…")} aria-label={t("Search pages")}
          className="min-h-12 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          onKeyDown={event => {
            if (event.key === "ArrowDown") { event.preventDefault(); setIndex(value => Math.min(value + 1, pages.length - 1)); }
            else if (event.key === "ArrowUp") { event.preventDefault(); setIndex(value => Math.max(value - 1, 0)); }
            else if (event.key === "Enter" && pages[index]) { event.preventDefault(); go(pages[index]); }
          }} />
        <kbd className="shrink-0 rounded-md border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">Esc</kbd>
      </div>
      <ul className="max-h-72 overflow-y-auto p-1.5" role="listbox" aria-label={t("Pages")}>
        {pages.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted-foreground">{t("Nothing found")}</li>}
        {pages.map((page, position) => {
          const Icon = page.icon;
          return <li key={page.key} role="option" aria-selected={position === index}>
            <button type="button" onClick={() => go(page)} onMouseMove={() => setIndex(position)}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm ${position === index ? "bg-accent text-foreground" : "text-muted-foreground"}`}>
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="flex-1 truncate">{t(page.label)}</span>
              <span className="shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground/70">{t(SECTION_LABEL[page.section])}</span>
            </button>
          </li>;
        })}
      </ul>
    </div>
  </div>;
}
