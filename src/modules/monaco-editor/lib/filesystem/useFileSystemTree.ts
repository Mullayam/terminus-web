/**
 * @module useFileSystemTree
 *
 * Generic React hook that drives the editor's file-tree sidebar using
 * any `FileSystemProvider` implementation.
 *
 * Performance features (from Performance.txt):
 *
 *   1. **Lazy loading** — only the *current* directory is fetched;
 *      sub-folders are fetched on expand (navigate). ✅
 *   2. **Caching** — `DirCache` (LRU + TTL) avoids re-fetching
 *      already-loaded directories.  Watcher & mutations invalidate
 *      only the affected directory. ✅
 *   3. **Smart ignoring** — `IgnoreConfig` filters out node_modules,
 *      .git, dist, etc.  Filtered entries are never rendered. ✅
 *   4. **Pagination** — `PAGE_SIZE` limits entries per directory;
 *      `loadMore()` fetches the next page. ✅
 *   5. **Perceived performance** — show cached data immediately while
 *      a background re-fetch updates it (stale-while-revalidate). ✅
 *
 * Virtualization is handled by the UI layer (EditorFileTree +
 * react-window), not by this hook.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEditorFsStore } from "@/store/editorFsStore";
import type {
    FileSystemProvider,
    FileEntry,
    FsProviderStatus,
    IgnoreConfig,
} from "./file-system-types";
import { DEFAULT_IGNORED_NAMES } from "./file-system-types";
import { DirCache } from "./DirCache";
import { filterEntries, paginateEntries } from "./filterEntries";

/* ── Defaults ────────────────────────────────────────────── */

