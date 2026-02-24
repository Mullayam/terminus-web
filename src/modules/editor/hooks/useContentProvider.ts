/**
 * @module editor/hooks/useContentProvider
 * Handles initial content fetch on mount and save operations via a ContentProvider.
 */
import { useEffect, useCallback, useRef } from "react";
import { useEditorStoreApi } from "../state/context";
import type { ContentProvider } from "../types";

interface ContentProviderOpts {
    provider: ContentProvider;
    sessionId: string;
    remotePath: string;
}

export function useContentProvider(opts: ContentProviderOpts) {
    const storeApi = useEditorStoreApi();
    const loaded = useRef(false);

    /* ── Fetch on mount ────────────────────────── */
    useEffect(() => {
        if (loaded.current) return;
        loaded.current = true;

        const s = storeApi.getState();
        s.setLoading(true);

        opts.provider
            .fetchContent(opts.sessionId, opts.remotePath)
            .then((result) => {
                if (result.error) {
                    s.setError(result.error);
                    return;
                }
                s.initContent(result.content);
                const fileName = opts.remotePath.split("/").pop() ?? opts.remotePath;
                s.setFileInfo({ fileName, filePath: opts.remotePath, sessionId: opts.sessionId });
            })
            .catch((err) => {
                s.setError(err instanceof Error ? err.message : String(err));
            })
            .finally(() => {
                s.setLoading(false);
            });
    }, [opts.provider, opts.sessionId, opts.remotePath, storeApi]);

    /* ── Save callback ─────────────────────────── */
    const save = useCallback(async () => {
        const s = storeApi.getState();
        if (s.saving || !s.modified) return;
        s.setSaving(true);
        try {
            const result = await opts.provider.saveContent(opts.sessionId, opts.remotePath, s.content);
            if (result.error) {
                s.setError(result.error);
                return;
            }
            // After save, mark content as non-dirty by re-initializing the baseline
            s.initContent(s.content);
            s.setLastSaved(new Date());
        } catch (err) {
            s.setError(err instanceof Error ? err.message : String(err));
        } finally {
            s.setSaving(false);
        }
    }, [opts.provider, opts.sessionId, opts.remotePath, storeApi]);

    /* ── Reload callback ───────────────────────── */
    const reload = useCallback(async () => {
        const s = storeApi.getState();
        s.setLoading(true);
        try {
            const result = await opts.provider.fetchContent(opts.sessionId, opts.remotePath);
            if (result.error) {
                s.setError(result.error);
                return;
            }
            s.initContent(result.content);
        } catch (err) {
            s.setError(err instanceof Error ? err.message : String(err));
        } finally {
            s.setLoading(false);
        }
    }, [opts.provider, opts.sessionId, opts.remotePath, storeApi]);

    return { save, reload };
}
