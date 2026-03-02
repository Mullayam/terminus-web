/**
 * @module useEditorSftpTree
 *
 * Custom hook that owns a dedicated SFTP socket connection for
 * the Monaco editor's file-tree sidebar.  It connects independently
 * from the main page so that tree state changes (navigate, refresh)
 * never cause the editor to re-render.
 *
 * The connection is NOT automatic — the user must click "Connect"
 * in the file tree, which calls `connectToHost()`.  Credentials are
 * fetched from IndexedDB by matching `hostUser` (the `host` field).
 *
 * Connection state lives in `editorSftpStore` (separate from sftpStore).
 *
 * Returns:
 *  - treeFiles / treeDir / treeCollapsed  — sidebar list state
 *  - handlers: handleTreeNavigate, handleTreeRefresh, handleTreeFileOpen
 *  - readFileViaSocket — promise-based file read for opening tabs
 *  - editorSftpReady — whether the dedicated session is alive
 *  - connectToHost    — initiates the SFTP session (called after user confirms)
 *  - editorSftpStatus — idle | connecting | connected | error
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { __config } from "@/lib/config";
import { SocketEventConstants } from "@/lib/sockets/event-constants";
import { idb } from "@/lib/idb";
import {
    useEditorSftpStore,
    type EditorSftpStatus,
} from "@/store/editorSftpStore";
import { nanoid } from "../../utils/nanoid";

export interface UseEditorSftpTreeOptions {
    /** Parent tab's sessionId (used as a unique key) */
    sessionId: string;
    /** Initial directory for the tree (usually the file's parent dir) */
    initialDir: string;
    /** The host value from query-params (`user` param) — used to look up creds in IDB */
    hostUser?: string;
}

