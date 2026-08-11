/**
 * @module pages/sftp/hooks/useResumableUpload
 *
 * Resumable, multi-file SFTP upload engine + React hook.
 *
 *   status → chunk → chunk … → completed   (per file, chunks sequential)
 *
 * Multiple files upload concurrently (capped by MAX_CONCURRENT); chunks within
 * one file are strictly sequential (the server rejects overlapping chunks for
 * the same uploadId with 409). Network failures auto-retry with backoff and
 * re-sync the offset from the server; a stable uploadId lets a re-dropped file
 * resume from wherever the server left off.
 *
 * The engine lives at module scope so uploads keep running across component
 * re-renders/unmounts; the hook is just a thin, memoized control surface.
 */
import { useCallback, useEffect, useMemo, useRef } from "react";
import type { Socket } from "socket.io-client";
import { ApiCore, type ApiEnvelope, type UploadChunkResult } from "@/lib/api";
import { SocketEventConstants } from "@/lib/sockets/event-constants";
import { useUploadStore, type UploadTask } from "@/store/uploadStore";

const CHUNK_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_CONCURRENT = 3;
const MAX_NET_RETRIES = 5;

interface RuntimeHandle {
  file: File;
  paused: boolean;
  controller: AbortController | null;
  running: boolean;
  onComplete?: () => void;
}

/* ── Module-level engine state (shared across all tabs) ─────── */
const handles = new Map<string, RuntimeHandle>();
const queue: string[] = [];
let activeCount = 0;

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
const backoff = (attempt: number) => Math.min(1000 * 2 ** (attempt - 1), 8000);
const isAbortError = (err: unknown) =>
  err instanceof DOMException && err.name === "AbortError";

/** Stable id for a file so retries/resumes reuse the server's staged bytes. */
function makeUploadId(file: File): string {
  const raw = `${file.name}-${file.size}-${file.lastModified}`;
  return raw.replace(/[^A-Za-z0-9_-]/g, "-");
}

/** Ask the server where to resume from; fall back to the local offset on error. */
async function resolveStartOffset(uploadId: string, fallback: number): Promise<number> {
  try {
    const res = await ApiCore.uploadStatus(uploadId);
    if (res?.status && typeof res.result?.offset === "number") return res.result.offset;
  } catch {
    /* network hiccup — use the local offset */
  }
  return fallback;
}

function schedule(uploadId: string) {
  const handle = handles.get(uploadId);
  if (!handle || handle.running) return;
  if (!queue.includes(uploadId)) queue.push(uploadId);
  pump();
}

function pump() {
  while (activeCount < MAX_CONCURRENT && queue.length > 0) {
    const id = queue.shift();
    if (!id) break;
    const handle = handles.get(id);
    if (!handle || handle.running) continue;
    const task = useUploadStore.getState().tasks[id];
    if (!task || task.status === "paused" || task.status === "aborted" || task.status === "completed") {
      continue;
    }
    activeCount += 1;
    void runTask(id).finally(() => {
      activeCount -= 1;
      pump();
    });
  }
}

async function runTask(uploadId: string): Promise<void> {
  const handle = handles.get(uploadId);
  const task = useUploadStore.getState().tasks[uploadId];
  if (!handle || !task || handle.running) return;
  handle.running = true;

  const { file, onComplete } = handle;
  const { sessionId, path, name, size } = task;
  const { update } = useUploadStore.getState();

  update(uploadId, { status: "uploading", error: undefined });

  let netRetries = 0;
  let lastTime = Date.now();
  let lastBytes = task.offset;

  try {
    let offset = await resolveStartOffset(uploadId, task.offset);
    update(uploadId, { offset, phase: offset >= size ? "transfer" : "staging" });
    lastBytes = offset;

    while (offset < size) {
      if (handle.paused) {
        update(uploadId, { status: "paused" });
        return;
      }

      const end = Math.min(offset + CHUNK_SIZE, size);
      const isFinal = end >= size;
      const slice = file.slice(offset, end);
      handle.controller = new AbortController();

      let res: { httpStatus: number; body: ApiEnvelope<UploadChunkResult> };
      try {
        res = await ApiCore.uploadChunk({
          chunk: slice,
          uploadId,
          path,
          name,
          offset,
          total: size,
          sftpSessionId: sessionId,
          signal: handle.controller.signal,
        });
      } catch (err) {
        if (handle.paused) {
          update(uploadId, { status: "paused" });
          return;
        }
        if (isAbortError(err)) return; // aborted/cancelled externally
        netRetries += 1;
        if (netRetries > MAX_NET_RETRIES) throw err;
        update(uploadId, { status: "uploading", error: undefined });
        await delay(backoff(netRetries));
        offset = await resolveStartOffset(uploadId, offset);
        update(uploadId, { offset });
        continue;
      }

      const { httpStatus, body } = res;

      // 409 → offset mismatch (trust server) or chunk-in-progress (wait & retry).
      if (httpStatus === 409) {
        const serverOffset = body?.result?.offset;
        if (typeof serverOffset === "number") {
          offset = serverOffset;
          update(uploadId, { offset });
        } else {
          await delay(400);
        }
        continue;
      }

      if (!body?.status) throw new Error(body?.message || "Chunk upload failed");

      netRetries = 0;
      offset = body.result.offset;

      const now = Date.now();
      const dt = (now - lastTime) / 1000;
      if (dt > 0.2) {
        const speedBps = (offset - lastBytes) / dt;
        const etaSec = speedBps > 0 ? Math.round((size - offset) / speedBps) : 0;
        update(uploadId, { speedBps, etaSec });
        lastTime = now;
        lastBytes = offset;
      }
      update(uploadId, {
        offset,
        status: "uploading",
        phase: isFinal ? "transfer" : "staging",
      });

      if (body.result.completed) {
        update(uploadId, {
          status: "completed",
          offset: size,
          phase: "transfer",
          transferPercent: 100,
          remotePath: body.result.remotePath,
          speedBps: 0,
          etaSec: 0,
        });
        onComplete?.();
        return;
      }
    }

    // Offset reached size without an explicit completed flag.
    update(uploadId, { status: "completed", offset: size, speedBps: 0, etaSec: 0 });
    onComplete?.();
  } catch (err) {
    update(uploadId, { status: "error", error: (err as Error).message });
  } finally {
    handle.running = false;
  }
}

