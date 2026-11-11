"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Profile = {
  id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  /** Role in the closed beta (ADR 0017): the installation owner or an invited user. */
  plan: "owner" | "beta";
  created_at?: string;
};
export type ProfileValue = {
  profile: Profile | null;
  counters: { accounts: number; trades: number };
  hasPassword: boolean;
  googleLinked: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
  saveName: (displayName: string) => Promise<string | null>;
};

const Context = createContext<ProfileValue | null>(null);

/** Loads the signed-in user's profile once and shares it (sidebar, profile page, settings). */
export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [counters, setCounters] = useState({ accounts: 0, trades: 0 });
  const [hasPassword, setHasPassword] = useState(false);
  const [googleLinked, setGoogleLinked] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/profile", { credentials: "same-origin" });
      if (!response.ok) return;
      const data = await response.json() as { profile: Profile; counters: { accounts: number; trades: number }; hasPassword: boolean; googleLinked: boolean };
      setProfile(data.profile); setCounters(data.counters); setHasPassword(data.hasPassword); setGoogleLinked(data.googleLinked);
    } catch { /* offline: the UI falls back to placeholders */ }
  }, []);
  useEffect(() => { void refresh().finally(() => setLoading(false)); }, [refresh]);

  const saveName = useCallback(async (displayName: string): Promise<string | null> => {
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "same-origin",
        body: JSON.stringify({ displayName: displayName.trim() || null }),
      });
      const data = await response.json().catch(() => null) as { displayName?: string | null; error?: string } | null;
      if (!response.ok) return data?.error ?? "Could not save the name";
      setProfile(current => current ? { ...current, display_name: data?.displayName ?? null } : current);
      return null;
    } catch { return "No connection"; }
  }, []);

  const value = useMemo<ProfileValue>(() => ({ profile, counters, hasPassword, googleLinked, loading, refresh, saveName }),
    [profile, counters, hasPassword, googleLinked, loading, refresh, saveName]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useProfile(): ProfileValue {
  const context = useContext(Context);
  if (!context) throw new Error("useProfile must be used within ProfileProvider");
  return context;
}

/** Initial for the avatar circle when there is no photo. */
export function avatarInitial(profile: Profile | null): string {
  const source = profile?.display_name || profile?.email || "";
  const char = [...source.trim()][0];
  return char ? char.toUpperCase() : "·";
}
