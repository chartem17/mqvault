"use client";
import { RiskSummary } from "@/components/ui/risk-summary";
import { WidgetPanel } from "./widget-panel";
import { useI18n } from "@/components/providers/i18n-provider";

export function RiskWidget() { const { t } = useI18n(); return <WidgetPanel title={t("Risk")} scroll><RiskSummary /></WidgetPanel>; }
