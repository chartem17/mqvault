"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Renders a full-screen overlay straight into <body>.
 *
 * A `position: fixed` overlay is only pinned to the viewport while no ancestor has
 * `transform`, `filter`, `backdrop-filter`, `contain` or `will-change`; any of those
 * turns the ancestor into the containing block, and the dialog then opens somewhere
 * in the middle of the page instead of on screen. Portalling sidesteps the whole class.
 * While mounted it also stops the page behind from scrolling.
 */
export function ModalPortal({ children }: { children: ReactNode }) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setHost(document.body);
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = overflow; };
  }, []);
  return host ? createPortal(children, host) : null;
}
