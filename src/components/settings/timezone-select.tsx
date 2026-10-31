"use client";

import { useId, useMemo, useState } from "react";
import {
  getBrowserTimeZone,
  getOffsetLabel,
  getTimeZoneList,
} from "@/lib/timezone";
import { useTimezone } from "@/components/providers/timezone-provider";
import { Button, Input, Select } from "@/components/ui/primitives";

export function TimezoneSelect() {
  const { timezone, setTimezone } = useTimezone();
  const [query, setQuery] = useState("");
  const id = useId();

  const options = useMemo(() => {
    const q = query.trim().toLowerCase();
    return getTimeZoneList()
      .filter((tz) => !q || tz.toLowerCase().replace(/_/g, " ").includes(q))
      .map((tz) => ({ tz, offset: getOffsetLabel(tz) }));
  }, [query]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label htmlFor={`${id}-zone`} className="text-sm font-medium text-foreground">
          Часовий пояс
        </label>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setTimezone(getBrowserTimeZone())}
        >
          Визначити автоматично ({getBrowserTimeZone()})
        </Button>
      </div>

      <Input
        aria-label="Пошук часового поясу"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Пошук: Kyiv, Warsaw, New York…"
      />

      <Select
        id={`${id}-zone`}
        size={8}
        value={timezone}
        onChange={(e) => setTimezone(e.target.value)}
      >
        {options.map(({ tz, offset }) => (
          <option key={tz} value={tz}>
            {tz.replace(/_/g, " ")} ({offset})
          </option>
        ))}
      </Select>
    </div>
  );
}
