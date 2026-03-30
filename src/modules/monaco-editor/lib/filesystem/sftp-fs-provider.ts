/**
 * @module SftpFileSystemProvider
 *
 * Concrete FileSystemProvider that communicates with the server via
 * a dedicated Socket.IO connection to the `/sftp` namespace.
 *
 * Extracts the socket lifecycle + emit/listen patterns that were
 * previously hard-coded in `useEditorSftpTree`.
 */
import { io, type Socket } from "socket.io-client";
import { __config } from "@/lib/config";
import { SocketEventConstants } from "@/lib/sockets/event-constants";
import { idb } from "@/lib/idb";
import type {
    FileSystemProvider,
    FileEntry,
    FsProviderStatus,
    FsStatusListener,
} from "./file-system-types";

/* ── Options ─────────────────────────────────────────────── */

export interface SftpFileSystemProviderOptions {
    /** Unique session ID for this provider instance (used as socket query param) */
    sessionId: string;
    /** Host identifier used to look up credentials in IndexedDB */
    hostUser?: string;
    /** Timeout for file read/write operations in ms (default 30 000) */
    timeout?: number;
}

/* ── Provider ────────────────────────────────────────────── */

export class SftpFileSystemProvider implements FileSystemProvider {
    readonly type = "sftp" as const;

    private _status: FsProviderStatus = "idle";
    private _error: string | undefined;
    private socket: Socket | null = null;
    private readonly listeners = new Set<FsStatusListener>();
    private readonly opts: Required<Pick<SftpFileSystemProviderOptions, "timeout">> &
        SftpFileSystemProviderOptions;

    /** Cached credentials for automatic reconnect */
    private cachedCreds: Record<string, unknown> | null = null;

    constructor(options: SftpFileSystemProviderOptions) {
        this.opts = { timeout: 30_000, ...options };
    }

    // ── Status ──────────────────────────────────────────────

    get status(): FsProviderStatus { return this._status; }
    get error(): string | undefined { return this._error; }

    onStatusChange(listener: FsStatusListener): () => void {
        this.listeners.add(listener);
        return () => { this.listeners.delete(listener); };
    }

    private setStatus(status: FsProviderStatus, error?: string) {
        this._status = status;
        this._error = error;
        this.listeners.forEach((cb) => cb(status, error));
    }

    // ── Connection ──────────────────────────────────────────

    /** Returns the live socket (for notification plugin etc.) */
    getSocket(): Socket | null { return this.socket; }

    async connect(): Promise<void> {
        if (this._status === "connected" || this._status === "connecting") return;
        this.setStatus("connecting");

        // Create dedicated socket
        const s = io(`${__config.API_URL}/sftp`, {
            query: { sessionId: this.opts.sessionId },
            autoConnect: true,
            forceNew: true,
            multiplex: false,
        });
        this.socket = s;

        // Wire core listeners
        s.on(SocketEventConstants.SFTP_READY, () => {
            this.setStatus("connected");
        });

        s.on(SocketEventConstants.SFTP_EMIT_ERROR, (msg: string) => {
            console.error("[SftpFS] error:", msg);
            this.setStatus("error", typeof msg === "string" ? msg : "SFTP error");
        });

        s.on("reconnect", () => {
            // Re-authenticate with cached credentials
            if (this.cachedCreds) {
                this.setStatus("connecting");
                s.emit(SocketEventConstants.SFTP_CONNECT, JSON.stringify(this.cachedCreds));
            }
        });

        // Lookup credentials from IndexedDB and authenticate
        if (this.opts.hostUser) {
            await this.authenticateFromIDB(s);
        }
    }

    disconnect(): void {
        if (this.socket) {
            this.socket.removeAllListeners();
            this.socket.disconnect();
            this.socket = null;
        }
        this.cachedCreds = null;
        this.setStatus("idle");
    }

    private async authenticateFromIDB(s: Socket): Promise<void> {
        try {
            const allHosts = await idb.getAllItems("hosts");
            const match = (allHosts as any[])?.find(
                (h: any) => h.host === this.opts.hostUser,
            );

            if (!match) {
                this.setStatus(
                    "error",
                    `No saved credentials found for host "${this.opts.hostUser}"`,
                );
                return;
            }

            const creds: Record<string, unknown> = {
                host: match.host,
                username: match.username,
                password: match.password ?? "",
                authMethod: match.authMethod ?? "password",
                ...(match.privateKeyText ? { privateKeyText: match.privateKeyText } : {}),
                ...(match.port ? { port: match.port } : {}),
            };
            this.cachedCreds = creds;

            // Wait for socket transport to be connected
            if (!s.connected) {
                await new Promise<void>((resolve) => {
                    s.once("connect", () => resolve());
                    setTimeout(resolve, 10_000);
                });
            }

            s.emit(SocketEventConstants.SFTP_CONNECT, JSON.stringify(creds));
        } catch (err: any) {
            this.setStatus("error", err?.message ?? "Failed to connect");
        }
    }

    // ── Directory listing ───────────────────────────────────

    readdir(dirPath: string): Promise<FileEntry[]> {
        return new Promise((resolve, reject) => {
            const s = this.socket;
            if (!s || !s.connected) {
                return reject(new Error("SFTP socket not connected"));
            }

            const timeout = setTimeout(() => {
                s.off(SocketEventConstants.SFTP_FILES_LIST, onList);
                reject(new Error("Directory listing timed out"));
            }, this.opts.timeout);

            const onList = (data: any) => {
                clearTimeout(timeout);
                s.off(SocketEventConstants.SFTP_FILES_LIST, onList);
                try {
                    const files = typeof data.files === "string"
                        ? JSON.parse(data.files)
                        : data.files;
                    resolve(Array.isArray(files) ? files : []);
                } catch {
                    resolve([]);
                }
            };

            s.on(SocketEventConstants.SFTP_FILES_LIST, onList);
            s.emit(SocketEventConstants.SFTP_GET_FILE, { dirPath });
        });
    }

