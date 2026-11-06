"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { msg } from "@/lib/i18n/core";
import { DEFAULT_TIMEZONE, getBrowserTimeZone, isValidTimeZone } from "@/lib/timezone";

/**
 * The user's display time zone. Saved on the server (app_users.timezone);
 * until the user picks one, the browser's zone is used and nothing is written.
 */
type TimezoneContextValue = {
  timezone: string;
  /** true when the zone comes from the saved setting, false when it is the browser fallback. */
  saved: boolean;
  loading: boolean;
  saving: boolean;
  error: string | null;
  setTimezone: (timezone: string) => Promise<boolean>;
};
const Context = createContext<TimezoneContextValue | null>(null);

async function readError(response: Response) {
  try { const body = await response.json(); return typeof body?.error === "string" ? body.error : null; } catch { return null; }
}

export function TimezoneProvider({ children }: { children: ReactNode }) {
  // Same initial value on server and client to avoid hydration mismatches; the browser zone is applied after mount.
  const [timezone, setCurrent] = useState(DEFAULT_TIMEZONE);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    setCurrent(getBrowserTimeZone());
    (async () => {
      try {
        const response = await fetch("/api/preferences/timezone", { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error((await readError(response)) ?? msg("Could not load the time zone"));
        const body = await response.json();
        if (controller.signal.aborted || latest.current > 0) return;
        if (typeof body?.timezone === "string" && isValidTimeZone(body.timezone)) { setCurrent(body.timezone); setSaved(true); }
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : msg("Could not load the time zone"));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, []);

  const setTimezone = useCallback(async (value: string) => {
    if (!isValidTimeZone(value)) { setError(msg("Invalid time zone")); return false; }
    const request = ++latest.current;
    const previous = { timezone, saved };
    setCurrent(value); setSaving(true); setError(null);
    try {
      const response = await fetch("/api/preferences/timezone", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ timezone: value }) });
      if (!response.ok) throw new Error((await readError(response)) ?? msg("Could not save the time zone"));
      if (request === latest.current) setSaved(true);
      return true;
    } catch (cause) {
      if (request === latest.current) { setCurrent(previous.timezone); setSaved(previous.saved); setError(cause instanceof Error ? cause.message : msg("Could not save the time zone")); }
      return false;
    } finally {
      if (request === latest.current) setSaving(false);
    }
  }, [timezone, saved]);

  return <Context.Provider value={{ timezone, saved, loading, saving, error, setTimezone }}>{children}</Context.Provider>;
}

export function useTimezone() {
  const context = useContext(Context);
  if (!context) throw new Error("useTimezone requires TimezoneProvider");
  return context;
}
