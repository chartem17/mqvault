"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import DotField from "@/components/kokonutui/dot-field";
import { cn } from "@/lib/utils";

// The sign-in pages draw their own stage (owner's decision 2026-11-12); the field stays mounted but empty there.
const AUTH_PATHS = ["/login", "/signup", "/forgot-password", "/reset-password"];

/**
 * Living dot field behind the app (replaces the static square grid of the ambient background).
 * The component file is used as-is (Kokonut UI) and styled only from here:
 * - the page is its child, because the field listens to pointer events on its own root;
 * - its dot layer is pinned to the viewport (`fixed`), so the canvas is screen-sized, not page-sized;
 * - the root stays a plain transparent block (no flex, no clipping), so sticky headers keep working;
 * - dot colour = the root's text colour (a token); the page gets `text-foreground` back.
 */
export function AppDotField({ children }: { children: ReactNode }) {
  const auth = AUTH_PATHS.includes(usePathname());
  return <DotField
    spacing={18}
    interactive={!auth}
    className={cn(
      "block min-h-dvh overflow-visible bg-transparent text-primary/30 dark:bg-transparent dark:text-primary/30",
      "[&>div[aria-hidden=true]]:fixed [&>div[aria-hidden=true]]:inset-0",
      auth && "[&>div[aria-hidden=true]]:hidden",
    )}
  >
    <div className="relative min-h-dvh text-foreground">{children}</div>
  </DotField>;
}
