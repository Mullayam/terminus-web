/**
 * @module editor/hooks/useTheme
 * Applies the active theme's CSS custom properties to the editor root element.
 * Subscribes to ThemeManager so theme swaps are reflected instantly.
 */
import { useEffect } from "react";
import { ThemeManager } from "../themes/manager";
import { useEditorStore, useEditorRefs } from "../state/context";

export function useTheme() {
    const themeId = useEditorStore((s) => s.activeThemeId);
    const { editorWrapperRef } = useEditorRefs();

    useEffect(() => {
        const mgr = ThemeManager.getInstance();
        const apply = () => {
            const el = editorWrapperRef.current?.closest(".editor-root") as HTMLElement | null;
            if (!el) return;
            const theme = mgr.get(themeId) ?? mgr.getActive();
            ThemeManager.applyThemeToElement(theme, el);
        };
        apply();
        const unsub = mgr.subscribe(apply);
        return unsub;
    }, [themeId, editorWrapperRef]);
}
