"use client";
import { Check, Pencil, RotateCcw, X } from "lucide-react";

const BUTTON = "inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary";

export function DashboardToolbar({ editing, dirty, saving, error, conflict, onEdit, onReset, onCancel, onSave, onReload }: { editing: boolean; dirty: boolean; saving: boolean; error: string | null; conflict: boolean; onEdit: () => void; onReset: () => void; onCancel: () => void; onSave: () => void; onReload: () => void }) {
  return <div className="flex flex-wrap items-center justify-end gap-2">
    {error && <span role="alert" className="mr-auto text-sm text-red-500">{error}{conflict && <button type="button" onClick={onReload} className="ml-2 underline">Завантажити актуальну</button>}</span>}
    {!editing ? <button type="button" onClick={onEdit} className={BUTTON}><Pencil className="size-4" aria-hidden />Редагувати</button> : <>
      <button type="button" onClick={onReset} className={BUTTON}><RotateCcw className="size-4" aria-hidden />Скинути</button>
      <button type="button" onClick={onCancel} className={BUTTON}><X className="size-4" aria-hidden />Скасувати</button>
      <button type="button" onClick={onSave} disabled={!dirty || saving || conflict} className={`${BUTTON} border-primary bg-primary text-primary-foreground hover:bg-primary/90`}><Check className="size-4" aria-hidden />{saving ? "Зберігаю…" : "Зберегти розкладку"}</button></>}
  </div>;
}
