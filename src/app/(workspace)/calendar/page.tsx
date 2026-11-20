"use client";

import { CalendarTab } from "@/components/tabs/calendar-tab";
import { OwnerOnlySection } from "@/components/layout/owner-only-section";

export default function CalendarPage() {
  return <OwnerOnlySection><CalendarTab /></OwnerOnlySection>;
}
