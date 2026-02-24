/**
 * @module editor/plugins/components/InlineAnnotationsOverlay
 *
 * Renders inline ghost text annotations after lines.
 */
import { useEditorStore, useEditorRefs } from "../../state/context";
import type { InlineAnnotation } from "../types";

interface InlineAnnotationsOverlayProps {
    annotations: InlineAnnotation[];
}

export function InlineAnnotationsOverlay({ annotations }: InlineAnnotationsOverlayProps) {
    const lineHeight = useEditorStore((s) => s.lineHeight);
    const fontSize = useEditorStore((s) => s.fontSize);
    const { textareaRef } = useEditorRefs();

    if (annotations.length === 0) return null;

    const scrollTop = textareaRef.current?.scrollTop ?? 0;
    const viewportHeight = textareaRef.current?.clientHeight ?? 800;

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

                return (
                    <div
                        key={ann.id}
                        className={ann.className}
                        style={{
                            position: "absolute",
                            top,
                            right: 12,
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
