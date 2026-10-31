"use client";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { Button } from "./primitives";

export function ConfirmDialog({ open, title, description, onConfirm, onCancel }: { open: boolean; title: string; description: string; onConfirm: () => void; onCancel: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => {
    const node = dialog.current;
    if (!open || !node) return;
    const previous = document.activeElement;
    node.showModal(); cancel.current?.focus();
    return () => { node.close(); if (previous instanceof HTMLElement && previous.isConnected) previous.focus(); };
  }, [open]);
  if (!open || typeof document === "undefined") return null;
  return createPortal(<dialog ref={dialog} aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`} onCancel={event => { event.preventDefault(); onCancel(); }} className="fixed inset-0 m-auto w-[min(440px,calc(100vw-2rem))] rounded-2xl border border-border bg-card p-6 text-foreground shadow-2xl backdrop:bg-black/70">
    <h2 id={`${id}-title`} className="text-lg font-semibold">{title}</h2>
    <p id={`${id}-description`} className="mt-3 text-sm leading-6 text-muted-foreground">{description}</p>
    <div className="mt-6 flex justify-end gap-3"><Button ref={cancel} size="lg" variant="secondary" onClick={onCancel}>Скасувати</Button><Button size="lg" variant="destructive" onClick={onConfirm}>Видалити</Button></div>
  </dialog>, document.body);
}
