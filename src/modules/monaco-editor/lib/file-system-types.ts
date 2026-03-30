/**
 * @module monaco-editor/types/file-system
 *
 * Pluggable file system abstractions for the editor's file tree sidebar.
 *
 * Architecture (composable handlers):
 *
 *   FileSystemConnection  → owns connect/disconnect/status/readdir
 *   FileOperationHandlers → plain object of individual operation functions
 *                           (can be mixed from different transports)
 *   FileEntry             → normalised directory entry shape
 *   FsProviderStatus      → observable connection state
 *
 * @example
 * ```ts
 * // Mix SFTP socket ops with REST upload/download:
 * const handlers: FileOperationHandlers = {
 *   ...createSftpHandlers(socket),       // rename, copy, move, delete via socket
 *   upload: createApiUpload(apiUrl),      // upload via REST
 *   download: createApiDownload(apiUrl),  // download via REST
 * };
 * ```
 */

// ═══════════════════════════════════════════════════════════════
//  FILE ENTRY
// ═══════════════════════════════════════════════════════════════

/** Normalised representation of a single directory entry. */
export interface FileEntry {
    /** File or directory name (without path) */
    name: string;
    /** "d" for directory, "-" for regular file, or other POSIX type char */
    type: "d" | "-" | string;
    /** File size in bytes (optional) */
    size?: number;
    /** Last modification time as Unix timestamp (ms) */
    modifyTime?: number;
    /** Access time as Unix timestamp (ms) */
    accessTime?: number;
    /** POSIX permission strings (optional) */
    rights?: { user: string; group: string; other: string };
    /** Owner UID */
    owner?: number;
    /** Group GID */
    group?: number;
    /** ls -l style string (optional, SFTP-specific) */
    longname?: string;
}

// ═══════════════════════════════════════════════════════════════
//  PROVIDER STATUS
// ═══════════════════════════════════════════════════════════════

/** Connection lifecycle states */
export type FsProviderStatus =
    | "idle"          // not connected yet
    | "connecting"    // connection in progress
    | "connected"     // session is live
    | "error";        // connection failed

/** Callback signature for status change subscriptions */
export type FsStatusListener = (status: FsProviderStatus, error?: string) => void;

// ═══════════════════════════════════════════════════════════════
//  FILE OPERATION HANDLERS (composable per-operation functions)
// ═══════════════════════════════════════════════════════════════

/**
 * A plain object whose keys are individual file-system operations.
 *
 * Each handler is an independent async function — they can come from
 * different transports.  For example, CRUD via socket but upload via REST.
 *
 * Pass this to `useFileOperations(handlers, onRefresh)` and the tree
 * UI "just works" regardless of which backend each op uses.
 */
export interface FileOperationHandlers {
    /** Read a remote file and return its content as a UTF-8 string. */
    readFile(filePath: string): Promise<string>;
    /** Write (save) content to a remote file. */
    writeFile(filePath: string, content: string): Promise<void>;
    /** Create a new empty file inside `dirPath`. */
    createFile(dirPath: string, name: string): Promise<void>;
    /** Create a new directory inside `dirPath`. */
    createDir(dirPath: string, name: string): Promise<void>;
    /** Rename a file or directory. `newName` can be a new name or a full path. */
    rename(oldPath: string, newName: string): Promise<void>;
    /** Move a file or directory to a new absolute path. */
    move(oldPath: string, newPath: string): Promise<void>;
    /** Copy a file or directory to a new absolute destination. */
    copy(sourcePath: string, destPath: string): Promise<void>;
    /** Delete a single file. */
    deleteFile(filePath: string): Promise<void>;
    /** Delete a directory and all its contents. */
    deleteDir(dirPath: string): Promise<void>;
    /** Upload file(s) to a target directory (optional). */
    upload?(files: File[], targetDir: string): Promise<void>;
    /** Download a remote file (optional — returns a Blob). */
    download?(filePath: string): Promise<Blob>;
}

// ═══════════════════════════════════════════════════════════════
//  FILE SYSTEM PROVIDER  (connection + listing + handlers)
// ═══════════════════════════════════════════════════════════════

/**
 * Full provider: connection lifecycle + directory listing + operation handlers.
 *
 * You can either implement this interface as a class, or compose it
 * from a `FileSystemConnection` + a `FileOperationHandlers` object.
 *
 * @example
 * ```ts
 * const provider = new SftpFileSystemProvider({ hostUser, sessionId });
 * const tree = useFileSystemTree({ provider, initialDir: "/home/user" });
 * ```
 */
export interface FileSystemProvider extends FileOperationHandlers {
    /** Unique type identifier for this provider ("sftp", "api", "local", …) */
    readonly type: string;

    // ── Connection lifecycle ────────────────────────────────
    readonly status: FsProviderStatus;
    readonly error: string | undefined;
    connect(): Promise<void>;
    disconnect(): void;
    onStatusChange(listener: FsStatusListener): () => void;

    // ── Directory listing ──────────────────────────────────
    readdir(dirPath: string): Promise<FileEntry[]>;
    watchDir?(dirPath: string, cb: (entries: FileEntry[]) => void): () => void;
}
