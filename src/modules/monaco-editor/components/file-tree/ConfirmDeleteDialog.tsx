/**
 * @module ConfirmDeleteDialog
 *
 * Themed confirmation dialog before deleting a file or directory.
 */
import React from "react";
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
import { Trash2 } from "lucide-react";

export interface ConfirmDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Name of the item being deleted */
  name: string;
  /** Whether the target is a directory */
  isDirectory: boolean;
  /** Called when user confirms deletion */
  onConfirm: () => void;
}

export const ConfirmDeleteDialog = React.memo(function ConfirmDeleteDialog({
  open,
  onOpenChange,
  name,
  isDirectory,
  onConfirm,
}: ConfirmDeleteDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        className="sm:max-w-[400px]"
        style={{
          background: "var(--editor-sidebar-bg, #252526)",
          border: "1px solid var(--editor-border, #3c3c3c)",
          color: "var(--editor-fg, #cccccc)",
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-sm" style={{ color: "var(--editor-fg, #ddd)" }}>
            <Trash2 className="h-4 w-4 text-red-400" />
            Delete {isDirectory ? "Folder" : "File"}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-[12px]" style={{ color: "var(--editor-fg, #999)" }}>
            Are you sure you want to permanently delete{" "}
            <span className="font-semibold text-red-400">{name}</span>?
            {isDirectory && " This will remove the folder and all its contents."}
            {" "}This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            className="text-[12px]"
            style={{ color: "var(--editor-fg, #ccc)", borderColor: "var(--editor-border, #3c3c3c)" }}
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="text-[12px] bg-red-600 hover:bg-red-700 text-white"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
});
