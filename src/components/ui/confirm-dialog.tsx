"use client";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";

export function ConfirmDialog({ open, title, description, onConfirm, onCancel }: { open: boolean; title: string; description: string; onConfirm: () => void; onCancel: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => {
    const node = dialog.current;
    if (!open || !node) return;
    const previous = document.activeElement;
    node.showModal();
    cancel.current?.focus();
    return () => { node.close(); if (previous instanceof HTMLElement && previous.isConnected) previous.focus(); };
  }, [open]);
  if (!open || typeof document === "undefined") return null;
  return createPortal(<dialog ref={dialog} aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`} onCancel={event => { event.preventDefault(); onCancel(); }} className="fixed inset-0 m-auto w-[min(440px,calc(100vw-2rem))] rounded-2xl border border-border bg-card p-6 text-foreground shadow-2xl backdrop:bg-black/70">
    <h2 id={`${id}-title`} className="text-lg font-semibold">{title}</h2>
    <p id={`${id}-description`} className="mt-3 text-sm leading-6 text-muted-foreground">{description}</p>
    <div className="mt-6 flex justify-end gap-3">
      <button ref={cancel} type="button" onClick={onCancel} className="min-h-11 rounded-xl border border-border px-4 text-sm focus-visible:outline focus-visible:outline-2">Скасувати</button>
      <button type="button" onClick={onConfirm} className="min-h-11 rounded-xl bg-red-600 px-4 text-sm font-medium text-white hover:bg-red-700 focus-visible:outline focus-visible:outline-2">Видалити</button>
    </div>
  </dialog>, document.body);
}
