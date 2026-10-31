"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { DEFAULT_TIMEZONE, isValidTimeZone } from "@/lib/timezone";

const STORAGE_KEY = "vault.timezone";
const Context = createContext<{ timezone: string; setTimezone: (timezone: string) => void } | null>(null);
export function TimezoneProvider({ children }: { children: ReactNode }) {
  const [timezone, setCurrent] = useState(DEFAULT_TIMEZONE);
  useEffect(() => {
    try { const saved = window.localStorage.getItem(STORAGE_KEY); if (saved && isValidTimeZone(saved)) setCurrent(saved); } catch { /* Keep the default if storage is unavailable. */ }
    const onStorage = (event: StorageEvent) => { if (event.key === STORAGE_KEY) setCurrent(event.newValue && isValidTimeZone(event.newValue) ? event.newValue : DEFAULT_TIMEZONE); };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  const setTimezone = useCallback((value: string) => {
    if (!isValidTimeZone(value)) throw new Error("Invalid timezone");
    setCurrent(value);
    try { window.localStorage.setItem(STORAGE_KEY, value); } catch { /* The selection still works for this session. */ }
  }, []);
  return <Context.Provider value={{ timezone, setTimezone }}>{children}</Context.Provider>;
}
export function useTimezone() { const context = useContext(Context); if (!context) throw new Error("useTimezone requires TimezoneProvider"); return context; }