/* ── Hook ───────────────────────────────────────────────────── */

export interface UseResumableUploadOptions {
  /** SFTP session id (tabId). */
  sessionId: string;
  /** Per-tab socket — used only to surface server→remote transfer progress. */
  socket?: Socket;
  /** Fired once per file when it finishes (e.g. to refresh the listing). */
  onComplete?: () => void;
}

export interface UseResumableUploadReturn {
  enqueue: (files: File[], remotePath: string) => void;
  retry: (uploadId: string) => void;
  pause: (uploadId: string) => void;
  resume: (uploadId: string) => void;
  abort: (uploadId: string) => Promise<void>;
  dismiss: (uploadId: string) => void;
}

export function useResumableUpload({
  sessionId,
  socket,
  onComplete,
}: UseResumableUploadOptions): UseResumableUploadReturn {
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const enqueue = useCallback(
    (files: File[], remotePath: string) => {
      const store = useUploadStore.getState();
      for (const file of files) {
        const uploadId = makeUploadId(file);
        const existing = store.tasks[uploadId];
        if (existing && (existing.status === "uploading" || existing.status === "queued")) {
          continue; // already in flight
        }
        handles.set(uploadId, {
          file,
          paused: false,
          controller: null,
          running: false,
          onComplete: () => onCompleteRef.current?.(),
        });
        store.upsert({
          uploadId,
          sessionId,
          name: file.name,
          path: remotePath,
          size: file.size,
          offset: existing?.offset ?? 0,
          phase: "staging",
          status: "queued",
          speedBps: 0,
          etaSec: 0,
          transferPercent: undefined,
          error: undefined,
          remotePath: undefined,
          createdAt: existing?.createdAt ?? Date.now(),
        });
        schedule(uploadId);
      }
    },
    [sessionId],
  );

  const pause = useCallback((uploadId: string) => {
    const handle = handles.get(uploadId);
    if (handle) {
      handle.paused = true;
      handle.controller?.abort();
    }
    useUploadStore.getState().update(uploadId, { status: "paused" });
  }, []);

  const resume = useCallback((uploadId: string) => {
    const handle = handles.get(uploadId);
    if (!handle) {
      useUploadStore.getState().update(uploadId, {
        status: "error",
        error: "Re-drop the file to resume this upload.",
      });
      return;
    }
    handle.paused = false;
    useUploadStore.getState().update(uploadId, { status: "queued", error: undefined });
    schedule(uploadId);
  }, []);

  const retry = resume;

  const abort = useCallback(async (uploadId: string) => {
    const handle = handles.get(uploadId);
    if (handle) {
      handle.paused = true;
      handle.controller?.abort();
    }
    useUploadStore.getState().update(uploadId, { status: "aborted" });
    try {
      const { httpStatus } = await ApiCore.uploadAbort(uploadId);
      if (httpStatus === 409) {
        await delay(600); // chunk mid-write — let it finish, then retry once
        await ApiCore.uploadAbort(uploadId);
      }
    } catch {
      /* best-effort cleanup */
    }
    handles.delete(uploadId);
    useUploadStore.getState().remove(uploadId);
  }, []);

  const dismiss = useCallback((uploadId: string) => {
    handles.delete(uploadId);
    useUploadStore.getState().remove(uploadId);
  }, []);

  // Surface server→remote transfer progress (phase: "transfer") from the socket.
  useEffect(() => {
    if (!socket) return;
    const onProgress = (data: {
      name?: string;
      percent?: string | number;
      phase?: string;
    }) => {
      if (!data?.phase) return; // classic (non-resumable) events are ignored here
      const store = useUploadStore.getState();
      const match = Object.values(store.tasks).find(
        (t) => t.sessionId === sessionId && t.name === data.name && t.status !== "completed",
      );
      if (!match) return;
      if (data.phase === "transfer") {
        const pct = Number(data.percent);
        store.update(match.uploadId, {
          phase: "transfer",
          transferPercent: Number.isFinite(pct) ? pct : match.transferPercent,
        });
      }
    };
    socket.on(SocketEventConstants.FILE_UPLOADED_PROGRESS, onProgress);
    return () => {
      socket.off(SocketEventConstants.FILE_UPLOADED_PROGRESS, onProgress);
    };
  }, [socket, sessionId]);

  return { enqueue, retry, pause, resume, abort, dismiss };
}

/**
 * Subscribe to one session's upload tasks (sorted by creation). Kept separate
 * from the control hook so only the upload panel re-renders on progress ticks —
 * the file browser that owns `useResumableUpload` never subscribes to tasks.
 */
export function useUploadTasks(sessionId: string): UploadTask[] {
  const tasksRecord = useUploadStore((s) => s.tasks);
  return useMemo(
    () =>
      Object.values(tasksRecord)
        .filter((t) => t.sessionId === sessionId)
        .sort((a, b) => a.createdAt - b.createdAt),
    [tasksRecord, sessionId],
  );
}
