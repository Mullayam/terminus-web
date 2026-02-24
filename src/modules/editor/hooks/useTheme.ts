/**
 * @module editor/hooks/useTheme
 * Applies the active theme's CSS custom properties to the editor root element.
 * Subscribes to ThemeManager so theme swaps are reflected instantly.
 *
 * NOTE: `loading` is included as a dependency so the effect re-fires once the
 * real editor DOM mounts (the loading spinner doesn't carry the wrapper ref).
 */
import { useEffect } from "react";
import { ThemeManager } from "../themes/manager";
import { useEditorStore, useEditorRefs } from "../state/context";

export function useTheme() {
    const themeId = useEditorStore((s) => s.activeThemeId);
    const loading = useEditorStore((s) => s.loading);
    const { editorWrapperRef } = useEditorRefs();

    useEffect(() => {
        const mgr = ThemeManager.getInstance();
        const apply = () => {
            const el = editorWrapperRef.current?.closest(".editor-root") as HTMLElement | null;
            if (!el) return;
            const theme = mgr.get(themeId) ?? mgr.getActive();
            ThemeManager.applyThemeToElement(theme, el);
        };
        // Apply immediately; if the ref isn't mounted yet (loading state)
        // this is a no-op and will re-run when `loading` flips to false.
        apply();
        const unsub = mgr.subscribe(apply);
        return unsub;
    }, [themeId, loading, editorWrapperRef]);
}
