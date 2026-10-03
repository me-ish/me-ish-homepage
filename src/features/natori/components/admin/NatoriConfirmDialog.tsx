"use client";

import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { natoriAdminUi } from "@/features/natori/constants/adminUi";

type NatoriConfirmDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  tone?: "danger" | "primary";
  /** Adds an optional free-text field. Its value is passed to `onConfirm`. */
  withReason?: { label: string; placeholder?: string };
  /** Esc / backdrop click / "キャンセル". Equivalent to a cancelled window.confirm. */
  onCancel: () => void;
  /** Called with the reason text (empty string allowed) when `withReason` is set. */
  onConfirm: (reason: string) => void;
};

export function NatoriConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  tone = "primary",
  withReason,
  onCancel,
  onConfirm,
}: NatoriConfirmDialogProps) {
  const [reason, setReason] = useState("");
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) setReason("");
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent
        hideCloseButton
        className="max-w-md rounded-2xl p-5 shadow-xl"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          (tone === "danger" ? cancelRef : confirmRef).current?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle className={natoriAdminUi.sectionTitle}>{title}</DialogTitle>
          {description ? (
            <DialogDescription className={natoriAdminUi.body}>{description}</DialogDescription>
          ) : null}
        </DialogHeader>
        {withReason ? (
          <div>
            <label htmlFor="natori-confirm-reason" className={natoriAdminUi.label}>
              {withReason.label}
            </label>
            <textarea
              id="natori-confirm-reason"
              rows={3}
              value={reason}
              placeholder={withReason.placeholder}
              onChange={(event) => setReason(event.target.value)}
              className={natoriAdminUi.input}
            />
          </div>
        ) : null}
        <DialogFooter className="flex-row justify-end gap-2 sm:space-x-0">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className={natoriAdminUi.btnSecondary}
          >
            キャンセル
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={() => onConfirm(reason)}
            className={tone === "danger" ? natoriAdminUi.btnDangerSolid : natoriAdminUi.btnPrimary}
          >
            {confirmLabel}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
