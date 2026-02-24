/**
 * @module editor/components/VirtualizedGutter
 *
 * Virtualized line-number gutter that only renders line numbers visible
 * in the current viewport (plus a buffer). Uses the same scroll-sync
 * mechanism as the original gutter but with drastically fewer DOM nodes.
 *
 * For a 50,000-line file, this reduces DOM nodes from 50,000 to ~100.
 *
 * Layout strategy:
 *   - Outer container has overflow:hidden and is scroll-synced via ref
 *   - Inner container has the full virtual height (totalLines * lineHeight)
 *   - Visible line numbers are absolutely positioned at their correct offset
 */
import { memo, useMemo } from "react";
import { useEditorStore, useEditorRefs } from "../state/context";
import { useViewport } from "../hooks/useViewport";

export const VirtualizedGutter = memo(function VirtualizedGutter() {
    const lineCount = useEditorStore((s) => s.lineCount);
    const cursorLine = useEditorStore((s) => s.cursorLine);
    const fontSize = useEditorStore((s) => s.fontSize);
    const lineHeight = useEditorStore((s) => s.lineHeight);
    const { gutterRef } = useEditorRefs();
    const viewport = useViewport();

    const gutterWidth = Math.max(String(lineCount).length * (fontSize * 0.65) + 20, 40);

    // Total scrollable height: lines + top/bottom padding
    const totalHeight = lineCount * lineHeight + 20;

    // Build only the visible line numbers
    const visibleLines = useMemo(() => {
        const start = viewport.startLine;
        const end = Math.min(viewport.endLine, lineCount);
        const items: number[] = [];
        for (let i = start; i < end; i++) {
            items.push(i);
        }
        return items;
    }, [viewport.startLine, viewport.endLine, lineCount]);

    // Y offset for the first rendered line
    const topOffset = viewport.startLine * lineHeight + 10; // 10px = paddingTop

    return (
        <div
            ref={gutterRef}
            className="shrink-0 overflow-hidden select-none pointer-events-none"
            style={{
                width: gutterWidth,
                background: "var(--editor-gutter-bg)",
                borderRight: "1px solid var(--editor-border)",
                contain: "strict",
            }}
            aria-hidden
        >
            {/* Full-height virtual container for scroll sync */}
            <div style={{ height: totalHeight, position: "relative" }}>
                {/* Positioned block containing only visible lines */}
                <div
                    style={{
                        position: "absolute",
                        top: topOffset,
                        left: 0,
                        right: 0,
                        willChange: "transform",
                    }}
                >
                    {visibleLines.map((i) => (
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
        </div>
    );
});
