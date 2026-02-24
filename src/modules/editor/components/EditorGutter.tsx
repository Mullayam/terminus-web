/**
 * @module editor/components/EditorGutter
 * Line-number gutter with active-line highlighting.
 * Uses CSS variables for theming.
 */
import { memo } from "react";
import { useEditorStore, useEditorRefs } from "../state/context";

export const EditorGutter = memo(function EditorGutter() {
    const lineCount = useEditorStore((s) => s.lineCount);
    const cursorLine = useEditorStore((s) => s.cursorLine);
    const fontSize = useEditorStore((s) => s.fontSize);
    const lineHeight = useEditorStore((s) => s.lineHeight);
    const { gutterRef } = useEditorRefs();

    const gutterWidth = Math.max(String(lineCount).length * (fontSize * 0.65) + 20, 40);

    return (
        <div
            ref={gutterRef}
            className="shrink-0 overflow-hidden select-none pointer-events-none"
            style={{
                width: gutterWidth,
                background: "var(--editor-gutter-bg)",
                borderRight: "1px solid var(--editor-border)",
            }}
            aria-hidden
        >
            <div style={{ paddingTop: 10, paddingBottom: 10 }}>
                {Array.from({ length: lineCount }, (_, i) => (
                    <div
                        key={i}
                        style={{
                            height: lineHeight,
                            lineHeight: `${lineHeight}px`,
                            fontSize: fontSize - 1,
                            paddingRight: 8,
                            paddingLeft: 8,
                            textAlign: "right",
                            fontFamily: "var(--editor-font-family)",
                            color:
                                i + 1 === cursorLine
                                    ? "var(--editor-gutter-active-fg)"
                                    : "var(--editor-gutter-fg)",
                        }}
                    >
                        {i + 1}
                    </div>
                ))}
            </div>
        </div>
    );
});
