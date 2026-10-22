"use client";

import { useMemo, useState } from "react";
import {
  getBrowserTimeZone,
  getOffsetLabel,
  getTimeZoneList,
} from "@/lib/timezone";
import { useTimezone } from "@/components/providers/timezone-provider";

export function TimezoneSelect() {
  const { timezone, setTimezone } = useTimezone();
  const [query, setQuery] = useState("");

  const options = useMemo(() => {
    const q = query.trim().toLowerCase();
    return getTimeZoneList()
      .filter((tz) => !q || tz.toLowerCase().replace(/_/g, " ").includes(q))
      .map((tz) => ({ tz, offset: getOffsetLabel(tz) }));
  }, [query]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-zinc-200">
          Часовий пояс
        </label>
        <button
          type="button"
          onClick={() => setTimezone(getBrowserTimeZone())}
          className="text-sm text-blue-300 hover:underline"
        >
          Визначити автоматично ({getBrowserTimeZone()})
        </button>
      </div>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Пошук: Kyiv, Warsaw, New York…"
        className="w-full rounded-xl border border-white/10 bg-[#0d0f12] px-3 py-2 text-sm text-zinc-100 outline-none"
      />

      <select
        size={8}
        value={timezone}
        onChange={(e) => setTimezone(e.target.value)}
        className="w-full rounded-xl border border-white/10 bg-[#0d0f12] p-1 text-sm text-zinc-100"
      >
        {options.map(({ tz, offset }) => (
          <option key={tz} value={tz}>
            {tz.replace(/_/g, " ")} ({offset})
          </option>
        ))}
      </select>
    </div>
  );
}
