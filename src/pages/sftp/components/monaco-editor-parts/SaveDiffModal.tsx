import React, { useState } from "react";
import { X, Save, GitCompare } from "lucide-react";
import { MonacoDiffEditor } from "@/modules/monaco-editor";

interface SaveDiffModalProps {
  fileName: string;
  /** Current content on the remote (diff base). */
  original: string;
  /** The content about to be written. */
  modified: string;
  language: string;
  theme: string;
  saving?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  /** Disable the diff prompt for the rest of the session. */
  onDisableForSession: () => void;
}

/**
 * Shows a side-by-side Monaco diff of the current remote file vs. the pending
 * edit and asks the user to confirm before writing over SFTP.
 */
const SaveDiffModal: React.FC<SaveDiffModalProps> = ({
  fileName,
  original,
  modified,
  language,
  theme,
  saving = false,
  onConfirm,
  onCancel,
  onDisableForSession,
}) => {
  const [dontAsk, setDontAsk] = useState(false);

  const confirm = () => {
    if (dontAsk) onDisableForSession();
    onConfirm();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="flex h-[80vh] w-[92vw] max-w-6xl flex-col overflow-hidden rounded-xl border border-white/10 bg-[var(--editor-bg,#1e1e1e)] shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
          <GitCompare className="h-4 w-4 text-blue-400" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-white/90 truncate">Review changes — {fileName}</div>
            <div className="text-[11px] text-white/40">Left: current remote file · Right: your changes</div>
          </div>
          <button onClick={onCancel} title="Cancel (Esc)" className="rounded p-1 text-white/60 hover:bg-white/10 hover:text-white/90">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Diff */}
        <div className="flex-1 overflow-hidden">
          <MonacoDiffEditor original={original} modified={modified} language={language} theme={theme} />
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 border-t border-white/10 px-4 py-3">
          <label className="flex items-center gap-2 text-xs text-white/60 select-none cursor-pointer">
            <input type="checkbox" checked={dontAsk} onChange={(e) => setDontAsk(e.target.checked)} className="accent-blue-500" />
            Don&apos;t ask again this session
          </label>
          <div className="flex-1" />
          <button
            onClick={onCancel}
            className="rounded-md border border-white/15 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10"
          >
            Cancel
          </button>
          <button
            onClick={confirm}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-60"
          >
            <Save className="h-3.5 w-3.5" />
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SaveDiffModal;
