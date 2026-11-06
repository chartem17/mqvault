"use client";
import { RiskSummary } from "@/components/ui/risk-summary";
import { WidgetPanel } from "./widget-panel";

export function RiskWidget() { return <WidgetPanel title="Risk" scroll><RiskSummary /></WidgetPanel>; }
