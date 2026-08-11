/**
 * @module store/uploadStore
 *
 * Serializable state for resumable, multi-file SFTP uploads. Only progress
 * metadata lives here — the actual `File` objects and `AbortController`s are
 * held in a module-level runtime map inside `useResumableUpload` so they never
 * trigger store re-renders.
 *
 * Tasks are keyed by a stable `uploadId` (derived from the file identity), so
 * re-dropping the same file after a refresh resumes the same task.
 */
import { create } from "zustand";

export type UploadPhase = "staging" | "transfer";
export type UploadStatus =
  | "queued"
  | "uploading"
  | "paused"
  | "error"
  | "completed"
  | "aborted";

export interface UploadTask {
  uploadId: string;
  /** SFTP session id (tabId) this upload belongs to. */
  sessionId: string;
  name: string;
  /** Remote destination directory. */
  path: string;
  /** Full file size in bytes. */
  size: number;
  /** Bytes confirmed staged on the server. */
  offset: number;
  phase: UploadPhase;
  status: UploadStatus;
  /** Client-observed staging speed in bytes/sec. */
  speedBps: number;
  etaSec: number;
  /** Server→remote transfer progress (0–100), driven by socket events. */
  transferPercent?: number;
  error?: string;
  remotePath?: string;
  createdAt: number;
}

interface UploadState {
  tasks: Record<string, UploadTask>;
  upsert: (task: UploadTask) => void;
  update: (uploadId: string, patch: Partial<UploadTask>) => void;
  remove: (uploadId: string) => void;
}

export const useUploadStore = create<UploadState>((set) => ({
  tasks: {},
  upsert: (task) =>
    set((s) => ({ tasks: { ...s.tasks, [task.uploadId]: task } })),
  update: (uploadId, patch) =>
    set((s) => {
      const existing = s.tasks[uploadId];
      if (!existing) return s;
      return { tasks: { ...s.tasks, [uploadId]: { ...existing, ...patch } } };
    }),
  remove: (uploadId) =>
    set((s) => {
      if (!s.tasks[uploadId]) return s;
      const next = { ...s.tasks };
      delete next[uploadId];
      return { tasks: next };
    }),
}));

/** Percent (0–100) helper derived from offset/size. */
export function taskPercent(task: Pick<UploadTask, "offset" | "size">): number {
  if (task.size <= 0) return 0;
  return Math.min(100, Math.round((task.offset / task.size) * 100));
}
