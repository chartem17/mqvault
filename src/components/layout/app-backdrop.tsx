"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

// The sign-in pages draw their own stage (owner's decision 2026-11-12: leave them as they are).
const AUTH_PATHS = ["/login", "/signup", "/forgot-password", "/reset-password"];
const SPOT_TARGET = '[class~="bg-card"], [class~="bg-panel"], [data-spot]';

/**
 * Ambient background of the app: slow drifting light, a fading grid and grain, plus a soft
 * spotlight that follows the pointer over cards. Pure decoration, hidden from assistive tech.
 */
export function AppBackdrop() {
  const pathname = usePathname();
  const auth = AUTH_PATHS.includes(pathname);

  useEffect(() => {
    if (auth || !window.matchMedia("(pointer: fine)").matches) return;
    let frame = 0, last: HTMLElement | null = null, event: PointerEvent | null = null;
    function paint() {
      frame = 0;
      if (!event) return;
      const target = (event.target as Element | null)?.closest?.(SPOT_TARGET) as HTMLElement | null;
      if (last && last !== target) last.removeAttribute("data-spotlit");
      last = target;
      if (!target) return;
      const box = target.getBoundingClientRect();
      target.style.setProperty("--spot-x", `${event.clientX - box.left}px`);
      target.style.setProperty("--spot-y", `${event.clientY - box.top}px`);
      target.setAttribute("data-spotlit", "");
    }
    function onMove(next: PointerEvent) { event = next; if (!frame) frame = requestAnimationFrame(paint); }
    function onLeave() { last?.removeAttribute("data-spotlit"); last = null; }
    document.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    return () => { cancelAnimationFrame(frame); document.removeEventListener("pointermove", onMove); document.documentElement.removeEventListener("pointerleave", onLeave); onLeave(); };
  }, [auth]);

  if (auth) return null;
  return <div className="mq-ambient" aria-hidden="true">
    <span className="mq-ambient-light mq-ambient-a" />
    <span className="mq-ambient-light mq-ambient-b" />
    <span className="mq-ambient-light mq-ambient-c" />
    <span className="mq-ambient-grid" />
    <span className="mq-ambient-grain" />
  </div>;
}
