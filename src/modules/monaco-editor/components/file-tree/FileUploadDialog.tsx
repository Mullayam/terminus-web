/**
 * @module FileUploadDialog
 *
 * Reusable file / folder upload component for the editor file tree.
 * Opens a hidden file-input, lets the user pick files (or a folder),
 * then uploads via `ApiCore.uploadFile`.
 *
 * Two modes controlled by the `mode` prop:
 *   "file"   — single / multi file picker
 *   "folder" — folder picker (webkitdirectory)
 *
 * Displays progress via the `uploading` / `error` state.
 * Styled to match the editor theme via CSS variables.
 */
import React, { useCallback, useRef, useState } from "react";
import { ApiCore } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Upload, UploadCloud, CheckCircle2, XCircle } from "lucide-react";

export interface FileUploadDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Close handler */
  onOpenChange: (open: boolean) => void;
  /** "file" for single/multi file upload, "folder" for directory upload */
  mode: "file" | "folder";
  /** Remote directory to upload into */
  targetDir: string;
  /** Called after successful upload so the tree can refresh */
  onUploadComplete?: (targetDir: string) => void;
}

type UploadStatus = "idle" | "uploading" | "success" | "error";

export const FileUploadDialog = React.memo(function FileUploadDialog({
  open,
  onOpenChange,
  mode,
  targetDir,
  onUploadComplete,
}: FileUploadDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setSelectedFiles([]);
    setStatus("idle");
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) reset();
      onOpenChange(next);
    },
    [onOpenChange, reset],
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;
      setSelectedFiles(Array.from(files));
      setStatus("idle");
      setError(null);
    },
    [],
  );

  const handleUpload = useCallback(async () => {
    if (selectedFiles.length === 0) return;
    setStatus("uploading");
    setError(null);
    try {
      // Annotate files with webkitRelativePath for folder uploads
      const annotated = selectedFiles.map((f) => {
        const extended = f as File & { path?: string };
        extended.path = (f as any).webkitRelativePath || f.name;
        return extended;
      });

      await ApiCore.uploadFile(annotated, targetDir);
      setStatus("success");
      onUploadComplete?.(targetDir);
      // Auto-close after short delay
      setTimeout(() => handleOpenChange(false), 800);
    } catch (err: any) {
      setStatus("error");
      setError(err?.message ?? "Upload failed");
    }
  }, [selectedFiles, targetDir, onUploadComplete, handleOpenChange]);

  const triggerPicker = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const Icon = mode === "folder" ? UploadCloud : Upload;
  const title = mode === "folder" ? "Upload Folder" : "Upload File";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="sm:max-w-[440px]"
        style={{
          background: "var(--editor-sidebar-bg, #252526)",
          border: "1px solid var(--editor-border, #3c3c3c)",
          color: "var(--editor-fg, #cccccc)",
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm" style={{ color: "var(--editor-fg, #cccccc)" }}>
            <Icon className="h-4 w-4 text-blue-400" />
            {title}
          </DialogTitle>
          <DialogDescription className="text-[11px]" style={{ color: "var(--editor-fg, #999)" }}>
            Upload to <code className="text-blue-400">{targetDir}</code>
          </DialogDescription>
        </DialogHeader>

        {/* Hidden file input */}
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          multiple={mode === "file"}
          {...(mode === "folder"
            ? { webkitdirectory: "", directory: "" } as any
            : {})}
          onChange={handleFileChange}
        />

        <div className="space-y-3 py-2">
          {/* Drop zone / picker */}
          <button
            type="button"
            onClick={triggerPicker}
            className="w-full flex flex-col items-center gap-2 border-2 border-dashed rounded-lg p-6 transition-colors"
            style={{
              borderColor: "var(--editor-border, #3c3c3c)",
              color: "var(--editor-fg, #999)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "var(--editor-accent, #569cd6)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--editor-border, #3c3c3c)";
            }}
          >
            <Icon className="h-8 w-8 opacity-50" />
            <span className="text-[12px]">
              Click to select {mode === "folder" ? "a folder" : "file(s)"}
            </span>
          </button>

          {/* Selected files list */}
          {selectedFiles.length > 0 && (
            <div
              className="max-h-32 overflow-auto rounded-md p-2 text-[11px] space-y-0.5"
              style={{ background: "var(--editor-bg, #1e1e1e)" }}
            >
              {selectedFiles.slice(0, 20).map((f, i) => (
                <div key={i} className="truncate opacity-80">
                  {(f as any).webkitRelativePath || f.name}
                </div>
              ))}
              {selectedFiles.length > 20 && (
                <div className="text-blue-400">
                  …and {selectedFiles.length - 20} more
                </div>
              )}
            </div>
          )}

          {/* Status messages */}
          {status === "success" && (
            <div className="flex items-center gap-2 text-green-400 text-[12px]">
              <CheckCircle2 className="h-4 w-4" />
              Upload completed successfully!
            </div>
          )}
          {status === "error" && error && (
            <div className="flex items-center gap-2 text-red-400 text-[12px]">
              <XCircle className="h-4 w-4" />
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleOpenChange(false)}
            className="text-[12px]"
            style={{ color: "var(--editor-fg, #ccc)" }}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleUpload}
            disabled={selectedFiles.length === 0 || status === "uploading"}
            className="text-[12px] bg-blue-600 hover:bg-blue-700 text-white"
          >
            {status === "uploading" ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                Uploading…
              </>
            ) : (
              <>
                <Upload className="h-3.5 w-3.5 mr-1.5" />
                Upload
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});
