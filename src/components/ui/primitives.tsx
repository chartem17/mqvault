"use client";

import { forwardRef, type ButtonHTMLAttributes, type HTMLAttributes, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";

const join = (...parts: (string | undefined | false)[]) => parts.filter(Boolean).join(" ");
const control = "w-full min-h-10 rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-destructive";
const variants = {
  primary: "border-transparent bg-primary text-primary-foreground hover:opacity-90",
  secondary: "border-border bg-secondary text-secondary-foreground hover:bg-accent",
  ghost: "border-transparent bg-transparent text-foreground hover:bg-accent",
  destructive: "border-transparent bg-destructive text-white hover:opacity-90",
};
const sizes = { sm: "min-h-8 px-3 text-xs", md: "min-h-10 px-4 text-sm", lg: "min-h-11 px-4 text-sm", icon: "h-10 w-10 p-0" };
export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof variants; size?: keyof typeof sizes; loading?: boolean };
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ variant = "primary", size = "md", loading = false, disabled, type = "button", className, children, ...props }, ref) {
  return <button {...props} ref={ref} type={type} disabled={disabled || loading} aria-busy={loading || undefined} className={join("inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-50 active:opacity-80", variants[variant], sizes[size], className)}>{children}</button>;
});
export const Panel = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(function Panel({ className, ...props }, ref) {
  return <div {...props} ref={ref} className={join("min-w-0 rounded-2xl border border-border bg-card text-card-foreground", className)} />;
});
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
  return <input {...props} ref={ref} className={join(control, className)} />;
});
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...props }, ref) {
  return <textarea {...props} ref={ref} className={join(control, "min-h-24 resize-y", className)} />;
});
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...props }, ref) {
  return <select {...props} ref={ref} className={join(control, "pr-8", className)}>{children}</select>;
});
