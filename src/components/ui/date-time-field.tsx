"use client";

import { forwardRef, type InputHTMLAttributes } from "react";
import { Input } from "./primitives";

export type DateTimeFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  type?: "date" | "time" | "datetime-local";
};

export const DateTimeField = forwardRef<HTMLInputElement, DateTimeFieldProps>(function DateTimeField({ type = "date", className, ...props }, ref) {
  return <Input {...props} ref={ref} type={type} className={className} />;
});
