/**
 * @module useFileOperations
 *
 * Reusable hook that exposes file-system operations for the
 * editor file-tree context menu.
 *
 * Supports three calling conventions (broadest first):
 *
 *   1. **Handlers object** (preferred) — pass a `FileOperationHandlers`
 *      plain object.  Each op can come from a different transport.
 *   2. **Provider instance** — pass a `FileSystemProvider`, whose
 *      methods are used directly.
 *   3. **Socket ref** (legacy) — pass a `React.RefObject<Socket>`.
 *
 * After each mutation the hook automatically refreshes the
 * containing directory so the tree picks up changes.
 */
import { useCallback, useRef } from "react";
import type { Socket } from "socket.io-client";
import { SocketEventConstants } from "@/lib/sockets/event-constants";
import type {
  FileSystemProvider,
  FileOperationHandlers,
} from "@/modules/monaco-editor/lib/filesystem/file-system-types";

export interface FileOperations {
  createFile: (dirPath: string, name: string) => void;
  createDir: (dirPath: string, name: string) => void;
  rename: (oldPath: string, newName: string) => void;
  move: (oldPath: string, newPath: string) => void;
  copy: (sourcePath: string, destinationPath: string) => void;
  deleteFile: (filePath: string) => void;
  deleteDir: (dirPath: string) => void;
  refresh: (dirPath: string) => void;
}

/* ── Overloads ──────────────────────────────────────────────── */

/** Handlers-based variant (preferred — composable). */
export function useFileOperations(
  handlers: FileOperationHandlers,
  onRefresh?: (dir: string) => void,
): FileOperations;

/** Provider-based variant. */
export function useFileOperations(
  provider: FileSystemProvider | null,
  onRefresh?: (dir: string) => void,
): FileOperations;

/**
 * Legacy socket-based variant.
 * @deprecated Use the handlers or provider overload instead.
 */
export function useFileOperations(
  socketRef: React.RefObject<Socket | null>,
  onRefresh?: (dir: string) => void,
): FileOperations;

/* ── Implementation ─────────────────────────────────────────── */

