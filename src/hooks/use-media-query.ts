"use client";
import { useSyncExternalStore } from "react";

/** True while the media query matches. Server render and first paint assume `false` (desktop). */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    notify => { const list = window.matchMedia(query); list.addEventListener("change", notify); return () => list.removeEventListener("change", notify); },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

export const PHONE_QUERY = "(max-width: 767.98px)";
