"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { DEFAULT_TIMEZONE, isValidTimeZone } from "@/lib/timezone";

type Ctx = { timezone: string; setTimezone: (tz: string) => Promise<void> };
const TimezoneContext = createContext<Ctx>({
  timezone: DEFAULT_TIMEZONE,
  setTimezone: async () => {},
});

export function TimezoneProvider({
  initialTimezone,
  children,
}: {
  initialTimezone: string;
  children: React.ReactNode;
}) {
  const [timezone, setTz] = useState(initialTimezone);

  const setTimezone = useCallback(
    async (next: string) => {
      if (!isValidTimeZone(next)) return;
      const prev = timezone;
      setTz(next);
      const res = await fetch("/api/profile/timezone", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timezone: next }),
      });
      if (!res.ok) setTz(prev);
    },
    [timezone],
  );

  return (
    <TimezoneContext.Provider value={{ timezone, setTimezone }}>
      {children}
    </TimezoneContext.Provider>
  );
}

export const useTimezone = () => useContext(TimezoneContext);
