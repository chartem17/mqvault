"use client";

import { useState, type FormEvent } from "react";
import { safeNextPath } from "@/lib/session-token";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || !password) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }), credentials: "same-origin" });
      if (response.ok) {
        window.location.assign(safeNextPath(new URLSearchParams(window.location.search).get("next")));
        return;
      }
      const data = await response.json().catch(() => null) as { error?: string } | null;
      setError(data?.error ?? "Не вдалося увійти");
    } catch { setError("Немає зʼєднання"); }
    setBusy(false);
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <div>
          <h1 className="text-lg font-semibold">Trade Vault</h1>
          <p className="mt-1 text-sm text-muted-foreground">Приватний простір. Введіть пароль доступу.</p>
        </div>
        <input type="text" name="username" autoComplete="username" defaultValue="owner" hidden readOnly />
        <input
          type="password" name="password" autoComplete="current-password" autoFocus required
          value={password} onChange={event => setPassword(event.target.value)} aria-label="Пароль"
          className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <button type="submit" disabled={busy || !password} className="h-10 w-full rounded-lg bg-primary text-sm font-medium text-primary-foreground disabled:opacity-60">
          {busy ? "Вхід…" : "Увійти"}
        </button>
      </form>
    </main>
  );
}
