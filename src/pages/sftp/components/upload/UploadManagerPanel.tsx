/**
 * @module pages/sftp/components/upload/UploadManagerPanel
 *
 * Fixed bottom-right stack of active/finished resumable uploads. Pure and
 * memoized — the parent owns the `useResumableUpload` hook and passes tasks +
 * callbacks down, so this panel never re-subscribes to the store itself.
 */
import React from "react";
import { useUploadTasks } from "../../hooks/useResumableUpload";
import { UploadTaskRow } from "./UploadTaskRow";

export interface UploadManagerPanelProps {
  /** SFTP session id — the panel subscribes to just this session's tasks. */
  sessionId: string;
  onPause: (uploadId: string) => void;
  onResume: (uploadId: string) => void;
  onRetry: (uploadId: string) => void;
  onAbort: (uploadId: string) => void;
  onDismiss: (uploadId: string) => void;
}

function UploadManagerPanelBase({
  sessionId,
  onPause,
  onResume,
  onRetry,
  onAbort,
  onDismiss,
}: UploadManagerPanelProps) {
  const tasks = useUploadTasks(sessionId);
  if (tasks.length === 0) return null;

  const active = tasks.filter(
    (t) => t.status === "uploading" || t.status === "queued" || t.status === "paused",
  ).length;

  return (
    <div className="fixed bottom-5 right-4 z-[1000] flex flex-col gap-2 max-h-[70vh] overflow-y-auto scrollbar-green">
      {tasks.length > 1 && (
        <div className="text-[11px] font-medium text-gray-400 px-1">
          Uploads · {active} active / {tasks.length} total
        </div>
      )}
      {tasks.map((task) => (
        <UploadTaskRow
          key={task.uploadId}
          task={task}
          onPause={onPause}
          onResume={onResume}
          onRetry={onRetry}
          onAbort={onAbort}
          onDismiss={onDismiss}
        />
      ))}
    </div>
  );
}

export const UploadManagerPanel = React.memo(UploadManagerPanelBase);
