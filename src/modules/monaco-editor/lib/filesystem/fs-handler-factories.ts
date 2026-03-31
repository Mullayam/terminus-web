/**
 * @module fs-handler-factories
 *
 * Factory functions that produce composable `FileOperationHandlers`.
 *
 * Each factory builds a handler object from a single transport
 * (SFTP socket, REST API, etc.).  Consumers can mix-and-match
 * individual operations from different factories:
 *
 * @example
 * ```ts
 * import { createSftpHandlers, createApiHandlers } from "./fs-handler-factories";
 *
 * const sftp = createSftpHandlers(socket);
 * const api  = createApiHandlers(apiUrl, sessionId);
 *
 * // Mix: CRUD via socket, upload/download via REST
 * const handlers: FileOperationHandlers = {
 *   ...sftp,
 *   upload:   api.upload,
 *   download: api.download,
 * };
 * ```
 */
import type { Socket } from "socket.io-client";
import { SocketEventConstants } from "@/lib/sockets/event-constants";
import type { FileOperationHandlers } from "./file-system-types";

// ═══════════════════════════════════════════════════════════════
//  SFTP Socket Handlers
// ═══════════════════════════════════════════════════════════════

export interface SftpHandlerOptions {
    /** Live Socket.IO socket connected to /sftp namespace */
    socket: Socket;
    /** Timeout for read/write operations in ms (default 30 000) */
    timeout?: number;
}

/**
 * Build `FileOperationHandlers` backed by a Socket.IO connection.
 *
 * CRUD ops are fire-and-forget.  readFile / writeFile wait for
 * server acknowledgement with a timeout.
 */
export function createSftpHandlers(opts: SftpHandlerOptions): FileOperationHandlers {
    const { socket: s, timeout = 30_000 } = opts;

    function emitAndForget(event: string, payload: Record<string, unknown>): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!s?.connected) return reject(new Error("SFTP socket not connected"));
            s.emit(event, payload);
            resolve();
        });
    }

    const readFile = (filePath: string): Promise<string> =>
        new Promise((resolve, reject) => {
            if (!s?.connected) return reject(new Error("SFTP socket not connected"));
            const timer = setTimeout(() => {
                s.off(SocketEventConstants.SFTP_EDIT_FILE_REQUEST_RESPONSE, onRes);
                s.off(SocketEventConstants.SFTP_EMIT_ERROR, onErr);
                reject(new Error("File read timed out"));
            }, timeout);
            const onRes = (data: string) => { clearTimeout(timer); s.off(SocketEventConstants.SFTP_EDIT_FILE_REQUEST_RESPONSE, onRes); s.off(SocketEventConstants.SFTP_EMIT_ERROR, onErr); resolve(data); };
            const onErr = (msg: string | { message?: string }) => { clearTimeout(timer); s.off(SocketEventConstants.SFTP_EDIT_FILE_REQUEST_RESPONSE, onRes); s.off(SocketEventConstants.SFTP_EMIT_ERROR, onErr); reject(new Error(typeof msg === "string" ? msg : msg?.message ?? "Read failed")); };
            s.on(SocketEventConstants.SFTP_EDIT_FILE_REQUEST_RESPONSE, onRes);
            s.on(SocketEventConstants.SFTP_EMIT_ERROR, onErr);
            s.emit(SocketEventConstants.SFTP_EDIT_FILE_REQUEST, { path: filePath });
        });

    const writeFile = (filePath: string, content: string): Promise<void> =>
        new Promise((resolve, reject) => {
            if (!s?.connected) return reject(new Error("SFTP socket not connected"));
            const timer = setTimeout(() => {
                s.off(SocketEventConstants.SFTP_EDIT_FILE_DONE, onDone);
                s.off(SocketEventConstants.SFTP_EMIT_ERROR, onErr);
                reject(new Error("File save timed out"));
            }, timeout);
            const onDone = () => { clearTimeout(timer); s.off(SocketEventConstants.SFTP_EDIT_FILE_DONE, onDone); s.off(SocketEventConstants.SFTP_EMIT_ERROR, onErr); resolve(); };
            const onErr = (msg: string | { message?: string }) => { clearTimeout(timer); s.off(SocketEventConstants.SFTP_EDIT_FILE_DONE, onDone); s.off(SocketEventConstants.SFTP_EMIT_ERROR, onErr); reject(new Error(typeof msg === "string" ? msg : msg?.message ?? "Save failed")); };
            s.on(SocketEventConstants.SFTP_EDIT_FILE_DONE, onDone);
            s.on(SocketEventConstants.SFTP_EMIT_ERROR, onErr);
            s.emit(SocketEventConstants.SFTP_EDIT_FILE_DONE, { path: filePath, content });
        });

    return {
        readFile,
        writeFile,
        createFile: (dirPath, name) => {
            const filePath = `${dirPath === "/" ? "" : dirPath}/${name}`;
            return emitAndForget(SocketEventConstants.SFTP_CREATE_FILE, { filePath });
        },
        createDir: (dirPath, name) => {
            const folderPath = `${dirPath === "/" ? "" : dirPath}/${name}`;
            return emitAndForget(SocketEventConstants.SFTP_CREATE_DIR, { folderPath });
        },
        rename: (oldPath, newName) => {
            const parentDir = oldPath.substring(0, oldPath.lastIndexOf("/")) || "/";
            const newPath = `${parentDir}/${newName}`;
            return emitAndForget(SocketEventConstants.SFTP_RENAME_FILE, { oldPath, newPath });
        },
        move: (oldPath, newPath) =>
            emitAndForget(SocketEventConstants.SFTP_MOVE_FILE, { oldPath, newPath }),
        copy: (sourcePath, destPath) =>
            emitAndForget(SocketEventConstants.SFTP_COPY_FILE, { currentPath: sourcePath, destinationPath: destPath }),
        deleteFile: (filePath) =>
            emitAndForget(SocketEventConstants.SFTP_DELETE_FILE, { path: filePath }),
        deleteDir: (dirPath) =>
            emitAndForget(SocketEventConstants.SFTP_DELETE_DIR, { path: dirPath }),
    };
}

