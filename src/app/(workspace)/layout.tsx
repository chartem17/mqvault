"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import AppShellLayout from "@/components/layout/app-shell-layout";
import { tabFromPath } from "@/lib/navigation/workspace-routes";

/** Every workspace section shares one shell, so the sidebar and header stay mounted while the address changes. */
export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return <AppShellLayout activeTab={tabFromPath(pathname)} pageKey={pathname}>{children}</AppShellLayout>;
}
