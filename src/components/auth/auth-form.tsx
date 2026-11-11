"use client";

import { useId, useState, type FormEvent, type InputHTMLAttributes, type ReactNode } from "react";
import { TrendingUp } from "lucide-react";
import { LanguageToggle } from "@/components/settings/language-toggle";
import { useI18n } from "@/components/providers/i18n-provider";

/** Page frame shared by sign-in, sign-up and the password forms. Works from 320px up. */
export function AuthCard({ title, subtitle, children, footer }: { title: string; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <main className="relative flex min-h-dvh items-center justify-center px-4 py-16">
      <div className="absolute right-4 top-4"><LanguageToggle /></div>
      <div className="w-full max-w-sm">
        <div className="mb-5 flex items-center justify-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary/10"><TrendingUp aria-hidden="true" className="h-4.5 w-4.5 text-primary" /></div>
          <span className="text-base font-semibold tracking-tight">Trade Vault</span>
        </div>
        <div className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-2xl">
          <div>
            <h1 className="text-lg font-semibold">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          {children}
        </div>
        {footer && <div className="mt-4 text-center text-sm text-muted-foreground">{footer}</div>}
      </div>
    </main>
  );
}

export function AuthInput({ label, hint, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium">{label}</label>
      <input id={id} aria-describedby={hint ? `${id}-hint` : undefined} {...props} className="h-11 w-full rounded-lg border border-border bg-background px-3 text-base outline-none focus:ring-2 focus:ring-ring sm:text-sm" />
      {hint && <p id={`${id}-hint`} className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function AuthSubmit({ busy, children }: { busy: boolean; children: ReactNode }) {
  return <button type="submit" disabled={busy} aria-busy={busy} className="h-11 w-full rounded-lg bg-primary text-sm font-medium text-primary-foreground disabled:opacity-60">{children}</button>;
}

export function AuthMessage({ tone, children }: { tone: "error" | "info"; children: ReactNode }) {
  return <p role={tone === "error" ? "alert" : "status"} className={`rounded-lg border px-3 py-2 text-sm ${tone === "error" ? "border-destructive/40 text-destructive" : "border-border text-muted-foreground"}`}>{children}</p>;
}

export const authLinkClass = "font-medium text-primary underline-offset-4 hover:underline focus-visible:underline";

type Result = { ok: true; data: Record<string, unknown> } | { ok: false; code?: string };

/** One in-flight POST to an /api/auth/* route; `error` holds the server's English message (translated by the caller's t()). */
export function useAuthRequest() {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function send(path: string, body: Record<string, unknown>): Promise<Result> {
    if (busy) return { ok: false };
    setBusy(true); setError("");
    try {
      const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), credentials: "same-origin" });
      const data = await response.json().catch(() => null) as Record<string, unknown> | null;
      if (response.ok) return { ok: true, data: data ?? {} };
      setError(typeof data?.error === "string" ? t(data.error) : t("Something went wrong. Try again."));
      setBusy(false);
      return { ok: false, code: typeof data?.code === "string" ? data.code : undefined };
    } catch { setError(t("No connection")); }
    setBusy(false);
    return { ok: false };
  }
  /** Call when the page stays open after a success (e.g. "check your e-mail"). */
  const settle = () => setBusy(false);
  const guard = (handler: () => void) => (event: FormEvent) => { event.preventDefault(); handler(); };
  return { busy, error, setError, send, settle, guard };
}
