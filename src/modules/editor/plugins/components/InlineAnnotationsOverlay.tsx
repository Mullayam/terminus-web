/**
 * @module editor/plugins/components/InlineAnnotationsOverlay
 *
 * Renders inline ghost text annotations after lines.
 */
import { useState, useEffect } from "react";
import type React from "react";
import { useEditorStore, useEditorRefs } from "../../state/context";
import type { InlineAnnotation } from "../types";

interface InlineAnnotationsOverlayProps {
    annotations: InlineAnnotation[];
}

export function InlineAnnotationsOverlay({ annotations }: InlineAnnotationsOverlayProps) {
    const lineHeight = useEditorStore((s) => s.lineHeight);
    const fontSize = useEditorStore((s) => s.fontSize);
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
                zIndex: 3,
                overflow: "hidden",
            }}
        >
            {annotations.map((ann) => {
                const top = (ann.line - 1) * lineHeight + 10 - scrollTop;
                if (top < -lineHeight || top > viewportHeight + lineHeight) return null;

                // Position at specific column if provided, otherwise right-align
                const posStyle: React.CSSProperties = ann.col != null
                    ? { left: ann.col * charWidth + 10 - scrollLeft }
                    : { right: 12 };

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
