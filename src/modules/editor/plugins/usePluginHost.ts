/**
 * @module editor/plugins/usePluginHost
 *
 * React hook that creates and manages a PluginHost instance,
 * wires it to the editor store, and provides a reactive snapshot
 * of plugin-contributed decorations, panels, completions, etc.
 *
 * Usage inside <EditorInner>:
 *   const pluginHost = usePluginHost(plugins);
 *   // pluginHost.snapshot contains all decorations, panels, etc.
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

/**
 * Hook that manages the plugin host lifecycle.
 * @param plugins - Array of plugins to register
 * @param contentChangeDebounce - Debounce delay for content change events (ms)
 */
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

    // Create PluginHost once
    const hostRef = useRef<PluginHost | null>(null);
    if (!hostRef.current) {
        hostRef.current = new PluginHost(storeApi, textareaRef);
    }
    const host = hostRef.current;

    // Register plugins on mount / when plugin list changes
    const registeredIdsRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        const newIds = new Set(plugins.map((p) => p.id));

        // Register new plugins
        for (const plugin of plugins) {
            if (!registeredIdsRef.current.has(plugin.id)) {
                host.register(plugin);
                registeredIdsRef.current.add(plugin.id);
            }
        }

        // Unregister removed plugins
        for (const id of registeredIdsRef.current) {
            if (!newIds.has(id)) {
                host.unregister(id);
                registeredIdsRef.current.delete(id);
            }
        }
    }, [plugins, host]);

    // Dispatch content changes (debounced)
    const debouncedContentChange = useMemo(
        () => debounce(((c: unknown) => host.dispatchContentChange(c as string)) as (...args: unknown[]) => unknown, contentChangeDebounce),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [host, contentChangeDebounce],
    );

    useEffect(() => {
        debouncedContentChange(content);
    }, [content, debouncedContentChange]);

    // Dispatch language changes
    const prevLangRef = useRef(language);
    useEffect(() => {
        if (language !== prevLangRef.current) {
            prevLangRef.current = language;
            host.dispatchLanguageChange(language);
        }
    }, [language, host]);

    // Dispatch selection / cursor changes
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

    // Reactive snapshot via useSyncExternalStore
    const subscribe = useCallback((cb: () => void) => host.subscribe(cb), [host]);
    const getSnapshot = useCallback(() => host.getSnapshot(), [host]);
    const snapshot = useSyncExternalStore(subscribe, getSnapshot);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            host.destroy();
        };
    }, [host]);

    return { host, snapshot };
}
