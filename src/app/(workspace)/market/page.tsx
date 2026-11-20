"use client";

import { MarketTab } from "@/components/tabs/market-tab";
import { OwnerOnlySection } from "@/components/layout/owner-only-section";

export default function MarketPage() {
  return <OwnerOnlySection><MarketTab /></OwnerOnlySection>;
}
