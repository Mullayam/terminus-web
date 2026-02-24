/**
 * @module editor/components/Minimap
 * A bird's-eye code minimap with a viewport indicator.
 */
import { memo, useRef, useEffect, useCallback } from "react";
import { useEditorStore, useEditorRefs } from "../state/context";
import { escapeHtml } from "../core/utils";

const MINIMAP_FONT = 2;          // px per char width
const MINIMAP_LINE_H = 3;        // px per line
const MINIMAP_WIDTH = 80;        // px panel width
const VISIBLE_BUFFER = 6000;     // max lines to render

export const Minimap = memo(function Minimap() {
    const showMinimap = useEditorStore((s) => s.showMinimap);
    const content = useEditorStore((s) => s.content);
    const lineCount = useEditorStore((s) => s.lineCount);
    const { textareaRef, editorWrapperRef } = useEditorRefs();
    const canvasRef = useRef<HTMLDivElement>(null);
    const viewportRef = useRef<HTMLDivElement>(null);
    const isDragging = useRef(false);

    /* Build minimap HTML — truncated for perf */
    const minimapHtml = (() => {
        if (!showMinimap || lineCount > VISIBLE_BUFFER) return "";
        const lines = content.split("\n");
        return lines
            .map((l) => {
                const trimmed = l.slice(0, 120);
                return `<div style="height:${MINIMAP_LINE_H}px;white-space:nowrap;overflow:hidden;font-size:${MINIMAP_FONT}px;line-height:${MINIMAP_LINE_H}px;color:var(--editor-muted);opacity:0.55">${escapeHtml(trimmed)}</div>`;
            })
            .join("");
    })();

    /* Update viewport indicator on scroll */
    const syncViewport = useCallback(() => {
        const wrapper = editorWrapperRef.current;
        const vp = viewportRef.current;
        if (!wrapper || !vp) return;
        const totalH = lineCount * MINIMAP_LINE_H;
        const scrollTop = wrapper.scrollTop;
        const visibleH = wrapper.clientHeight;
        const contentH = wrapper.scrollHeight || 1;
        const top = (scrollTop / contentH) * totalH;
        const height = Math.max(10, (visibleH / contentH) * totalH);
        vp.style.top = `${top}px`;
        vp.style.height = `${height}px`;
    }, [lineCount, editorWrapperRef]);

    useEffect(() => {
        if (!showMinimap) return;
        const wrapper = editorWrapperRef.current;
        if (!wrapper) return;
        wrapper.addEventListener("scroll", syncViewport, { passive: true });
        syncViewport();
        return () => wrapper.removeEventListener("scroll", syncViewport);
    }, [showMinimap, syncViewport, editorWrapperRef]);

    /* Click / drag to scroll */
    const jumpTo = useCallback(
        (clientY: number) => {
            const canvas = canvasRef.current;
            const wrapper = editorWrapperRef.current;
            if (!canvas || !wrapper) return;
            const rect = canvas.getBoundingClientRect();
            const ratio = (clientY - rect.top) / rect.height;
            wrapper.scrollTop = ratio * wrapper.scrollHeight;
        },
        [editorWrapperRef],
    );

    const onMouseDown = useCallback(
        (e: React.MouseEvent) => {
            isDragging.current = true;
            jumpTo(e.clientY);
            const move = (ev: MouseEvent) => { if (isDragging.current) jumpTo(ev.clientY); };
            const up = () => { isDragging.current = false; window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
            window.addEventListener("mousemove", move);
            window.addEventListener("mouseup", up);
        },
        [jumpTo],
    );

    if (!showMinimap) return null;

    return (
        <div
            ref={canvasRef}
            onMouseDown={onMouseDown}
            className="relative select-none shrink-0"
            style={{
                width: MINIMAP_WIDTH,
                background: "var(--editor-minimap-bg)",
                borderLeft: "1px solid var(--editor-border)",
                overflow: "hidden",
                cursor: "pointer",
            }}
        >
            {/* Code lines */}
            <div dangerouslySetInnerHTML={{ __html: minimapHtml }} />

            {/* Viewport indicator */}
            <div
                ref={viewportRef}
                className="absolute left-0 right-0"
                style={{
                    background: "var(--editor-minimap-slider)",
                    borderRadius: 2,
                    pointerEvents: "none",
                    transition: isDragging.current ? "none" : "top 0.08s ease",
                }}
            />
        </div>
    );
});
