/**
 * @module useFileOperations
 *
 * Reusable hook that exposes SFTP file-system operations for the
 * editor file-tree context menu.
 *
 * All operations are sent via the provided socket reference and
 * follow the same emit patterns used by the main SFTP page:
 *   - create file / dir
 *   - rename / move / copy
 *   - delete file / dir
 *
 * After each mutation the hook automatically refreshes the
 * containing directory so the tree picks up changes.
 */
import { useCallback } from "react";
import type { Socket } from "socket.io-client";
import { SocketEventConstants } from "@/lib/sockets/event-constants";

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

/**
 * Build stable callbacks around the given socket ref.
 *
 * @param socketRef  React ref holding the live socket (may be null)
 * @param onRefresh  Optional extra callback after refresh (e.g. update tree state)
 */
export function useFileOperations(
  socketRef: React.RefObject<Socket | null>,
  onRefresh?: (dir: string) => void,
): FileOperations {
  const emit = useCallback(
    (event: string, payload: Record<string, unknown>) => {
      socketRef.current?.emit(event, payload);
    },
    [socketRef],
  );

  const refreshDir = useCallback(
    (dirPath: string) => {
      emit(SocketEventConstants.SFTP_GET_FILE, { dirPath });
      onRefresh?.(dirPath);
    },
    [emit, onRefresh],
  );

  const createFile = useCallback(
    (dirPath: string, name: string) => {
      const filePath = `${dirPath === "/" ? "" : dirPath}/${name}`;
      emit(SocketEventConstants.SFTP_CREATE_FILE, { filePath });
      // Small delay to let server create before refreshing
      setTimeout(() => refreshDir(dirPath), 300);
    },
    [emit, refreshDir],
  );

  const createDir = useCallback(
    (dirPath: string, name: string) => {
      const folderPath = `${dirPath === "/" ? "" : dirPath}/${name}`;
      emit(SocketEventConstants.SFTP_CREATE_DIR, { folderPath });
      setTimeout(() => refreshDir(dirPath), 300);
    },
    [emit, refreshDir],
  );

  const rename = useCallback(
    (oldPath: string, newName: string) => {
      const parentDir = oldPath.substring(0, oldPath.lastIndexOf("/")) || "/";
      const newPath = `${parentDir}/${newName}`;
      emit(SocketEventConstants.SFTP_RENAME_FILE, { oldPath, newPath });
      setTimeout(() => refreshDir(parentDir), 300);
    },
    [emit, refreshDir],
  );

  const move = useCallback(
    (oldPath: string, newPath: string) => {
      emit(SocketEventConstants.SFTP_MOVE_FILE, { oldPath, newPath });
      const srcDir = oldPath.substring(0, oldPath.lastIndexOf("/")) || "/";
      const destDir = newPath.substring(0, newPath.lastIndexOf("/")) || "/";
      setTimeout(() => {
        refreshDir(srcDir);
        if (destDir !== srcDir) refreshDir(destDir);
      }, 300);
    },
    [emit, refreshDir],
  );

  const copy = useCallback(
    (sourcePath: string, destinationPath: string) => {
      emit(SocketEventConstants.SFTP_COPY_FILE, {
        currentPath: sourcePath,
        destinationPath,
      });
      const destDir =
        destinationPath.substring(0, destinationPath.lastIndexOf("/")) || "/";
      setTimeout(() => refreshDir(destDir), 300);
    },
    [emit, refreshDir],
  );

  const deleteFile = useCallback(
    (filePath: string) => {
      emit(SocketEventConstants.SFTP_DELETE_FILE, { path: filePath });
      const parentDir =
        filePath.substring(0, filePath.lastIndexOf("/")) || "/";
      setTimeout(() => refreshDir(parentDir), 300);
    },
    [emit, refreshDir],
  );

  const deleteDir = useCallback(
    (dirPath: string) => {
      emit(SocketEventConstants.SFTP_DELETE_DIR, { path: dirPath });
      const parentDir =
        dirPath.substring(0, dirPath.lastIndexOf("/")) || "/";
      setTimeout(() => refreshDir(parentDir), 300);
    },
    [emit, refreshDir],
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
