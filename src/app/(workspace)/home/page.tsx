"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { HomeTab } from "@/components/tabs/home-tab";
import { WeeklyReportView } from "@/components/home/weekly-report";
import { WorkspaceLoading } from "@/components/layout/workspace-loading";

function HomeContent() {
  const search = useSearchParams();
  return search.get("report") === "week" ? <WeeklyReportView week={search.get("week")} /> : <HomeTab />;
}

export default function HomePage() {
  return <Suspense fallback={<WorkspaceLoading />}><HomeContent /></Suspense>;
}