export function useFileOperations(
  source:
    | FileOperationHandlers
    | FileSystemProvider
    | React.RefObject<Socket | null>
    | null,
  onRefresh?: (dir: string) => void,
): FileOperations {
  /*
   * Detect which variant the caller used:
   *   - has `current` key → React ref (legacy socket)
   *   - has `readdir` fn  → full FileSystemProvider
   *   - has `readFile` fn → FileOperationHandlers (or provider — both work)
   *   - null              → noop
   */
  const handlersRef = useRef<FileOperationHandlers | null>(null);
  const socketRef = useRef<Socket | null>(null);

  if (source === null) {
    handlersRef.current = null;
    socketRef.current = null;
  } else if ("current" in source) {
    // Legacy: React ref to Socket
    socketRef.current = (source as React.RefObject<Socket | null>).current;
    handlersRef.current = null;
  } else if (typeof (source as any).readFile === "function") {
    // Either FileOperationHandlers or FileSystemProvider — both expose readFile
    handlersRef.current = source as FileOperationHandlers;
    socketRef.current = null;
  }

  /* -- Legacy socket emit helper ----------------------------- */
  const emit = useCallback(
    (event: string, payload: Record<string, unknown>) => {
      socketRef.current?.emit(event, payload);
    },
    [],
  );

  /* -- Refresh ----------------------------------------------- */
  const refreshDir = useCallback(
    (dirPath: string) => {
      if (!handlersRef.current) {
        // Legacy: tell socket to re-list
        emit(SocketEventConstants.SFTP_GET_FILE, { dirPath });
      }
      // Always notify the tree hook so it re-fetches via the provider
      onRefresh?.(dirPath);
    },
    [emit, onRefresh],
  );

  /* -- Helper: run handler then refresh ---------------------- */
  const run = useCallback(
    (
      handlerFn: ((...args: any[]) => Promise<void>) | undefined,
      socketEvent: string,
      socketPayload: Record<string, unknown>,
      dirsToRefresh: string[],
    ) => {
      if (handlersRef.current && handlerFn) {
        handlerFn().then(() =>
          setTimeout(() => dirsToRefresh.forEach((d) => refreshDir(d)), 300),
        ).catch(() => {});
      } else {
        emit(socketEvent, socketPayload);
        setTimeout(() => dirsToRefresh.forEach((d) => refreshDir(d)), 300);
      }
    },
    [emit, refreshDir],
  );

  /* -- CRUD callbacks ---------------------------------------- */

  const createFile = useCallback(
    (dirPath: string, name: string) => {
      const filePath = `${dirPath === "/" ? "" : dirPath}/${name}`;
      run(
        handlersRef.current ? () => handlersRef.current!.createFile(dirPath, name) : undefined,
        SocketEventConstants.SFTP_CREATE_FILE,
        { filePath },
        [dirPath],
      );
    },
    [run],
  );

  const createDir = useCallback(
    (dirPath: string, name: string) => {
      const folderPath = `${dirPath === "/" ? "" : dirPath}/${name}`;
      run(
        handlersRef.current ? () => handlersRef.current!.createDir(dirPath, name) : undefined,
        SocketEventConstants.SFTP_CREATE_DIR,
        { folderPath },
        [dirPath],
      );
    },
    [run],
  );

  const rename = useCallback(
    (oldPath: string, newName: string) => {
      const parentDir = oldPath.substring(0, oldPath.lastIndexOf("/")) || "/";
      const newPath = `${parentDir}/${newName}`;
      run(
        handlersRef.current ? () => handlersRef.current!.rename(oldPath, newName) : undefined,
        SocketEventConstants.SFTP_RENAME_FILE,
        { oldPath, newPath },
        [parentDir],
      );
    },
    [run],
  );

  const move = useCallback(
    (oldPath: string, newPath: string) => {
      const srcDir = oldPath.substring(0, oldPath.lastIndexOf("/")) || "/";
      const destDir = newPath.substring(0, newPath.lastIndexOf("/")) || "/";
      const dirs = srcDir === destDir ? [srcDir] : [srcDir, destDir];
      run(
        handlersRef.current ? () => handlersRef.current!.move(oldPath, newPath) : undefined,
        SocketEventConstants.SFTP_MOVE_FILE,
        { oldPath, newPath },
        dirs,
      );
    },
    [run],
  );

  const copy = useCallback(
    (sourcePath: string, destinationPath: string) => {
      const destDir = destinationPath.substring(0, destinationPath.lastIndexOf("/")) || "/";
      run(
        handlersRef.current ? () => handlersRef.current!.copy(sourcePath, destinationPath) : undefined,
        SocketEventConstants.SFTP_COPY_FILE,
        { currentPath: sourcePath, destinationPath },
        [destDir],
      );
    },
    [run],
  );

  const deleteFile = useCallback(
    (filePath: string) => {
      const parentDir = filePath.substring(0, filePath.lastIndexOf("/")) || "/";
      run(
        handlersRef.current ? () => handlersRef.current!.deleteFile(filePath) : undefined,
        SocketEventConstants.SFTP_DELETE_FILE,
        { path: filePath },
        [parentDir],
      );
    },
    [run],
  );

  const deleteDir = useCallback(
    (dirPath: string) => {
      const parentDir = dirPath.substring(0, dirPath.lastIndexOf("/")) || "/";
      run(
        handlersRef.current ? () => handlersRef.current!.deleteDir(dirPath) : undefined,
        SocketEventConstants.SFTP_DELETE_DIR,
        { path: dirPath },
        [parentDir],
      );
    },
    [run],
  );

  return {
    createFile,
    createDir,
    rename,
    move,
    copy,
    deleteFile,
    deleteDir,
    refresh: refreshDir,
  };
}
