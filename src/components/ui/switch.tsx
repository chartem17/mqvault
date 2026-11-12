"use client"

import * as React from "react"
import { Switch as AriaSwitch, type SwitchProps } from "react-aria-components"
import { cn } from "@/lib/utils"

type Props = Omit<SwitchProps, "className" | "children"> & {
  className?: string
  /** Visible label next to the track. */
  children?: React.ReactNode
  size?: "sm" | "default"
}

/** On/off control (owner's design, react-aria): keyboard, focus ring and screen readers handled by react-aria. */
function Switch({ className, size = "default", children, ...props }: Props) {
  return (
    <AriaSwitch
      // Not "switch": ui-sdk's web.css styles that slot as its own switch on top of this one.
      data-slot="app-switch"
      data-size={size}
      className={cn(
        "group inline-flex items-center gap-2 text-sm outline-none",
        "data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50",
        className
      )}
      {...props}
    >
      <span
        className={cn(
          "inline-flex h-[1.15rem] w-8 shrink-0 items-center rounded-full border border-transparent bg-input shadow-xs transition-colors",
          "group-data-[selected]:bg-primary",
          "group-data-[focus-visible]:border-ring group-data-[focus-visible]:ring-[3px] group-data-[focus-visible]:ring-ring/50",
          "group-data-[size=sm]:h-3.5 group-data-[size=sm]:w-6"
        )}
      >
        <span
          className={cn(
            "pointer-events-none block size-4 rounded-full bg-background transition-transform",
            "group-data-[selected]:translate-x-[calc(100%-2px)]",
            "group-data-[size=sm]:size-3"
          )}
        />
      </span>
      {children}
    </AriaSwitch>
  )
}

export { Switch }
