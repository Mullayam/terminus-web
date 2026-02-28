/**
 * @module monaco-editor/chat/components/DiffPreview
 *
 * Inline diff preview for AI-suggested code changes.
 * Shows a Monaco diff editor with the original file content vs
 * the AI's suggested modification. Users can Accept or Reject.
 */

import React, { useCallback, useMemo } from "react";
import { Check, X, ArrowLeftRight } from "lucide-react";
import { MonacoDiffEditor } from "../../MonacoDiffEditor";

/* ── Props ─────────────────────────────────────────────────── */

export interface DiffPreviewProps {
  /** Original file content (before AI change) */
  original: string;
  /** Modified content (AI suggestion) */
  modified: string;
  /** Language for syntax highlighting */
  language: string;
  /** Filename (for display) */
  filename?: string;
  /** Height of the diff editor */
  height?: string | number;
  /** Called when user accepts the change */
  onAccept: (modifiedContent: string) => void;
  /** Called when user rejects the change */
  onReject: () => void;
  /** Side by side or inline diff */
  sideBySide?: boolean;
}

/* ── Component ─────────────────────────────────────────────── */

export const DiffPreview: React.FC<DiffPreviewProps> = ({
  original,
  modified,
  language,
  filename,
  height = 300,
  onAccept,
  onReject,
  sideBySide = false,
}) => {
  const handleAccept = useCallback(() => {
    onAccept(modified);
  }, [modified, onAccept]);

  const changeStats = useMemo(() => {
    const origLines = original.split("\n");
    const modLines = modified.split("\n");
    const added = modLines.filter((l, i) => origLines[i] !== l).length;
    const removed = origLines.filter((l, i) => modLines[i] !== l).length;
    return { added, removed };
  }, [original, modified]);

  return (
    <div className="rounded-md border border-[#3c3c3c] overflow-hidden my-2">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#2d2d2d] border-b border-[#3c3c3c]">
        <div className="flex items-center gap-2">
          <ArrowLeftRight className="w-3.5 h-3.5 text-gray-500" />
          <span className="text-[11px] text-gray-400 font-medium">
            {filename ? `Changes to ${filename}` : "Suggested changes"}
          </span>
          <span className="text-[10px] text-green-400">+{changeStats.added}</span>
          <span className="text-[10px] text-red-400">-{changeStats.removed}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleAccept}
            className="flex items-center gap-1 px-2 py-0.5 text-[11px] rounded bg-[#007acc] text-white hover:bg-[#0098ff] transition-colors"
            title="Accept changes"
          >
            <Check className="w-3 h-3" />
            Accept
          </button>
          <button
            onClick={onReject}
            className="flex items-center gap-1 px-2 py-0.5 text-[11px] rounded bg-transparent text-gray-500 hover:text-gray-300 hover:bg-[#404040] transition-colors border border-[#3c3c3c]"
            title="Reject changes"
          >
            <X className="w-3 h-3" />
            Reject
          </button>
        </div>
      </div>

      {/* Diff Editor */}
      <div style={{ height: typeof height === "number" ? `${height}px` : height }}>
        <MonacoDiffEditor
          original={original}
          modified={modified}
          language={language}
          height="100%"
          renderSideBySide={sideBySide}
          options={{
            readOnly: true,
            fontSize: 12,
            lineNumbers: "on",
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            renderOverviewRuler: false,
          }}
        />
      </div>
    </div>
  );
};

DiffPreview.displayName = "DiffPreview";