// ═══════════════════════════════════════════════════════════════
//  REST API Handlers
// ═══════════════════════════════════════════════════════════════

export interface ApiHandlerOptions {
    /** Base URL for the REST API */
    apiUrl: string;
    /** Session or auth token */
    sessionId?: string;
    /** Extra headers (e.g. Authorization) */
    headers?: Record<string, string>;
}

/**
 * Build `FileOperationHandlers` backed by REST API calls.
 *
 * All operations go over HTTP — useful for environments where
 * sockets are unavailable or for specific ops like upload/download.
 */
export function createApiHandlers(opts: ApiHandlerOptions): FileOperationHandlers {
    const { apiUrl, sessionId, headers: extraHeaders } = opts;

    function buildHeaders(): Record<string, string> {
        return {
            "Content-Type": "application/json",
            ...(sessionId ? { "x-session-id": sessionId } : {}),
            ...extraHeaders,
        };
    }

    async function jsonRequest<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
        const res = await fetch(`${apiUrl}${path}`, {
            method,
            headers: buildHeaders(),
            ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        });
        if (!res.ok) {
            const text = await res.text().catch(() => res.statusText);
            throw new Error(`API ${method} ${path} failed: ${text}`);
        }
        const ct = res.headers.get("content-type") ?? "";
        return ct.includes("application/json") ? res.json() : (undefined as T);
    }

    return {
        readFile: (filePath) =>
            jsonRequest<string>("GET", `/files/read?path=${encodeURIComponent(filePath)}`),
        writeFile: (filePath, content) =>
            jsonRequest("PUT", `/files/write`, { path: filePath, content }).then(() => {}),
        createFile: (dirPath, name) =>
            jsonRequest("POST", `/files/create`, { dirPath, name, type: "file" }).then(() => {}),
        createDir: (dirPath, name) =>
            jsonRequest("POST", `/files/create`, { dirPath, name, type: "directory" }).then(() => {}),
        rename: (oldPath, newName) =>
            jsonRequest("PUT", `/files/rename`, { oldPath, newName }).then(() => {}),
        move: (oldPath, newPath) =>
            jsonRequest("PUT", `/files/move`, { oldPath, newPath }).then(() => {}),
        copy: (sourcePath, destPath) =>
            jsonRequest("POST", `/files/copy`, { sourcePath, destPath }).then(() => {}),
        deleteFile: (filePath) =>
            jsonRequest("DELETE", `/files/delete`, { path: filePath, type: "file" }).then(() => {}),
        deleteDir: (dirPath) =>
            jsonRequest("DELETE", `/files/delete`, { path: dirPath, type: "directory" }).then(() => {}),
        upload: async (files, targetDir) => {
            const formData = new FormData();
            formData.append("targetDir", targetDir);
            files.forEach((f) => formData.append("files", f));
            const res = await fetch(`${apiUrl}/files/upload`, {
                method: "POST",
                headers: {
                    ...(sessionId ? { "x-session-id": sessionId } : {}),
                    ...extraHeaders,
                },
                body: formData,
            });
            if (!res.ok) throw new Error(`Upload failed: ${res.statusText}`);
        },
        download: async (filePath) => {
            const res = await fetch(
                `${apiUrl}/files/download?path=${encodeURIComponent(filePath)}`,
                { headers: buildHeaders() },
            );
            if (!res.ok) throw new Error(`Download failed: ${res.statusText}`);
            return res.blob();
        },
    };
}

// ═══════════════════════════════════════════════════════════════
//  Compose Helpers
// ═══════════════════════════════════════════════════════════════

/**
 * Merge multiple partial handler objects into one complete `FileOperationHandlers`.
 * Later sources override earlier ones (like `Object.assign`).
 *
 * @example
 * ```ts
 * const handlers = composeHandlers(
 *   createSftpHandlers({ socket }),          // base: all CRUD via socket
 *   { upload: createApiUpload(apiUrl) },     // override upload → REST
 *   { download: createApiDownload(apiUrl) }, // override download → REST
 * );
 * ```
 */
export function composeHandlers(
    ...sources: Array<Partial<FileOperationHandlers>>
): FileOperationHandlers {
    return Object.assign({} as FileOperationHandlers, ...sources);
}
