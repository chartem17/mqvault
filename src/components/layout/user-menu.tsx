"use client";

import { Hint } from "@/components/ui/hint";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { KeyRound, LogOut, Settings, UserRound } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { useI18n } from "@/components/providers/i18n-provider";
import { useCurrentUser } from "@/hooks/use-current-user";

const itemClass = "flex min-h-11 w-full items-center gap-2.5 rounded-lg px-3 text-left text-sm hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring";

/** Header account button: who is signed in, change password, sign out. */
export function UserMenu() {
  const { t } = useI18n();
  const user = useCurrentUser();
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", onPointer); document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onPointer); document.removeEventListener("keydown", onKey); };
  }, [open]);

  async function signOut() {
    if (leaving) return;
    setLeaving(true);
    try { await fetch("/api/auth/logout", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}", credentials: "same-origin" }); } catch { /* the reload below shows the real state */ }
    window.location.assign("/login");
  }

  const label = t("Account menu");
  return (
    <div ref={root} className="relative shrink-0">
      <Hint label={label} side="bottom"><Button variant="secondary" className="px-2.5 sm:px-3" aria-label={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(value => !value)}>
        <UserRound aria-hidden="true" className="h-4 w-4 shrink-0" />
      </Button></Hint>
      {open && (
        <div role="menu" aria-label={label} className="absolute right-0 top-full z-50 mt-2 w-64 max-w-[calc(100vw-1.5rem)] rounded-xl border border-border bg-card p-1.5 shadow-2xl">
          <div className="border-b border-border px-3 pb-2.5 pt-2">
            <div className="text-xs text-muted-foreground">{t("Signed in as")}</div>
            <div className="truncate text-sm font-medium" title={user?.email ?? undefined}>{user?.email ?? "…"}</div>
          </div>
          <Link role="menuitem" href="/profile" className={`${itemClass} mt-1.5`} onClick={() => setOpen(false)}><UserRound aria-hidden="true" className="h-4 w-4 shrink-0" />{t("Profile")}</Link>
          <Link role="menuitem" href="/settings" className={itemClass} onClick={() => setOpen(false)}><Settings aria-hidden="true" className="h-4 w-4 shrink-0" />{t("Settings")}</Link>
          <Link role="menuitem" href="/reset-password" className={itemClass} onClick={() => setOpen(false)}><KeyRound aria-hidden="true" className="h-4 w-4 shrink-0" />{t("Change password")}</Link>
          <button role="menuitem" type="button" className={itemClass} disabled={leaving} onClick={signOut}><LogOut aria-hidden="true" className="h-4 w-4 shrink-0" />{leaving ? t("Signing out…") : t("Sign out")}</button>
        </div>
      )}
    </div>
  );
}
