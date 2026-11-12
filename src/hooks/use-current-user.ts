"use client";

import { useEffect, useState } from "react";

export type CurrentUser = { email: string | null; isOwner: boolean };

// One request per page load, shared by every component that asks who is signed in.
let pending: Promise<CurrentUser | null> | null = null;

function load(): Promise<CurrentUser | null> {
  pending ??= fetch("/api/me", { cache: "no-store", credentials: "same-origin" })
    .then(response => (response.ok ? response.json() : null))
    .then((body: { email?: unknown; isOwner?: unknown } | null) => (body ? { email: typeof body.email === "string" ? body.email : null, isOwner: body.isOwner === true } : null))
    .catch(() => { pending = null; return null; });
  return pending;
}

/** The signed-in user, or null while loading / when signed out. Sign-in and sign-out reload the page, which resets this. */
export function useCurrentUser(): CurrentUser | null {
  const [user, setUser] = useState<CurrentUser | null>(null);
  useEffect(() => { let cancelled = false; load().then(value => { if (!cancelled) setUser(value); }); return () => { cancelled = true; }; }, []);
  return user;
}
