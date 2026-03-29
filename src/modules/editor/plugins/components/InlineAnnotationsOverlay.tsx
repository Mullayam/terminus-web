/**
 * @module editor/plugins/components/InlineAnnotationsOverlay
 *
 * Renders inline "after" annotations at the end of source lines,
 * matching VS Code's afterDecoration style. Annotations appear as
 * subtle pills to the right of the last character — never overlapping
 * real source text.
 */
import { useState, useEffect, useMemo } from "react";
import type React from "react";
import { useEditorStore, useEditorRefs } from "../../state/context";
import type { InlineAnnotation } from "../types";

/** Must match textarea padding */
const CODE_PAD_X = 16;
/** Gap between last character and annotation */
const AFTER_GAP = 24;

interface InlineAnnotationsOverlayProps {
    annotations: InlineAnnotation[];
}

export function InlineAnnotationsOverlay({ annotations }: InlineAnnotationsOverlayProps) {
    const lineHeight = useEditorStore((s) => s.lineHeight);
    const fontSize = useEditorStore((s) => s.fontSize);
    const content = useEditorStore((s) => s.content);
    const { textareaRef } = useEditorRefs();

    // Track scroll position reactively
    const [scrollTop, setScrollTop] = useState(0);
    const [scrollLeft, setScrollLeft] = useState(0);

    useEffect(() => {
        const ta = textareaRef.current;
        if (!ta) return;
        const handleScroll = () => {
            setScrollTop(ta.scrollTop);
            setScrollLeft(ta.scrollLeft);
        };
        ta.addEventListener("scroll", handleScroll, { passive: true });
        handleScroll();
        return () => ta.removeEventListener("scroll", handleScroll);
    }, [textareaRef]);

    // Pre-compute line lengths for "after" positioning
    const lineLengths = useMemo(() => {
        const lines = content.split("\n");
        const map = new Map<number, number>();
        for (const ann of annotations) {
            if (ann.col == null && !map.has(ann.line)) {
                const idx = ann.line - 1;
                map.set(ann.line, idx < lines.length ? lines[idx].length : 0);
            }
        }
        return map;
    }, [content, annotations]);

    if (annotations.length === 0) return null;

    const viewportHeight = textareaRef.current?.clientHeight ?? 800;
    const charWidth = fontSize * 0.6;

    return (
        <div
            className="editor-annotations-overlay"
            style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                pointerEvents: "none",
                zIndex: 5,
                overflow: "hidden",
            }}
        >
            {annotations.map((ann) => {
                // Skip annotations hidden via display:none (status-bar-only items)
                if (ann.style?.display === "none") return null;
                const top = (ann.line - 1) * lineHeight + 4 - scrollTop;
                if (top < -lineHeight || top > viewportHeight + lineHeight) return null;

                // VS Code "after" decoration: position after the last character on the line
                const posStyle: React.CSSProperties = ann.col != null
                    ? { left: ann.col * charWidth + CODE_PAD_X - scrollLeft }
                    : { left: (lineLengths.get(ann.line) ?? 0) * charWidth + CODE_PAD_X + AFTER_GAP - scrollLeft };

                return (
                    <div
                        key={ann.id}
                        className={ann.className}
                        style={{
                            position: "absolute",
                            top,
                            ...posStyle,
                            height: lineHeight,
                            lineHeight: `${lineHeight}px`,
                            fontSize: fontSize - 1,
                            fontFamily: "var(--editor-font-family, monospace)",
                            whiteSpace: "nowrap",
                            pointerEvents: ann.onClick ? "auto" : "none",
                            cursor: ann.onClick ? "pointer" : "default",
                            opacity: 0.5,
                            maxWidth: 360,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            ...ann.style,
                        }}
                        onClick={ann.onClick}
                    >
                        {ann.text}
                    </div>
                );
            })}
        </div>
    );
}
