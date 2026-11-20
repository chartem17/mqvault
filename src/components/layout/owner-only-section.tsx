"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "@/hooks/use-current-user";
import { WorkspaceLoading } from "@/components/layout/workspace-loading";
import { tabPath } from "@/lib/navigation/workspace-routes";

/** Closed beta (ADR 0017): Market and Calendar stay with the installation owner; everybody else lands on Home. */
export function OwnerOnlySection({ children }: { children: ReactNode }) {
  const router = useRouter();
  const user = useCurrentUser();
  const denied = user !== null && !user.isOwner;
  useEffect(() => { if (denied) router.replace(tabPath("home")); }, [denied, router]);
  return user?.isOwner ? <>{children}</> : <WorkspaceLoading />;
}
