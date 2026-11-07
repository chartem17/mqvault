import type { ReactNode } from "react";
import { SectionHeading } from "./card-content";

export function SectionHeader({ title, sub, actions }: { title: string; sub?: string; actions?: ReactNode }) {
  return <SectionHeading title={title} sub={sub} actions={actions} />;
}
