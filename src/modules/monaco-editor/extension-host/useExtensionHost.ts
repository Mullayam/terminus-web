/**
 * @module useExtensionHost
 *
 * React hook that starts the custom Extension Host on mount and
 * tears it down on unmount.  Designed to be called once per editor
 * session (typically in the top-level editor page component).
 *
 * Usage:
 *   const { host, ready, error } = useExtensionHost({ enabled: true });
 */

import { useEffect, useRef, useState } from "react";
import { ExtensionHostMain } from "./runtime/ext-host-main";
import type { WorkspaceFileSystem } from "./workspace/workspace-bridge";

export interface UseExtensionHostOptions {
    /** Whether to start the host. When false the hook is a no-op. */
    enabled?: boolean;
    /** Optional workspace FS implementation for file-system commands. */
    fileSystem?: WorkspaceFileSystem;
    /** Workspace root used by the workspace API. */
    workspaceRoot?: string;
}

export interface UseExtensionHostReturn {
    host: ExtensionHostMain | null;
    ready: boolean;
    error: string | null;
}

/**
 * The worker URL is resolved once at module level so Vite can bundle
 * or reference the worker entry correctly via `import.meta.url`.
 */
const workerUrl = new URL("./runtime/ext-host-worker.ts", import.meta.url);

export function useExtensionHost(
    options: UseExtensionHostOptions = {},
): UseExtensionHostReturn {
    const { enabled = true, fileSystem, workspaceRoot } = options;
    const [ready, setReady] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const hostRef = useRef<ExtensionHostMain | null>(null);

    useEffect(() => {
        if (!enabled) return;

        let disposed = false;
        const host = new ExtensionHostMain({
            workerUrl,
            fileSystem,
            workspaceRoot,
        });
        hostRef.current = host;

        host.start()
            .then(() => {
                if (!disposed) setReady(true);
            })
            .catch((err) => {
                if (!disposed) {
                    console.error("[ExtensionHost] Failed to start:", err);
                    setError(err instanceof Error ? err.message : String(err));
                }
            });

        return () => {
            disposed = true;
            host.dispose();
            hostRef.current = null;
            setReady(false);
            setError(null);
        };
        // Only restart if enabled changes
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled]);

    return { host: hostRef.current, ready, error };
}
