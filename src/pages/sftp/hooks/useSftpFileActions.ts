/**
 * @module pages/sftp/hooks/useSftpFileActions
 *
 * Reusable SFTP file-browser actions that don't require a dialog:
 *   - `duplicateFile`  — server-side copy into the same directory with an
 *                        auto-generated, collision-free `-copy` name.
 *   - `copyContent`    — read a remote file via REST and place it on the
 *                        clipboard without opening an editor.
 *   - `compress` / `extract` — remote archive ops (@@SFTP_COMPRESS/@@SFTP_EXTRACT);
 *                        refresh the listing on the backend's @@SUCCESS.
 *
 * Callbacks are stable (useCallback) so context-menu rows don't re-render.
 */
import { useCallback, useState } from "react";
import type { Socket } from "socket.io-client";
import { SocketEventConstants } from "@/lib/sockets/event-constants";
import { ApiCore } from "@/lib/api";
import type { SFTP_FILES_LIST } from "../components/interface";

/** Split "report.tar.gz" → { base: "report", ext: ".tar.gz" } (single-ext aware). */
function splitName(name: string): { base: string; ext: string } {
  const dot = name.indexOf(".");
  // Leading-dot files (".env") have no base extension.
  if (dot <= 0) return { base: name, ext: "" };
  return { base: name.slice(0, dot), ext: name.slice(dot) };
}

/**
 * Produce a unique "<base>-copy<ext>" name, bumping to "-copy-2", "-copy-3"…
 * when earlier variants already exist in `existing`.
 */
function makeCopyName(name: string, existing: Set<string>): string {
  const { base, ext } = splitName(name);
  let candidate = `${base}-copy${ext}`;
  let n = 2;
  while (existing.has(candidate)) {
    candidate = `${base}-copy-${n}${ext}`;
    n += 1;
  }
  return candidate;
}

const ARCHIVE_RE = /\.(tar\.gz|tgz|tar|zip|gz)$/i;

/** True for archives we can extract (.zip/.tar.gz/.tgz/.tar/.gz). */
export function isArchiveFile(name: string): boolean {
  return ARCHIVE_RE.test(name);
}

/** Strip the archive extension for a default extraction folder name. */
function archiveBaseName(name: string): string {
  return name.replace(ARCHIVE_RE, "");
}

/** "<base>.<ext>", bumping to "-1", "-2"… when the archive name is taken. */
function uniqueArchiveName(base: string, archiveExt: string, existing: Set<string>): string {
  let candidate = `${base}.${archiveExt}`;
  let n = 1;
  while (existing.has(candidate)) {
    candidate = `${base}-${n}.${archiveExt}`;
    n += 1;
  }
  return candidate;
}

/** A folder name that doesn't collide with existing entries. */
function uniqueFolderName(base: string, existing: Set<string>): string {
  let candidate = base || "extracted";
  let n = 1;
  while (existing.has(candidate)) {
    candidate = `${base || "extracted"}-${n}`;
    n += 1;
  }
  return candidate;
}

export interface UseSftpFileActionsOptions {
  socket: Socket | undefined;
  currentDir: string;
  /** SFTP session id — used as the REST read session. */
  tabId?: string;
  /** Names already present in the current directory (collision avoidance). */
  existingNames?: string[];
  /** Called after a mutating action so the caller can refresh the listing. */
  onRefresh?: () => void;
  /** Toast/notify sink. */
  notify?: (msg: { title: string; description: string; variant?: "default" | "destructive" }) => void;
}

export interface UseSftpFileActionsReturn {
  duplicateFile: (file: SFTP_FILES_LIST) => void;
  copyContent: (file: SFTP_FILES_LIST) => Promise<void>;
  /** Compress a file/dir into an archive alongside it. */
  compress: (file: SFTP_FILES_LIST, format: "zip" | "tar.gz") => void;
  /** Extract an archive — into a new folder, or into the current dir (`here`). */
  extract: (file: SFTP_FILES_LIST, opts?: { here?: boolean }) => void;
  /** True while a `copyContent` read is in flight. */
  isCopyingContent: boolean;
}

