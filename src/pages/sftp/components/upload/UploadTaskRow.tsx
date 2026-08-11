/**
 * @module pages/sftp/components/upload/UploadTaskRow
 *
 * Presentational card for a single resumable upload. Pure/memoized — all
 * behaviour comes in through callbacks so it never subscribes to the store.
 */
import React from "react";
import {
  AlertCircle,
  CheckCircle2,
  Pause,
  Play,
  RotateCcw,
  UploadCloud,
  X,
} from "lucide-react";
import { formatBytes, formatSpeed } from "@/lib/utils";
import { taskPercent, type UploadTask } from "@/store/uploadStore";

export interface UploadTaskRowProps {
  task: UploadTask;
  onPause: (uploadId: string) => void;
  onResume: (uploadId: string) => void;
  onRetry: (uploadId: string) => void;
  onAbort: (uploadId: string) => void;
  onDismiss: (uploadId: string) => void;
}

function iconButton(
  key: string,
  title: string,
  icon: React.ReactNode,
  onClick: () => void,
) {
  return (
    <button
      key={key}
      onClick={onClick}
      title={title}
      className="p-1 rounded-md text-gray-400 hover:text-gray-100 hover:bg-white/10 transition-colors"
    >
      {icon}
    </button>
  );
}

function UploadTaskRowBase({
  task,
  onPause,
  onResume,
  onRetry,
  onAbort,
  onDismiss,
}: UploadTaskRowProps) {
  const percent = taskPercent(task);
  const isTransfer = task.phase === "transfer" && task.status !== "completed";
  const transferPct = Math.round(task.transferPercent ?? 0);

  const barColor =
    task.status === "error"
      ? "bg-red-500"
      : task.status === "completed"
        ? "bg-green-500"
        : task.status === "paused"
          ? "bg-amber-500"
          : "bg-blue-500";

  const controls: React.ReactNode[] = [];
  if (task.status === "uploading" || task.status === "queued") {
    controls.push(iconButton("pause", "Pause", <Pause className="w-3.5 h-3.5" />, () => onPause(task.uploadId)));
    controls.push(iconButton("cancel", "Cancel", <X className="w-3.5 h-3.5" />, () => onAbort(task.uploadId)));
  } else if (task.status === "paused") {
    controls.push(iconButton("resume", "Resume", <Play className="w-3.5 h-3.5" />, () => onResume(task.uploadId)));
    controls.push(iconButton("cancel", "Cancel", <X className="w-3.5 h-3.5" />, () => onAbort(task.uploadId)));
  } else if (task.status === "error") {
    controls.push(iconButton("retry", "Retry", <RotateCcw className="w-3.5 h-3.5" />, () => onRetry(task.uploadId)));
    controls.push(iconButton("cancel", "Cancel", <X className="w-3.5 h-3.5" />, () => onAbort(task.uploadId)));
  } else {
    controls.push(iconButton("dismiss", "Dismiss", <X className="w-3.5 h-3.5" />, () => onDismiss(task.uploadId)));
  }

  const statusIcon =
    task.status === "completed" ? (
      <CheckCircle2 className="w-4 h-4 text-green-400" />
    ) : task.status === "error" ? (
      <AlertCircle className="w-4 h-4 text-red-400" />
    ) : (
      <UploadCloud className="w-4 h-4 text-blue-400" />
    );

  return (
    <div className="w-80 rounded-lg border border-white/10 bg-[#1a1b26]/95 backdrop-blur-sm p-3 shadow-xl">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          {statusIcon}
          <span className="text-sm font-medium text-gray-100 truncate max-w-[180px]" title={task.name}>
            {task.name}
          </span>
        </div>
        <div className="flex items-center gap-0.5">{controls}</div>
      </div>

      {/* Progress bar */}
      <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden mb-1.5">
        <div
          className={`h-full transition-all duration-300 ${barColor}`}
          style={{ width: `${isTransfer ? transferPct : percent}%` }}
        />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-[11px] text-gray-400">
        <span className="truncate">
          {task.status === "error"
            ? task.error || "Upload failed"
            : task.status === "completed"
              ? "Completed"
              : isTransfer
                ? `Transferring to remote…${task.transferPercent != null ? ` ${transferPct}%` : ""}`
                : `${formatBytes(task.offset)} / ${formatBytes(task.size)}`}
        </span>
        {task.status === "uploading" && !isTransfer && task.speedBps > 0 && (
          <span className="shrink-0 ml-2">
            {formatSpeed(task.speedBps)} · {task.etaSec}s
          </span>
        )}
        {task.status === "paused" && <span className="shrink-0 ml-2 text-amber-400">Paused</span>}
        {task.status === "queued" && <span className="shrink-0 ml-2">Queued</span>}
      </div>
    </div>
  );
}

export const UploadTaskRow = React.memo(UploadTaskRowBase);
