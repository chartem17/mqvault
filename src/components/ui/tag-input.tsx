"use client";

import { useRef, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/components/providers/i18n-provider";

type Props = {
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  maxTags?: number;
  maxLength?: number;
  "aria-label": string;
  id?: string;
};

/**
 * Tags as chips: Enter (or comma) turns the typed word into a chip, × or Backspace on an empty field removes one.
 * The chip pops in and shrinks away with the site's motion rules (prefers-reduced-motion is honoured globally).
 */
export function TagInput({ value, onChange, placeholder, maxTags = 50, maxLength = 60, id, ...aria }: Props) {
  const { t } = useI18n();
  const [draft, setDraft] = useState("");
  const input = useRef<HTMLInputElement>(null);

  function commit(raw: string) {
    const tag = raw.trim().replace(/\s+/g, " ").slice(0, maxLength);
    if (!tag) return;
    if (!value.some(item => item.toLowerCase() === tag.toLowerCase()) && value.length < maxTags) onChange([...value, tag]);
    setDraft("");
  }

  return <div
    className="flex min-h-10 w-full cursor-text flex-wrap items-center gap-1.5 rounded-lg border border-input bg-background px-2 py-1.5 transition-[border-color,box-shadow] focus-within:border-ring focus-within:shadow-[0_0_0_3px_color-mix(in_oklab,var(--color-ring)_18%,transparent)]"
    onMouseDown={event => { if (event.target === event.currentTarget) { event.preventDefault(); input.current?.focus(); } }}
  >
    {value.map(tag => <span key={tag} className="inline-flex max-w-full animate-[ui-chip-in_0.18s_cubic-bezier(0.34,1.56,0.64,1)] items-center gap-1 rounded-md bg-accent px-2 py-0.5 text-xs text-accent-foreground">
      <span className="truncate">{tag}</span>
      <button type="button" aria-label={t("Remove {name}", { name: tag })} className="rounded-sm text-muted-foreground hover:text-foreground"
        onClick={() => onChange(value.filter(item => item !== tag))}><X className="h-3 w-3" aria-hidden="true" /></button>
    </span>)}
    <input
      {...aria} id={id} ref={input} value={draft} placeholder={value.length ? undefined : placeholder}
      className={cn("min-w-20 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground")}
      onChange={event => {
        const text = event.target.value;
        if (text.includes(",")) { text.split(",").forEach(commit); return; }
        setDraft(text);
      }}
      onKeyDown={event => {
        if (event.key === "Enter") { event.preventDefault(); commit(draft); }
        else if (event.key === "Backspace" && !draft && value.length) onChange(value.slice(0, -1));
      }}
      onBlur={() => commit(draft)}
    />
  </div>;
}
