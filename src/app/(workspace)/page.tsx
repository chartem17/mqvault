"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { HomeTab } from "@/components/tabs/home-tab";
import { WorkspaceLoading } from "@/components/layout/workspace-loading";
import { usePreferences } from "@/components/providers/preferences-provider";
import { tabPath } from "@/lib/navigation/workspace-routes";

/** `/` is the start page: Home, or the section chosen in Settings → Start page. */
export default function StartPage() {
  const router = useRouter();
  const { preferences, ready } = usePreferences();
  const forward = ready && preferences.startTab !== "home";
  useEffect(() => { if (forward) router.replace(tabPath(preferences.startTab), { scroll: false }); }, [forward, preferences.startTab, router]);
  return ready && !forward ? <HomeTab /> : <WorkspaceLoading />;
}
