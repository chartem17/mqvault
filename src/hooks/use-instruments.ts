"use client";

import { useEffect, useState } from "react";
import { FALLBACK_INSTRUMENTS, type Instrument } from "@/lib/instruments";

let cache: Instrument[] | null = null;

export function useInstruments() {
  const [instruments, setInstruments] = useState<Instrument[]>(
    cache ?? FALLBACK_INSTRUMENTS,
  );
  const [fromDb, setFromDb] = useState(cache !== null);

  useEffect(() => {
    if (cache) return;
    let cancelled = false;

    fetch("/api/instruments")
      .then((res) =>
        res.ok ? res.json() : Promise.reject(new Error(String(res.status))),
      )
      .then((json: { instruments?: Instrument[] }) => {
        if (cancelled || !Array.isArray(json.instruments) || !json.instruments.length) return;
        cache = json.instruments;
        setInstruments(json.instruments);
        setFromDb(true);
      })
      .catch(() => {
        /* залишаємо резервний список */
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { instruments, fromDb };
}
