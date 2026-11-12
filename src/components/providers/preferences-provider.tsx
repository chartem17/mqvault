"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { DEFAULT_PREFERENCES, mergePreferences, sanitizePreferences, type UserPreferences } from "@/lib/preferences/user-preferences";
import { setDisplayOptions } from "@/lib/journal/number-format";

const CACHE_KEY = "mq_prefs";
type Value = { preferences: UserPreferences; ready: boolean; update: (patch: Partial<UserPreferences>) => void };
const Context = createContext<Value | null>(null);

function readCache(): UserPreferences {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    // The start page used to live under its own key (first version of Settings → Start page).
    const legacyStart = localStorage.getItem("mq_start_tab");
    return sanitizePreferences({ ...(legacyStart ? { startTab: legacyStart } : {}), ...(raw ? JSON.parse(raw) : {}) });
  } catch { return DEFAULT_PREFERENCES; }
}
function writeCache(value: UserPreferences) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(value)); } catch { /* storage may be blocked */ }
}

/**
 * Settings of the signed-in user: the browser copy answers at once, the server copy (same on every device)
 * replaces it when it arrives. Until the preferences migration is applied the server answers `stored: false`
 * and the browser copy is the only one.
 */
export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [ready, setReady] = useState(false);
  const stored = useRef(false);
  const latest = useRef(preferences);
  latest.current = preferences;

  useEffect(() => {
    const cached = readCache();
    setPreferences(cached);
    fetch("/api/preferences/app", { credentials: "same-origin", cache: "no-store" })
      .then(response => response.ok ? response.json() : null)
      .then((data: { preferences: unknown; stored: boolean } | null) => {
        if (!data) return;
        stored.current = data.stored;
        if (data.stored && data.preferences) {
          // First sync after the migration: settings chosen on this device before it are kept.
          const server = sanitizePreferences(data.preferences);
          const empty = JSON.stringify(server) === JSON.stringify(DEFAULT_PREFERENCES);
          const value = empty ? cached : server;
          setPreferences(value); writeCache(value);
          if (empty && JSON.stringify(cached) !== JSON.stringify(DEFAULT_PREFERENCES)) void save(cached);
        }
      })
      .catch(() => { /* offline: the browser copy stays */ })
      .finally(() => setReady(true));
  }, []);

  const update = useCallback((patch: Partial<UserPreferences>) => {
    const next = mergePreferences(latest.current, patch);
    setPreferences(next); writeCache(next);
    if (stored.current) void save(patch);
  }, []);
  // Number format and privacy are read by the formatting helpers during render, so they are set before children render.
  setDisplayOptions({ numberFormat: preferences.numberFormat, privacy: preferences.privacy });
  const value = useMemo(() => ({ preferences, ready, update }), [preferences, ready, update]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

async function save(patch: Partial<UserPreferences>) {
  try {
    await fetch("/api/preferences/app", { method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify(patch) });
  } catch { /* the browser copy keeps the change; it is sent again with the next one */ }
}

export function usePreferences(): Value {
  const context = useContext(Context);
  if (!context) throw new Error("usePreferences must be used within PreferencesProvider");
  return context;
}