const DEFAULT_PAGE_SIZE = 200;
const DEFAULT_CACHE_TTL = 60_000; // 1 min

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
    /**
     * Smart-ignore config.  Defaults to hiding `node_modules`, `.git`,
     * `dist`, `build`, etc.  Set `{ disabled: true }` to show everything.
     */
    ignore?: IgnoreConfig;
    /** Entries per page. `0` = unlimited.  Default 200. */
    pageSize?: number;
    /** Cache TTL in ms.  Default 60 000 (1 minute). */
    cacheTTL?: number;
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
    ignore,
    pageSize = DEFAULT_PAGE_SIZE,
    cacheTTL = DEFAULT_CACHE_TTL,
}: UseFileSystemTreeOptions) {
    /* ── Stable session ID ──────────────────────────────────── */
    const sessionId = useMemo(
        () => externalSessionId ?? defaultSessionId(),
        [externalSessionId],
    );

    const providerRef = useRef(provider);
    providerRef.current = provider;

    const { upsertSession } = useEditorFsStore();

    /* ── Directory cache (LRU + TTL) ────────────────────────── */
    const cacheRef = useRef(new DirCache({ ttl: cacheTTL }));

    /* ── Resolve effective IgnoreConfig ─────────────────────── */
    const effectiveIgnore = useMemo<IgnoreConfig>(
        () => ignore ?? { names: DEFAULT_IGNORED_NAMES },
        [ignore],
    );

    /* ── Sync provider status → Zustand ─────────────────────── */
    const [status, setStatus] = useState<FsProviderStatus>(provider.status);
    const [error, setError] = useState<string | undefined>(provider.error);

    useEffect(() => {
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

    /** Total entries (pre-pagination) for the current directory. */
    const [totalEntries, setTotalEntries] = useState(0);
    /** Whether more entries are available beyond the current page. */
    const [hasMore, setHasMore] = useState(false);
    /** Current pagination offset. */
    const offsetRef = useRef(0);
    /** Current cursor token for cursor-based pagination. */
    const cursorRef = useRef<string | undefined>(undefined);

    const isConnected = status === "connected";

    /* ── Core fetch helper (cache-aware + filter + paginate) ── */
    const fetchDir = useCallback(
        async (dir: string, opts?: { noCache?: boolean; append?: boolean }) => {
            const cache = cacheRef.current;
            const noCache = opts?.noCache ?? false;
            const append = opts?.append ?? false;

            // 1. Try cache first (stale-while-revalidate: show immediately)
            let cached: FileEntry[] | undefined;
            if (!noCache) {
                cached = cache.get(dir);
            }

            if (cached && !append) {
                // Show cached data instantly
                const filtered = filterEntries(cached, effectiveIgnore);
                const { page, total, hasMore: more, nextCursor } = paginateEntries(filtered, pageSize, 0);
                setTreeFiles(page);
                setTotalEntries(total);
                setHasMore(more);
                offsetRef.current = page.length;
                cursorRef.current = nextCursor;
            }

            // 2. Fetch from provider in background (or foreground if no cache)
            try {
                const raw = await providerRef.current.readdir(dir);
                cache.set(dir, raw);

                const filtered = filterEntries(raw, effectiveIgnore);

                if (append) {
                    // Pagination: append next page (using cursor OR offset)
                    const { page, total, hasMore: more, nextCursor } = paginateEntries(
                        filtered, pageSize, offsetRef.current, cursorRef.current,
                    );
                    setTreeFiles((prev) => [...prev, ...page]);
                    setTotalEntries(total);
                    setHasMore(more);
                    offsetRef.current += page.length;
                    cursorRef.current = nextCursor;
                } else {
                    // Fresh load (page 1)
                    const { page, total, hasMore: more, nextCursor } = paginateEntries(filtered, pageSize, 0);
                    setTreeFiles(page);
                    setTotalEntries(total);
                    setHasMore(more);
                    offsetRef.current = page.length;
                    cursorRef.current = nextCursor;
                }
            } catch {
                // If we already showed cached data, keep it visible.
                // Otherwise the status listener will surface the error.
            }
        },
        [effectiveIgnore, pageSize],
    );

    /* ── Fetch listing when connected or directory changes ──── */
    useEffect(() => {
        if (!isConnected) return;
        offsetRef.current = 0;
        cursorRef.current = undefined;
        fetchDir(treeDir);
    }, [isConnected, treeDir, fetchDir]);

    /* ── File watcher → invalidate cache + re-fetch ─────────── */
    useEffect(() => {
        if (!isConnected || !providerRef.current.watchDir) return;
        return providerRef.current.watchDir(treeDir, (entries) => {
            // Watcher provides the full new listing — update cache & state
            cacheRef.current.set(treeDir, entries);
            const filtered = filterEntries(entries, effectiveIgnore);
            const { page, total, hasMore: more, nextCursor } = paginateEntries(filtered, pageSize, 0);
            setTreeFiles(page);
            setTotalEntries(total);
            setHasMore(more);
            offsetRef.current = page.length;
            cursorRef.current = nextCursor;
        });
    }, [isConnected, treeDir, effectiveIgnore, pageSize]);

    /* ── Callbacks (stable refs) ────────────────────────────── */
    const handleTreeNavigate = useCallback((path: string) => {
        setTreeDir(path);
    }, []);

    /**
     * Force re-fetch the current directory (cache bypass).
     * Also invalidates children so next expand re-fetches.
     */
    const handleTreeRefresh = useCallback(() => {
        if (!isConnected) return;
        cacheRef.current.invalidate(treeDir);
        cacheRef.current.invalidateChildren(treeDir);
        offsetRef.current = 0;
        cursorRef.current = undefined;
        fetchDir(treeDir, { noCache: true });
    }, [isConnected, treeDir, fetchDir]);

    /**
     * Load next page of entries (pagination).
     * Called when user scrolls to end of the tree list.
     */
    const loadMoreEntries = useCallback(() => {
        if (!isConnected || !hasMore) return;
        fetchDir(treeDir, { append: true });
    }, [isConnected, hasMore, treeDir, fetchDir]);

    /* ── File read / write ──────────────────────────────────── */
    const readFile = useCallback(
        (filePath: string): Promise<string> => providerRef.current.readFile(filePath),
        [],
    );

    const writeFile = useCallback(
        (filePath: string, content: string): Promise<void> => providerRef.current.writeFile(filePath, content),
        [],
    );

    /**
     * Invalidate cache for a specific directory.
     * Called by `useFileOperations` after mutations so the next
     * navigate/refresh picks up changes.
     */
    const invalidateDir = useCallback((dirPath: string) => {
        cacheRef.current.invalidate(dirPath);
    }, []);

    return {
        /** The raw provider (escape hatch for plugin wiring, socket access, etc.) */
        provider,
        /** Whether the provider is connected and ready */
        isConnected,
        /** Current provider status */
        status,
        /** Error message (when status === "error") */
        statusError: error,
        /** File entries for the current directory (filtered + paginated) */
        treeFiles,
        /** Current directory path */
        treeDir,
        /** Whether sidebar is collapsed */
        treeCollapsed,
        setTreeCollapsed,
        /** Navigate to a directory (sets treeDir → auto-fetches listing) */
        handleTreeNavigate,
        /** Re-fetch the current directory listing (cache bypass) */
        handleTreeRefresh,
        /** Promise-based file read */
        readFile,
        /** Promise-based file write */
        writeFile,
        /** Initiate connection (user-triggered) */
        connectToHost,
        /** Session ID (for Zustand store keying) */
        sessionId,

        /* ── Pagination ─────────────────────────────── */
        /** Total entries in current directory (pre-pagination) */
        totalEntries,
        /** Whether more entries are available */
        hasMore,
        /** Load next page of entries */
        loadMoreEntries,

        /* ── Cache control ──────────────────────────── */
        /** Invalidate cache for a specific directory (after mutations) */
        invalidateDir,

        /** The DirCache instance (escape hatch for advanced use) */
        dirCache: cacheRef.current,
    };
}
