/**
 * @module editor/plugins/usePluginHost
 *
 * React hook that creates and manages a PluginHost instance,
 * wires it to the editor store, and provides a reactive snapshot
 * of plugin-contributed decorations, panels, completions, etc.
 *
 * Handles React 18 StrictMode correctly:
 *   - Effects fire → cleanup → re-fire.
 *   - Uses registerAll/unregisterAll for O(1) emit batching.
 *   - registeredIdsRef is cleared on cleanup so plugins re-register fresh.
 */
import { useRef, useEffect, useSyncExternalStore, useCallback, useMemo } from "react";
import { useEditorStoreApi, useEditorStore, useEditorRefs } from "../state/context";
import { PluginHost } from "./PluginHost";
import type { ExtendedEditorPlugin, PluginHostState } from "./types";
import { debounce } from "../core/utils";

interface UsePluginHostResult {
    host: PluginHost;
    snapshot: PluginHostState;
}

export function usePluginHost(
    plugins: ExtendedEditorPlugin[],
    contentChangeDebounce = 300,
): UsePluginHostResult {
    const storeApi = useEditorStoreApi();
    const { textareaRef } = useEditorRefs();
    const content = useEditorStore((s) => s.content);
    const language = useEditorStore((s) => s.language);
    const cursorLine = useEditorStore((s) => s.cursorLine);
    const cursorCol = useEditorStore((s) => s.cursorCol);

    // Create PluginHost once — persists across renders.
    const hostRef = useRef<PluginHost | null>(null);
    if (!hostRef.current) {
        hostRef.current = new PluginHost(storeApi, textareaRef);
    }
    const host = hostRef.current;

    // Track registered IDs for diffing.
    const registeredIdsRef = useRef<Set<string>>(new Set());

    // ── Register / unregister plugins (batched, StrictMode-safe) ──
    useEffect(() => {
        const newIds = new Set(plugins.map((p) => p.id));

        // Collect plugins to add / remove
        const toAdd = plugins.filter((p) => !registeredIdsRef.current.has(p.id));
        const toRemove: string[] = [];
        for (const id of registeredIdsRef.current) {
            if (!newIds.has(id)) toRemove.push(id);
        }

        // Batch register new plugins (single emit)
        if (toAdd.length > 0) {
            host.registerAll(toAdd);
            for (const p of toAdd) registeredIdsRef.current.add(p.id);
        }

        // Batch unregister removed plugins (single emit)
        if (toRemove.length > 0) {
            host.unregisterAll(toRemove);
            for (const id of toRemove) registeredIdsRef.current.delete(id);
        }

        // Cleanup: unregister everything (StrictMode will re-fire and re-register)
        return () => {
            if (registeredIdsRef.current.size > 0) {
                host.unregisterAll(registeredIdsRef.current);
                registeredIdsRef.current.clear();
            }
        };
    }, [plugins, host]);

    // ── Dispatch content changes (debounced) ──
    const debouncedContentChange = useMemo(
        () => debounce(
            ((c: unknown) => host.dispatchContentChange(c as string)) as (...args: unknown[]) => unknown,
            contentChangeDebounce,
        ),
        [host, contentChangeDebounce],
    );

    useEffect(() => {
        debouncedContentChange(content);
    }, [content, debouncedContentChange]);

    // ── Dispatch language changes ──
    const prevLangRef = useRef(language);
    useEffect(() => {
        if (language !== prevLangRef.current) {
            prevLangRef.current = language;
            host.dispatchLanguageChange(language);
        }
    }, [language, host]);

    // ── Dispatch selection / cursor changes ──
    const prevCursorRef = useRef({ line: cursorLine, col: cursorCol });
    useEffect(() => {
        const prev = prevCursorRef.current;
        if (cursorLine !== prev.line || cursorCol !== prev.col) {
            prevCursorRef.current = { line: cursorLine, col: cursorCol };
            const ta = textareaRef.current;
            const start = ta?.selectionStart ?? 0;
            const end = ta?.selectionEnd ?? 0;
            const text = (start !== end && ta) ? ta.value.slice(start, end) : "";
            host.dispatchSelectionChange({ start, end, text });
        }
    }, [cursorLine, cursorCol, host, textareaRef]);

    // ── Reactive snapshot ──
    const subscribe = useCallback((cb: () => void) => host.subscribe(cb), [host]);
    const getSnapshot = useCallback(() => host.getSnapshot(), [host]);
    const snapshot = useSyncExternalStore(subscribe, getSnapshot);

    return { host, snapshot };
}
