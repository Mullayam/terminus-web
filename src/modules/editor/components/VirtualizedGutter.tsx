/**
 * @module editor/components/VirtualizedGutter
 *
 * VS Code-style virtualized line-number gutter.
 * Only visible lines are rendered. Active line gets highlighted number + background band.
 */
import { memo, useMemo } from "react";
import { useEditorStore, useEditorRefs } from "../state/context";
import { useViewport } from "../hooks/useViewport";

/** Top/bottom padding — matches the code canvas CANVAS_PAD */
const PAD = 4;

export const VirtualizedGutter = memo(function VirtualizedGutter() {
    const lineCount = useEditorStore((s) => s.lineCount);
    const cursorLine = useEditorStore((s) => s.cursorLine);
    const fontSize = useEditorStore((s) => s.fontSize);
    const lineHeight = useEditorStore((s) => s.lineHeight);
    const { gutterRef } = useEditorRefs();
    const viewport = useViewport();

    const digitCount = Math.max(String(lineCount).length, 2);
    // left pad (14) + digits + right pad (10) + fold col (16)
    const gutterWidth = digitCount * (fontSize * 0.6) + 40;

    const totalHeight = lineCount * lineHeight + PAD * 2;

    const visibleLines = useMemo(() => {
        const start = viewport.startLine;
        const end = Math.min(viewport.endLine, lineCount);
        const items: number[] = [];
        for (let i = start; i < end; i++) items.push(i);
        return items;
    }, [viewport.startLine, viewport.endLine, lineCount]);

    const topOffset = viewport.startLine * lineHeight + PAD;

    // Is cursor in viewport?
    const showActiveBg =
        cursorLine >= viewport.startLine + 1 && cursorLine <= viewport.endLine;

    return (
        <div
            ref={gutterRef}
            className="editor-gutter"
            style={{ width: gutterWidth }}
            aria-hidden
        >
            <div style={{ height: totalHeight, position: "relative" }}>
                {/* Active-line background band */}
                {showActiveBg && (
                    <div
                        className="editor-gutter__active-bg"
                        style={{
                            top: (cursorLine - 1) * lineHeight + PAD,
                            height: lineHeight,
                        }}
                    />
                )}

                {/* Visible line numbers */}
                <div
                    style={{
                        position: "absolute",
                        top: topOffset,
                        left: 0,
                        right: 16, // fold column space
                        willChange: "transform",
                    }}
                >
                    {visibleLines.map((i) => {
                        const lineNum = i + 1;
                        const isActive = lineNum === cursorLine;
                        return (
                            <div
                                key={i}
                                className={`editor-gutter__line${isActive ? " editor-gutter__line--active" : ""}`}
                                style={{
                                    height: lineHeight,
                                    lineHeight: `${lineHeight}px`,
                                    fontSize: fontSize - 1,
                                    paddingRight: 10,
                                    paddingLeft: 14,
                                }}
                            >
                                {lineNum}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
});
