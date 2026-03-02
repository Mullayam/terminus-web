/**
 * @module InlineTreeInput
 *
 * Tiny inline text input that appears inside the file tree for
 * "New File", "New Folder", and "Rename" operations.
 *
 * - Auto-focuses on mount
 * - Submits on Enter, cancels on Escape or blur
 * - Pre-selects the file name (without extension) for rename
 * - Styled to match the editor theme
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import FileIcon from "@/components/FileIcon";

export interface InlineTreeInputProps {
  /** Initial value (for rename, the current name) */
  defaultValue?: string;
  /** Whether this is for a directory (shows folder icon) */
  isDirectory?: boolean;
  /** Visual depth in the tree (for correct indentation) */
  depth: number;
  /** Called with the entered name on submit */
  onSubmit: (value: string) => void;
  /** Called when input is cancelled */
  onCancel: () => void;
  /** Placeholder text */
  placeholder?: string;
}

export const InlineTreeInput = React.memo(function InlineTreeInput({
  defaultValue = "",
  isDirectory = false,
  depth,
  onSubmit,
  onCancel,
  placeholder,
}: InlineTreeInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    // For rename: select the filename portion (before the last dot)
    if (defaultValue) {
      const dotIdx = defaultValue.lastIndexOf(".");
      if (dotIdx > 0 && !isDirectory) {
        el.setSelectionRange(0, dotIdx);
      } else {
        el.select();
      }
    }
  }, [defaultValue, isDirectory]);

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (trimmed && trimmed !== defaultValue) {
      onSubmit(trimmed);
    } else {
      onCancel();
    }
  }, [value, defaultValue, onSubmit, onCancel]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSubmit();
      } else if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
      // Stop propagation so tree doesn't react to key presses
      e.stopPropagation();
    },
    [handleSubmit, onCancel],
  );

  return (
    <div
      className="flex items-center gap-1 py-[2px] pr-2"
      style={{ paddingLeft: `${depth * 16 + 8}px` }}
    >
      <span className="w-3.5 shrink-0" />
      <FileIcon
        name={isDirectory ? "__folder__" : (value || "file")}
        isDirectory={isDirectory}
        isOpen={false}
        size={15}
      />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleSubmit}
        placeholder={placeholder}
        className="flex-1 bg-transparent text-[12px] outline-none border px-1 py-0.5 rounded-sm min-w-0"
        style={{
          color: "var(--editor-fg, #cccccc)",
          borderColor: "var(--editor-accent, #569cd6)",
          caretColor: "var(--editor-accent, #569cd6)",
        }}
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
});
