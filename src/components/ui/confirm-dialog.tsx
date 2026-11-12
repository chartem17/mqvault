"use client";

import { AlertDialog, AlertDialogBackdrop, AlertDialogClose, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from "@ui-sdk/react/alert-dialog";
import { TriangleAlert } from "lucide-react";
import { useI18n } from "@/components/providers/i18n-provider";
import "./dialog.css";

const ANSWER = "mq-btn inline-flex h-11 min-h-11 items-center justify-center rounded-xl border px-5 text-sm font-medium";

/** Asks before deleting. Escape, an outside press and Cancel all count as "no". */
export function ConfirmDialog({ open, title, description, onConfirm, onCancel }: { open: boolean; title: string; description: string; onConfirm: () => void; onCancel: () => void }) {
  const { t } = useI18n();
  return <AlertDialog open={open} onOpenChange={(next, details) => { if (next) return; if (details.returnValue === "confirm") onConfirm(); else onCancel(); }}>
    <AlertDialogBackdrop className="mq-backdrop" />
    <AlertDialogContent className="mq-dialog mq-confirm">
      <div className="flex items-start gap-4">
        <span className="mq-confirm-icon" aria-hidden="true"><TriangleAlert className="h-5 w-5" /></span>
        <div className="min-w-0">
          <AlertDialogTitle className="text-lg font-semibold leading-snug">{title}</AlertDialogTitle>
          <AlertDialogDescription className="mt-2 text-sm leading-6 text-muted-foreground">{description}</AlertDialogDescription>
        </div>
      </div>
      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <AlertDialogClose className={`${ANSWER} btn-secondary text-secondary-foreground`}>{t("Cancel")}</AlertDialogClose>
        <AlertDialogClose value="confirm" data-agent-confirm={description} className={`${ANSWER} btn-destructive`}>{t("Delete")}</AlertDialogClose>
      </div>
    </AlertDialogContent>
  </AlertDialog>;
}
