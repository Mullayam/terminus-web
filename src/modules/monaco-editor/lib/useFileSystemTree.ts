/**
 * @module useFileSystemTree
 *
 * Generic React hook that drives the editor's file-tree sidebar using
 * any `FileSystemProvider` implementation.  Replaces the SFTP-specific
 * parts of the old `useEditorSftpTree` while keeping the same return shape.
 *
 * The hook manages:
 *   - provider connection lifecycle (connect, disconnect, status)
 *   - directory listing state (treeFiles, treeDir)
 *   - file read / write helpers
 *   - optional watcher subscriptions
 *   - Zustand store syncing (editorFsStore)
 *
 * All tree UI components remain untouched — they consume the same
 * props shape returned by this hook.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEditorFsStore } from "@/store/editorFsStore";
import type {
    FileSystemProvider,
    FileEntry,
    FsProviderStatus,
} from "./file-system-types";

/* ── Options ─────────────────────────────────────────────── */

export interface UseFileSystemTreeOptions {
    /** The file-system provider (SFTP, API, local, …) */
    provider: FileSystemProvider;
    /** Initial directory to display in the tree */
    initialDir: string;
    /** Unique session ID for Zustand store keying (auto-generated if omitted) */
    sessionId?: string;
    /** Whether to auto-connect on mount (default: false — user clicks "Connect") */
    autoConnect?: boolean;
    /** Extra metadata to store (host label, username) */
    meta?: { host?: string; username?: string };
}

/* ── Hook ────────────────────────────────────────────────── */

let _counter = 0;
function defaultSessionId() { return `fstree_${++_counter}_${Date.now()}`; }

export function useFileSystemTree({
    provider,
    initialDir,
    sessionId: externalSessionId,
    autoConnect = false,
    meta,
}: UseFileSystemTreeOptions) {
    /* ── Stable session ID ──────────────────────────────────── */
    const sessionId = useMemo(
        () => externalSessionId ?? defaultSessionId(),
        [externalSessionId],
    );

    const providerRef = useRef(provider);
    providerRef.current = provider;

    const { upsertSession } = useEditorFsStore();

    /* ── Sync provider status → Zustand ─────────────────────── */
    const [status, setStatus] = useState<FsProviderStatus>(provider.status);
    const [error, setError] = useState<string | undefined>(provider.error);

    useEffect(() => {
        // Seed initial store entry
        upsertSession(sessionId, {
            providerType: provider.type,
            status: provider.status,
            error: provider.error,
            host: meta?.host ?? "",
            username: meta?.username ?? "",
        });

        const unsub = provider.onStatusChange((s, e) => {
            setStatus(s);
            setError(e);
            upsertSession(sessionId, { status: s, error: e });
        });

        return () => {
            unsub();
            useEditorFsStore.getState().removeSession(sessionId);
        };
    }, [provider, sessionId]);

    /* ── Auto-connect (optional) ────────────────────────────── */
    useEffect(() => {
        if (autoConnect && provider.status === "idle") {
            provider.connect();
        }
    }, [autoConnect, provider]);

    /* ── Cleanup on unmount ─────────────────────────────────── */
    useEffect(() => {
        return () => { providerRef.current.disconnect(); };
    }, []);

    /* ── Connect (user-initiated) ───────────────────────────── */
    const connectToHost = useCallback(async () => {
        await providerRef.current.connect();
    }, []);

    /* ── Tree listing state ─────────────────────────────────── */
    const [treeFiles, setTreeFiles] = useState<FileEntry[]>([]);
    const [treeDir, setTreeDir] = useState(initialDir);
    const [treeCollapsed, setTreeCollapsed] = useState(false);

    const isConnected = status === "connected";

    // Fetch listing when connected or directory changes
    useEffect(() => {
        if (!isConnected) return;
        let cancelled = false;
        providerRef.current.readdir(treeDir).then((entries) => {
            if (!cancelled) setTreeFiles(entries);
        }).catch(() => { /* silent — status listener handles errors */ });
        return () => { cancelled = true; };
    }, [isConnected, treeDir]);

    // Optional watcher integration
    useEffect(() => {
        if (!isConnected || !providerRef.current.watchDir) return;
        return providerRef.current.watchDir(treeDir, (entries) => {
            setTreeFiles(entries);
        });
    }, [isConnected, treeDir]);

    /* ── Callbacks (stable refs) ────────────────────────────── */
    const handleTreeNavigate = useCallback((path: string) => {
        setTreeDir(path);
    }, []);

    const handleTreeRefresh = useCallback(() => {
        if (!isConnected) return;
        providerRef.current.readdir(treeDir).then(setTreeFiles).catch(() => {});
    }, [isConnected, treeDir]);

    /* ── File read / write ──────────────────────────────────── */
    const readFile = useCallback(
        (filePath: string): Promise<string> => providerRef.current.readFile(filePath),
        [],
    );

    const writeFile = useCallback(
        (filePath: string, content: string): Promise<void> => providerRef.current.writeFile(filePath, content),
        [],
    );

    return {
        /** The raw provider (escape hatch for plugin wiring, socket access, etc.) */
        provider,
        /** Whether the provider is connected and ready */
        isConnected,
        /** Current provider status */
        status,
        /** Error message (when status === "error") */
        statusError: error,
        /** File entries for the current directory */
        treeFiles,
        /** Current directory path */
        treeDir,
        /** Whether sidebar is collapsed */
        treeCollapsed,
        setTreeCollapsed,
        /** Navigate to a directory (sets treeDir → auto-fetches listing) */
        handleTreeNavigate,
        /** Re-fetch the current directory listing */
        handleTreeRefresh,
        /** Promise-based file read */
        readFile,
        /** Promise-based file write */
        writeFile,
        /** Initiate connection (user-triggered) */
        connectToHost,
        /** Session ID (for Zustand store keying) */
        sessionId,
    };
}
