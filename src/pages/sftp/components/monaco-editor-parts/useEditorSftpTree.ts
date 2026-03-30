/**
 * @module useEditorSftpTree
 *
 * Thin SFTP-specific wrapper around the generic `useFileSystemTree` hook
 * and `SftpFileSystemProvider`.
 *
 * Preserves the exact same return shape so existing consumers
 * (FileEditorMonacoPage, FileTreePanel, etc.) need zero changes.
 *
 * Direct socket access is still exposed (`socket`, `sftpSocketRef`)
 * for the notification plugin and legacy `useFileOperations` callers.
 */
import { useMemo, useRef } from "react";
import type { Socket } from "socket.io-client";
import { SftpFileSystemProvider } from "@/modules/monaco-editor/lib/filesystem/sftp-fs-provider";
import { useFileSystemTree } from "@/modules/monaco-editor/lib/filesystem/useFileSystemTree";
import type { FsProviderStatus } from "@/modules/monaco-editor/lib/filesystem/file-system-types";

export interface UseEditorSftpTreeOptions {
    /** Parent tab's sessionId (used as a unique key) */
    sessionId: string;
    /** Initial directory for the tree (usually the file's parent dir) */
    initialDir: string;
    /** The host value from query-params (`user` param) — used to look up creds in IDB */
    hostUser?: string;
}

export function useEditorSftpTree({ sessionId, initialDir, hostUser }: UseEditorSftpTreeOptions) {
    /* ── Create the SFTP provider (stable across renders) ──── */
    const provider = useMemo(
        () => new SftpFileSystemProvider({ sessionId, hostUser }),
        [sessionId, hostUser],
    );

    /* ── Delegate to generic hook ──────────────────────────── */
    const tree = useFileSystemTree({
        provider,
        initialDir,
        sessionId,
        autoConnect: false,   // User clicks "Connect"
        meta: { host: hostUser },
    });

    /* ── Backward-compat: expose raw socket + ref ──────────── */
    const rawSocket: Socket | null = provider.getSocket?.() ?? null;
    const sftpSocketRef = useRef<Socket | null>(null);
    sftpSocketRef.current = rawSocket;

    /* ── Map generic status names to legacy field names ─────── */
    const editorSftpReady = tree.isConnected;
    const editorSftpStatus: FsProviderStatus = tree.status;
    const editorSftpError = tree.statusError;

    return {
        /** The raw socket (needed by notification plugin) */
        socket: rawSocket,
        /** Ref to the raw SFTP socket (for legacy file operations) */
        sftpSocketRef,
        editorSftpReady,
        treeFiles: tree.treeFiles,
        treeDir: tree.treeDir,
        treeCollapsed: tree.treeCollapsed,
        setTreeCollapsed: tree.setTreeCollapsed,
        handleTreeNavigate: tree.handleTreeNavigate,
        handleTreeRefresh: tree.handleTreeRefresh,
        readFileViaSocket: tree.readFile,
        /** Save a file through the editor's own SFTP socket */
        writeFileViaSocket: tree.writeFile,
        /** Initiates the SFTP connection (user must confirm first) */
        connectToHost: tree.connectToHost,
        /** Current connection status: idle | connecting | connected | error */
        editorSftpStatus,
        /** Error message (if status === "error") */
        editorSftpError,
        /** The underlying FileSystemProvider (for new provider-based callers) */
        provider,
    };
}
