"use client";

import { Children, Fragment, forwardRef, isValidElement, useMemo, type ButtonHTMLAttributes, type ChangeEvent, type HTMLAttributes, type InputHTMLAttributes, type MouseEvent, type ReactNode, type TextareaHTMLAttributes } from "react";

import { Button as UiButton } from "@ui-sdk/react/button";
import { Select as UiSelect, SelectContent as UiSelectContent, SelectEmpty as UiSelectEmpty, SelectGroup as UiSelectGroup, SelectGroupLabel as UiSelectGroupLabel, SelectInput as UiSelectInput, SelectItem as UiSelectItem, SelectItemIndicator as UiSelectItemIndicator, SelectItemText as UiSelectItemText, SelectList as UiSelectList, SelectTrigger as UiSelectTrigger, SelectValue as UiSelectValue } from "@ui-sdk/react/select";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { surfaceClass } from "./surface-styles";
const control = "w-full min-h-10 rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-destructive";
const variants = {
  primary: "btn-primary border-transparent text-primary-foreground",
  secondary: "btn-secondary text-secondary-foreground",
  ghost: "btn-ghost border-transparent bg-transparent text-foreground",
  destructive: "btn-destructive",
};
const sizes = { sm: "h-8 min-h-8 px-3 text-xs", md: "h-10 min-h-10 px-4 text-sm", lg: "h-11 min-h-11 px-5 text-sm", icon: "h-10 w-10 p-0" };
export type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> & { type?: "button" | "submit" | "reset"; variant?: keyof typeof variants; size?: keyof typeof sizes; loading?: boolean };
/** The app's button, on ui-sdk's Button: an async onClick keeps it pending (`data-pending`) until the promise settles. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ variant = "primary", size = "md", loading = false, disabled, type = "button", className, children, onClick, ...props }, ref) {
  // Returning the handler's result lets ui-sdk keep the button pending while an async click runs.
  const press = onClick ? (event: MouseEvent<HTMLElement>): unknown => (onClick as (event: MouseEvent<HTMLElement>) => unknown)(event) : undefined;
  return <UiButton {...props} onClick={press} ref={ref} type={type} disabled={disabled || loading} aria-busy={loading || undefined} data-loading={loading || undefined} className={cn("mq-btn inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border font-medium", variants[variant], sizes[size], className)}>{children}</UiButton>;
});
export const Panel = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(function Panel({ className, ...props }, ref) {
  return <div {...props} ref={ref} className={surfaceClass(className)} />;
});
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
  return <input {...props} ref={ref} className={cn(control, className)} />;
});
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...props }, ref) {
  return <textarea {...props} ref={ref} className={cn(control, "min-h-24 resize-y", className)} />;
});
type SelectOption = { value: string; label: string; disabled?: boolean };
type SelectEntry = SelectOption | { group: string; items: SelectOption[] };
// ui-sdk treats null as "nothing selected", so an empty <option value=""> gets a value of its own.
const EMPTY = "\u0000empty";
const toUi = (value: string) => value === "" ? EMPTY : value;
const fromUi = (value: string) => value === EMPTY ? "" : value;

function textOf(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) return textOf(node.props.children);
  return "";
}
function readOptions(children: ReactNode): SelectEntry[] {
  const entries: SelectEntry[] = [];
  Children.forEach(children, child => {
    if (!isValidElement<{ value?: string | number; label?: string; disabled?: boolean; children?: ReactNode }>(child)) return;
    if (child.type === Fragment) { entries.push(...readOptions(child.props.children)); return; }
    if (child.type === "optgroup") { entries.push({ group: child.props.label ?? "", items: readOptions(child.props.children).filter((entry): entry is SelectOption => "value" in entry) }); return; }
    if (child.type === "option") { const label = textOf(child.props.children); entries.push({ value: child.props.value != null ? String(child.props.value) : label, label, disabled: child.props.disabled }); }
  });
  return entries;
}
function SelectRow({ option }: { option: SelectOption }) {
  return <UiSelectItem value={toUi(option.value)} label={option.label} disabled={option.disabled} className="mq-select-item">
    <UiSelectItemText>{option.label}</UiSelectItemText>
    <UiSelectItemIndicator className="mq-select-check"><Check className="h-3.5 w-3.5" aria-hidden="true" /></UiSelectItemIndicator>
  </UiSelectItem>;
}

export type SelectProps = {
  value?: string; defaultValue?: string; children?: ReactNode; className?: string; id?: string; name?: string; disabled?: boolean; required?: boolean;
  "aria-label"?: string; "aria-labelledby"?: string; "aria-describedby"?: string; "aria-invalid"?: boolean | "true" | "false";
  /** Called like a native select's change: `event.target.value` is the chosen option's value. */
  onChange?: (event: ChangeEvent<HTMLSelectElement>) => void;
  /** A search field on top of the list, for long lists like time zones. */
  search?: { label: string; placeholder?: string; empty: string };
};
/**
 * The app's select on ui-sdk: written like a native one (`<option>`/`<optgroup>` children, `value`, `onChange`),
 * shown as a styled popup, and as a bottom sheet on touch phones.
 */
export const Select = forwardRef<HTMLButtonElement, SelectProps>(function Select({ value, defaultValue, onChange, children, className, id, name, disabled, required, search, ...aria }, ref) {
  const entries = useMemo(() => readOptions(children), [children]);
  const items = useMemo(() => entries.map(entry => "group" in entry ? { type: "group" as const, label: entry.group, items: entry.items.map(option => ({ value: toUi(option.value), label: option.label, disabled: option.disabled })) } : { value: toUi(entry.value), label: entry.label, disabled: entry.disabled }), [entries]);
  const rows = entries.map(entry => "group" in entry
    ? <UiSelectGroup key={`group:${entry.group}`} className="mq-select-group"><UiSelectGroupLabel className="mq-select-group-label">{entry.group}</UiSelectGroupLabel>{entry.items.map(option => <SelectRow key={option.value} option={option} />)}</UiSelectGroup>
    : <SelectRow key={entry.value} option={entry} />);
  const labels = useMemo(() => new Map(entries.flatMap(entry => "group" in entry ? entry.items : [entry]).map(option => [toUi(option.value), option.label])), [entries]);
  // With a search field the rendered rows are the list (ui-sdk filters them); data items would bypass the filter.
  return <UiSelect
    items={search ? undefined : items}
    itemToLabel={(next: unknown) => labels.get(String(next)) ?? String(next)}
    value={value === undefined ? undefined : toUi(value)}
    defaultValue={defaultValue === undefined ? undefined : toUi(defaultValue)}
    onValueChange={next => { if (typeof next === "string") onChange?.({ target: { value: fromUi(next), name }, currentTarget: { value: fromUi(next), name } } as unknown as ChangeEvent<HTMLSelectElement>); }}
    name={name} disabled={disabled} required={required} presentation="auto" loop>
    <UiSelectTrigger ref={ref} id={id} {...aria} className={cn(control, "mq-select-trigger flex items-center justify-between gap-2 text-left", className)}>
      <UiSelectValue className="min-w-0 truncate" />
      <ChevronDown className="mq-select-chevron h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </UiSelectTrigger>
    <UiSelectContent sideOffset={6} collisionPadding={10} className="mq-popup mq-select-content">
      {search ? <>
        <UiSelectInput aria-label={search.label} placeholder={search.placeholder ?? search.label} className="mq-select-search" />
        <UiSelectEmpty className="mq-select-empty">{search.empty}</UiSelectEmpty>
        <UiSelectList className="mq-select-list">{rows}</UiSelectList>
      </> : rows}
    </UiSelectContent>
  </UiSelect>;
});