export function useSftpFileActions({
  socket,
  currentDir,
  tabId,
  existingNames,
  onRefresh,
  notify,
}: UseSftpFileActionsOptions): UseSftpFileActionsReturn {
  const [isCopyingContent, setIsCopyingContent] = useState(false);

  const duplicateFile = useCallback(
    (file: SFTP_FILES_LIST) => {
      const sourcePath = `${currentDir}/${file.name}`;
      const existing = new Set(existingNames ?? []);
      const destName = makeCopyName(file.name, existing);
      const destinationPath = `${currentDir}/${destName}`;

      socket?.emit(SocketEventConstants.SFTP_COPY_FILE, {
        currentPath: sourcePath,
        destinationPath,
      });
      notify?.({ title: "Duplicating", description: `Creating ${destName}…` });
      onRefresh?.();
    },
    [socket, currentDir, existingNames, onRefresh, notify],
  );

  const copyContent = useCallback(
    async (file: SFTP_FILES_LIST) => {
      if (!tabId) {
        notify?.({ title: "Error", description: "No active session.", variant: "destructive" });
        return;
      }
      const fullPath = `${currentDir}/${file.name}`;
      setIsCopyingContent(true);
      try {
        const res = await ApiCore.fetchFileContent(tabId, fullPath);
        if (!res.status) throw new Error(res.message || "Failed to read file");
        await navigator.clipboard.writeText(res.result ?? "");
        notify?.({ title: "Copied", description: `${file.name} content copied to clipboard.` });
      } catch (err) {
        notify?.({
          title: "Copy failed",
          description: (err as Error).message,
          variant: "destructive",
        });
      } finally {
        setIsCopyingContent(false);
      }
    },
    [tabId, currentDir, notify],
  );

  // Emit an archive op, then refresh the listing on the backend's @@SUCCESS.
  // Listeners are scoped to this op and torn down on completion, error, or timeout.
  const runArchiveOp = useCallback(
    (event: SocketEventConstants, payload: unknown, startMsg: string) => {
      if (!socket) {
        notify?.({ title: "Error", description: "No active session.", variant: "destructive" });
        return;
      }
      notify?.({ title: "Archive", description: startMsg });

      const cleanup = () => {
        clearTimeout(timer);
        socket.off(SocketEventConstants.SUCCESS, onDone);
        socket.off(SocketEventConstants.ERROR, onFail);
        socket.off(SocketEventConstants.SFTP_EMIT_ERROR, onFail);
      };
      function onDone() {
        cleanup();
        onRefresh?.();
      }
      function onFail() {
        cleanup();
      }
      const timer = setTimeout(cleanup, 5 * 60 * 1000);

      socket.on(SocketEventConstants.SUCCESS, onDone);
      socket.on(SocketEventConstants.ERROR, onFail);
      socket.on(SocketEventConstants.SFTP_EMIT_ERROR, onFail);
      socket.emit(event, payload);
    },
    [socket, onRefresh, notify],
  );

  const compress = useCallback(
    (file: SFTP_FILES_LIST, format: "zip" | "tar.gz") => {
      const existing = new Set(existingNames ?? []);
      const destName = uniqueArchiveName(file.name, format, existing);
      runArchiveOp(
        SocketEventConstants.SFTP_COMPRESS,
        {
          sources: [`${currentDir}/${file.name}`],
          destination: `${currentDir}/${destName}`,
          format,
          cwd: currentDir,
        },
        `Creating ${destName}…`,
      );
    },
    [currentDir, existingNames, runArchiveOp],
  );

  const extract = useCallback(
    (file: SFTP_FILES_LIST, opts?: { here?: boolean }) => {
      const archivePath = `${currentDir}/${file.name}`;
      let destination = currentDir;
      if (!opts?.here) {
        const existing = new Set(existingNames ?? []);
        const folder = uniqueFolderName(archiveBaseName(file.name), existing);
        destination = `${currentDir}/${folder}`;
      }
      runArchiveOp(
        SocketEventConstants.SFTP_EXTRACT,
        { archivePath, destination },
        opts?.here ? `Extracting ${file.name} here…` : `Extracting ${file.name}…`,
      );
    },
    [currentDir, existingNames, runArchiveOp],
  );

  return { duplicateFile, copyContent, compress, extract, isCopyingContent };
}
