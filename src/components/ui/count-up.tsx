"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { countUpTarget, countUpText, easeOutCubic } from "@/lib/dashboard/count-up";

const DURATION_MS = 900;

/**
 * Shows a formatted number, counting up the first time a number appears. Later changes (new trades,
 * live updates) show at once, so values never jump back to zero. Respects reduced motion.
 */
export function CountUp({ text }: { text: string }) {
  const [shown, setShown] = useState(text);
  const played = useRef(false);
  useLayoutEffect(() => {
    const target = countUpTarget(text);
    if (played.current || !target || target.total === 0 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setShown(text); return; }
    played.current = true;
    const start = performance.now();
    let frame = requestAnimationFrame(function step(now) {
      const progress = easeOutCubic((now - start) / DURATION_MS);
      setShown(countUpText(target, progress));
      if (progress < 1) frame = requestAnimationFrame(step);
    });
    return () => { cancelAnimationFrame(frame); setShown(text); };
  }, [text]);
  return <>{shown}</>;
}
