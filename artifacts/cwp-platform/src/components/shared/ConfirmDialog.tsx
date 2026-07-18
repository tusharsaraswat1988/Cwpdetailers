import { ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  /** Renders the confirm button as destructive (red) — use for delete/remove/cancel actions. */
  destructive?: boolean;
  isConfirming?: boolean;
}

/**
 * The one confirmation dialog for the admin panel. Replaces window.confirm()
 * everywhere — themed, keyboard-trapped, and screen-reader friendly via the
 * Radix AlertDialog primitive. Use for any "are you sure?" action.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  destructive,
  isConfirming,
}: ConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent data-testid="confirm-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel data-testid="confirm-dialog-cancel">{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={isConfirming}
            className={destructive ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : undefined}
            data-testid="confirm-dialog-confirm"
          >
            {isConfirming ? "Please wait…" : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Convenience wrapper for the most common case — deleting/removing a record. */
export function DeleteDialog(props: Omit<ConfirmDialogProps, "destructive" | "confirmLabel"> & { confirmLabel?: string }) {
  return <ConfirmDialog {...props} destructive confirmLabel={props.confirmLabel ?? "Delete"} />;
}

export default ConfirmDialog;