export function useEditorSftpTree({ sessionId, initialDir, hostUser }: UseEditorSftpTreeOptions) {
    /* ── Dedicated socket ───────────────────────────────────── */
    const editorSessionId = useMemo(() => nanoid(), []);
    const sftpSocketRef = useRef<Socket | null>(null);
    const [socket, setSocket] = useState<Socket | null>(null);
    const [editorSftpReady, setEditorSftpReady] = useState(false);

    /** Credentials stored after lookup so we can re-emit on reconnect */
    const credsRef = useRef<{
        host: string;
        username: string;
        password: string;
        authMethod: string;
    } | null>(null);

    const { upsertSession } = useEditorSftpStore();

    /* ── Socket lifecycle ───────────────────────────────────── */
    useEffect(() => {
        if (!sessionId) return;

        const s = io(`${__config.API_URL}/sftp`, {
            query: { sessionId: editorSessionId },
            autoConnect: true,
            forceNew: true,
            multiplex: false,
        });
        sftpSocketRef.current = s;
        setSocket(s);

        const onSftpReady = () => {
            setEditorSftpReady(true);
            upsertSession(editorSessionId, { status: "connected" });
        };

        const onSftpError = (msg: string) => {
            console.error("[EditorSFTP] error:", msg);
            upsertSession(editorSessionId, {
                status: "error",
                error: typeof msg === "string" ? msg : "SFTP error",
            });
        };

        const onReconnect = () => {
            setEditorSftpReady(false);
            // Re-emit SFTP_CONNECT with cached credentials on reconnect
            if (credsRef.current) {
                upsertSession(editorSessionId, { status: "connecting" });
                s.emit(
                    SocketEventConstants.SFTP_CONNECT,
                    JSON.stringify(credsRef.current),
                );
            }
        };

        s.on(SocketEventConstants.SFTP_READY, onSftpReady);
        s.on(SocketEventConstants.SFTP_EMIT_ERROR, onSftpError);
        s.on("reconnect", onReconnect);

        return () => {
            s.off(SocketEventConstants.SFTP_READY, onSftpReady);
            s.off(SocketEventConstants.SFTP_EMIT_ERROR, onSftpError);
            s.off("reconnect", onReconnect);
            s.removeAllListeners();
            s.disconnect();
            sftpSocketRef.current = null;
            // Clean up store entry
            useEditorSftpStore.getState().removeSession(editorSessionId);
        };
    }, [sessionId, editorSessionId]);

    /* ── connectToHost — user-initiated connection ─────────── */
    const connectToHost = useCallback(async () => {
        const s = sftpSocketRef.current;
        if (!s || !hostUser) return;

        upsertSession(editorSessionId, { status: "connecting", host: hostUser });

        try {
            // Look up host credentials from IndexedDB
            const allHosts = await idb.getAllItems("hosts");
            const match = (allHosts as any[])?.find(
                (h: any) => h.host === hostUser,
            );

            if (!match) {
                upsertSession(editorSessionId, {
                    status: "error",
                    error: `No saved credentials found for host "${hostUser}"`,
                });
                return;
            }

            const creds = {
                host: match.host,
                username: match.username,
                password: match.password ?? "",
                authMethod: match.authMethod ?? "password",
                ...(match.privateKeyText ? { privateKeyText: match.privateKeyText } : {}),
                ...(match.port ? { port: match.port } : {}),
            };
            credsRef.current = creds;

            upsertSession(editorSessionId, {
                host: match.host,
                username: match.username,
            });

            // Wait until socket is connected before emitting
            if (!s.connected) {
                await new Promise<void>((resolve) => {
                    s.once("connect", () => resolve());
                    // Safety: timeout after 10 s
                    setTimeout(resolve, 10_000);
                });
            }

            s.emit(SocketEventConstants.SFTP_CONNECT, JSON.stringify(creds));
        } catch (err: any) {
            upsertSession(editorSessionId, {
                status: "error",
                error: err?.message ?? "Failed to connect",
            });
        }
    }, [editorSessionId, hostUser, upsertSession]);

    /* ── Derive status from store ──────────────────────────── */
    const editorSftpStatus: EditorSftpStatus =
        useEditorSftpStore((s) => s.sessions[editorSessionId]?.status) ?? "idle";
    const editorSftpError: string | undefined =
        useEditorSftpStore((s) => s.sessions[editorSessionId]?.error);

    /* ── Tree listing state ─────────────────────────────────── */
    const [treeFiles, setTreeFiles] = useState<any[]>([
         
    ]);
    const [treeDir, setTreeDir] = useState(initialDir);
    const [treeCollapsed, setTreeCollapsed] = useState(false);

    // Fetch initial listing once ready
    useEffect(() => {
        if (!socket || !editorSftpReady) return;
        socket.emit(SocketEventConstants.SFTP_GET_FILE, { dirPath: treeDir });
    }, [socket, editorSftpReady]);

    // Re-fetch on directory change
    useEffect(() => {
        if (!socket || !treeDir || !editorSftpReady) return;
        socket.emit(SocketEventConstants.SFTP_GET_FILE, { dirPath: treeDir });
    }, [socket, treeDir, editorSftpReady]);

    // Listen for file-list events
    useEffect(() => {
        if (!socket) return;
        const onFileList = (data: any) => {
            try {
                const files = typeof data.files === "string" ? JSON.parse(data.files) : data.files;
                if (Array.isArray(files)) {
                    setTreeFiles(files);
                    if (data.currentDir) setTreeDir(data.currentDir);
                }
            } catch { /* ignore parse errors */ }
        };
        socket.on(SocketEventConstants.SFTP_FILES_LIST, onFileList);
        return () => { socket.off(SocketEventConstants.SFTP_FILES_LIST, onFileList); };
    }, [socket]);

    /* ── Callbacks (stable refs) ────────────────────────────── */
    const handleTreeNavigate = useCallback((path: string) => {
        setTreeDir(path);
    }, []);

    const handleTreeRefresh = useCallback(() => {
        if (!socket || !treeDir) return;
        socket.emit(SocketEventConstants.SFTP_GET_FILE, { dirPath: treeDir });
    }, [socket, treeDir]);

    /* ── readFileViaSocket (for opening files in tabs) ──────── */
    const readFileViaSocket = useCallback(
        (remotePath: string): Promise<string> => {
            return new Promise((resolve, reject) => {
                const s = sftpSocketRef.current;
                if (!s || !s.connected) {
                    return reject(new Error("SFTP socket not connected"));
                }

                const timeout = setTimeout(() => {
                    s.off(SocketEventConstants.SFTP_EDIT_FILE_REQUEST_RESPONSE, onResponse);
                    s.off(SocketEventConstants.SFTP_EMIT_ERROR, onError);
                    reject(new Error("File read timed out"));
                }, 30_000);

                const onResponse = (data: string) => {
                    clearTimeout(timeout);
                    s.off(SocketEventConstants.SFTP_EDIT_FILE_REQUEST_RESPONSE, onResponse);
                    s.off(SocketEventConstants.SFTP_EMIT_ERROR, onError);
                    resolve(data);
                };

                const onError = (msg: string | { message?: string }) => {
                    clearTimeout(timeout);
                    s.off(SocketEventConstants.SFTP_EDIT_FILE_REQUEST_RESPONSE, onResponse);
                    s.off(SocketEventConstants.SFTP_EMIT_ERROR, onError);
                    reject(
                        new Error(typeof msg === "string" ? msg : msg?.message ?? "Failed to read file"),
                    );
                };

                s.on(SocketEventConstants.SFTP_EDIT_FILE_REQUEST_RESPONSE, onResponse);
                s.on(SocketEventConstants.SFTP_EMIT_ERROR, onError);
                s.emit(SocketEventConstants.SFTP_EDIT_FILE_REQUEST, { path: remotePath });
            });
        },
        [],
    );

    return {
        /** The raw socket (needed for notification plugin) */
        socket,
        /** Ref to the raw SFTP socket (for file operations) */
        sftpSocketRef,
        editorSftpReady,
        treeFiles,
        treeDir,
        treeCollapsed,
        setTreeCollapsed,
        handleTreeNavigate,
        handleTreeRefresh,
        readFileViaSocket,
        /** Initiates the SFTP connection (user must confirm first) */
        connectToHost,
        /** Current connection status: idle | connecting | connected | error */
        editorSftpStatus,
        /** Error message (if status === "error") */
        editorSftpError,
    };
}
