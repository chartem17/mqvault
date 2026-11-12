"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { GO_TO, SHORTCUTS } from "@/lib/help/content";
import { useI18n } from "@/components/providers/i18n-provider";

const typing = (target: EventTarget | null) => target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

/** Global keys: "?" opens this list, "g" + letter navigates. Ignored while typing in a field. */
export function Shortcuts() {
  const { t } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const pendingG = useRef(0);
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey || typing(event.target)) return;
      if (event.key === "Escape") { setOpen(false); return; }
      if (event.key === "?") { event.preventDefault(); setOpen(value => !value); return; }
      const key = event.key.toLowerCase();
      if (key === "g") { pendingG.current = Date.now(); return; }
      if (Date.now() - pendingG.current < 1200 && GO_TO[key]) { event.preventDefault(); pendingG.current = 0; setOpen(false); router.push(GO_TO[key], { scroll: false }); }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [router]);
  if (!open || typeof document === "undefined") return null;
  return createPortal(<div className="fixed inset-0 z-50 flex items-center justify-center px-4" role="dialog" aria-modal="true" aria-label={t("Keyboard shortcuts")}>
    <button type="button" aria-label={t("Close")} onClick={() => setOpen(false)} className="absolute inset-0 cursor-default bg-black/40 backdrop-blur-[2px]" />
    <div className="relative w-full max-w-sm animate-[ui-pop-in_0.25s_cubic-bezier(0.22,1,0.36,1)] rounded-2xl border border-border bg-popover p-5 shadow-2xl">
      <div className="mb-3 flex items-center justify-between"><h2 className="m-0 text-base font-semibold">{t("Keyboard shortcuts")}</h2>
        <button type="button" onClick={() => setOpen(false)} aria-label={t("Close")} className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent"><X className="h-4 w-4" aria-hidden="true" /></button></div>
      <ul className="m-0 space-y-2 p-0">{SHORTCUTS.map(item => <li key={item.label} className="flex list-none items-center justify-between gap-4 text-sm">
        <span>{t(item.label)}</span>
        <span className="flex gap-1">{item.keys.map(key => <kbd key={key} className="rounded-md border border-border bg-secondary px-1.5 py-0.5 text-[11px] text-muted-foreground">{key}</kbd>)}</span>
      </li>)}</ul>
    </div>
  </div>, document.body);
}