    // ── File read / write ───────────────────────────────────

    readFile(filePath: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const s = this.socket;
            if (!s || !s.connected) {
                return reject(new Error("SFTP socket not connected"));
            }

            const timer = setTimeout(() => {
                s.off(SocketEventConstants.SFTP_EDIT_FILE_REQUEST_RESPONSE, onResponse);
                s.off(SocketEventConstants.SFTP_EMIT_ERROR, onError);
                reject(new Error("File read timed out"));
            }, this.opts.timeout);

            const onResponse = (data: string) => {
                clearTimeout(timer);
                s.off(SocketEventConstants.SFTP_EDIT_FILE_REQUEST_RESPONSE, onResponse);
                s.off(SocketEventConstants.SFTP_EMIT_ERROR, onError);
                resolve(data);
            };

            const onError = (msg: string | { message?: string }) => {
                clearTimeout(timer);
                s.off(SocketEventConstants.SFTP_EDIT_FILE_REQUEST_RESPONSE, onResponse);
                s.off(SocketEventConstants.SFTP_EMIT_ERROR, onError);
                reject(new Error(typeof msg === "string" ? msg : msg?.message ?? "Failed to read file"));
            };

            s.on(SocketEventConstants.SFTP_EDIT_FILE_REQUEST_RESPONSE, onResponse);
            s.on(SocketEventConstants.SFTP_EMIT_ERROR, onError);
            s.emit(SocketEventConstants.SFTP_EDIT_FILE_REQUEST, { path: filePath });
        });
    }

    writeFile(filePath: string, content: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const s = this.socket;
            if (!s || !s.connected) {
                return reject(new Error("SFTP socket not connected"));
            }

            const timer = setTimeout(() => {
                s.off(SocketEventConstants.SFTP_EDIT_FILE_DONE, onDone);
                s.off(SocketEventConstants.SFTP_EMIT_ERROR, onError);
                reject(new Error("File save timed out"));
            }, this.opts.timeout);

            const onDone = () => {
                clearTimeout(timer);
                s.off(SocketEventConstants.SFTP_EDIT_FILE_DONE, onDone);
                s.off(SocketEventConstants.SFTP_EMIT_ERROR, onError);
                resolve();
            };

            const onError = (msg: string | { message?: string }) => {
                clearTimeout(timer);
                s.off(SocketEventConstants.SFTP_EDIT_FILE_DONE, onDone);
                s.off(SocketEventConstants.SFTP_EMIT_ERROR, onError);
                reject(new Error(typeof msg === "string" ? msg : msg?.message ?? "Failed to save file"));
            };

            s.on(SocketEventConstants.SFTP_EDIT_FILE_DONE, onDone);
            s.on(SocketEventConstants.SFTP_EMIT_ERROR, onError);
            s.emit(SocketEventConstants.SFTP_EDIT_FILE_DONE, { path: filePath, content });
        });
    }

    // ── CRUD mutations ──────────────────────────────────────

    private emitAndForget(event: string, payload: Record<string, unknown>): Promise<void> {
        return new Promise((resolve, reject) => {
            const s = this.socket;
            if (!s || !s.connected) {
                return reject(new Error("SFTP socket not connected"));
            }
            s.emit(event, payload);
            // SFTP CRUD events are fire-and-forget — server doesn't ACK individually
            resolve();
        });
    }

    async createFile(dirPath: string, name: string): Promise<void> {
        const filePath = `${dirPath === "/" ? "" : dirPath}/${name}`;
        await this.emitAndForget(SocketEventConstants.SFTP_CREATE_FILE, { filePath });
    }

    async createDir(dirPath: string, name: string): Promise<void> {
        const folderPath = `${dirPath === "/" ? "" : dirPath}/${name}`;
        await this.emitAndForget(SocketEventConstants.SFTP_CREATE_DIR, { folderPath });
    }

    async rename(oldPath: string, newName: string): Promise<void> {
        const parentDir = oldPath.substring(0, oldPath.lastIndexOf("/")) || "/";
        const newPath = `${parentDir}/${newName}`;
        await this.emitAndForget(SocketEventConstants.SFTP_RENAME_FILE, { oldPath, newPath });
    }

    async move(oldPath: string, newPath: string): Promise<void> {
        await this.emitAndForget(SocketEventConstants.SFTP_MOVE_FILE, { oldPath, newPath });
    }

    async copy(sourcePath: string, destPath: string): Promise<void> {
        await this.emitAndForget(SocketEventConstants.SFTP_COPY_FILE, {
            currentPath: sourcePath,
            destinationPath: destPath,
        });
    }

    async deleteFile(filePath: string): Promise<void> {
        await this.emitAndForget(SocketEventConstants.SFTP_DELETE_FILE, { path: filePath });
    }

    async deleteDir(dirPath: string): Promise<void> {
        await this.emitAndForget(SocketEventConstants.SFTP_DELETE_DIR, { path: dirPath });
    }

    // ── Upload ──────────────────────────────────────────────

    async upload(files: File[], targetDir: string): Promise<void> {
        // SFTP upload uses REST (ApiCore.uploadFile) — delegate to the
        // existing API util rather than duplicating here.
        const { ApiCore } = await import("@/lib/api");
        await ApiCore.uploadFile(files, targetDir);
    }
}
