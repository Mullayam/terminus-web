/**
 * @module MoveToDialog
 *
 * Dialog that asks the user for a destination path when moving a file/folder.
 * Styled to match the editor theme.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FolderInput } from "lucide-react";

export interface MoveToDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Current full path of the item */
  sourcePath: string;
  /** Name of the item */
  name: string;
  /** Called with the new full destination path */
  onConfirm: (destinationPath: string) => void;
}

export const MoveToDialog = React.memo(function MoveToDialog({
  open,
  onOpenChange,
  sourcePath,
  name,
  onConfirm,
}: MoveToDialogProps) {
  const parentDir = sourcePath.substring(0, sourcePath.lastIndexOf("/")) || "/";
  const [destDir, setDestDir] = useState(parentDir);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setDestDir(parentDir);
      setTimeout(() => inputRef.current?.select(), 50);
    }
  }, [open, parentDir]);

  const handleSubmit = useCallback(() => {
    const trimmed = destDir.trim();
    if (!trimmed) return;
    const fullDest = trimmed.endsWith("/")
      ? `${trimmed}${name}`
      : `${trimmed}/${name}`;
    if (fullDest !== sourcePath) {
      onConfirm(fullDest);
    }
    onOpenChange(false);
  }, [destDir, name, sourcePath, onConfirm, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[440px]"
        style={{
          background: "var(--editor-sidebar-bg, #252526)",
          border: "1px solid var(--editor-border, #3c3c3c)",
          color: "var(--editor-fg, #cccccc)",
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm" style={{ color: "var(--editor-fg, #ddd)" }}>
            <FolderInput className="h-4 w-4 text-blue-400" />
            Move "{name}"
          </DialogTitle>
          <DialogDescription className="text-[11px]" style={{ color: "var(--editor-fg, #999)" }}>
            Enter the destination directory path.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2">
          <label className="text-[11px] mb-1 block" style={{ color: "var(--editor-fg, #aaa)" }}>
            Destination directory
          </label>
          <input
            ref={inputRef}
            value={destDir}
            onChange={(e) => setDestDir(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSubmit();
              }
            }}
            className="w-full px-2 py-1.5 rounded-md text-[12px] outline-none border"
            style={{
              background: "var(--editor-bg, #1e1e1e)",
              color: "var(--editor-fg, #cccccc)",
              borderColor: "var(--editor-border, #3c3c3c)",
            }}
            placeholder="/destination/path"
          />
          <p className="text-[10px] mt-1 opacity-50">
            Current: {sourcePath}
          </p>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-[12px]"
            style={{ color: "var(--editor-fg, #ccc)" }}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            className="text-[12px] bg-blue-600 hover:bg-blue-700 text-white"
          >
            Move
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});
