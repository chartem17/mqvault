import { cn } from "@/lib/utils";
import { surfaceClass } from "./surface-styles";
import "./dialog.css";

export const DIALOG_SURFACE = surfaceClass("text-foreground shadow-[var(--dialog-shadow)]");
export const DIALOG_BACKDROP = "bg-[var(--dialog-backdrop)] backdrop-blur-sm";
export const DIALOG_NATIVE_BACKDROP = "backdrop:bg-[var(--dialog-backdrop)] backdrop:backdrop-blur-sm";
export function dialogSurface(layout: string, native = false) {
  return cn(DIALOG_SURFACE, native && DIALOG_NATIVE_BACKDROP, layout);
}
