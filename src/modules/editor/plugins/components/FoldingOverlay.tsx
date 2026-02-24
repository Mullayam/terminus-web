/**
 * @module editor/plugins/components/FoldingOverlay
 *
 * Renders fold/collapse chevrons in the gutter area next to foldable blocks.
 * Clicking a chevron toggles the collapsed state of its block.
 *
 * Foldable regions include: functions, classes, if/for/while blocks, etc.
 * When collapsed:
 *   - A "▶" glyph replaces the "▼"
 *   - Inner lines are visually hidden via a CSS overlay
 *   - A "{…}" placeholder shows on the fold line
 */
import { useState, useEffect, useCallback, useMemo, memo } from "react";
import { useEditorStore, useEditorRefs } from "../../state/context";
import type { FoldingRange } from "../types";

interface FoldingOverlayProps {
    foldingRanges: FoldingRange[];
}

const KIND_COLORS: Record<string, string> = {
    function: "var(--editor-fold-fn, #bd93f9)",
    class:    "var(--editor-fold-class, #8be9fd)",
    if:       "var(--editor-fold-ctrl, #ffb86c)",
    for:      "var(--editor-fold-ctrl, #ffb86c)",
    while:    "var(--editor-fold-ctrl, #ffb86c)",
    switch:   "var(--editor-fold-ctrl, #ffb86c)",
    try:      "var(--editor-fold-ctrl, #ffb86c)",
    block:    "var(--editor-fold-block, #6272a4)",
    import:   "var(--editor-fold-import, #50fa7b)",
    comment:  "var(--editor-fold-comment, #6272a4)",
};

export const FoldingOverlay = memo(function FoldingOverlay({ foldingRanges }: FoldingOverlayProps) {
    const lineHeight = useEditorStore((s) => s.lineHeight);
    const fontSize = useEditorStore((s) => s.fontSize);
    const { textareaRef } = useEditorRefs();

    // Track which ranges are collapsed
    const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());

    // Track scroll
    const [scrollTop, setScrollTop] = useState(0);

    useEffect(() => {
        const ta = textareaRef.current;
        if (!ta) return;
        const handleScroll = () => setScrollTop(ta.scrollTop);
        ta.addEventListener("scroll", handleScroll, { passive: true });
        setScrollTop(ta.scrollTop);
        return () => ta.removeEventListener("scroll", handleScroll);
    }, [textareaRef]);

    const toggleFold = useCallback((id: string) => {
        setCollapsedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    // Clean up collapsed IDs when ranges change (remove stale ones)
    useEffect(() => {
        const validIds = new Set(foldingRanges.map((r) => r.id));
        setCollapsedIds((prev) => {
            const cleaned = new Set([...prev].filter((id) => validIds.has(id)));
            if (cleaned.size !== prev.size) return cleaned;
            return prev;
        });
    }, [foldingRanges]);

    // Build collapsed line set for hiding inner lines
    const collapsedLineRanges = useMemo(() => {
        const hidden = new Set<number>();
        for (const range of foldingRanges) {
            if (collapsedIds.has(range.id)) {
                // Hide lines from startLine+1 to endLine (keep the start line visible)
                for (let l = range.startLine + 1; l <= range.endLine; l++) {
                    hidden.add(l);
                }
            }
        }
        return hidden;
    }, [foldingRanges, collapsedIds]);

    if (foldingRanges.length === 0) return null;

    const containerHeight = textareaRef.current?.clientHeight ?? 1000;

    return (
        <>
            {/* Fold chevrons — positioned in the gutter margin area */}
            <div
                className="editor-folding-chevrons"
                style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    pointerEvents: "none",
                    zIndex: 4,
                    overflow: "hidden",
                }}
            >
                {foldingRanges.map((range) => {
                    const top = (range.startLine - 1) * lineHeight + 10 - scrollTop;
                    if (top < -lineHeight || top > containerHeight) return null;

                    const isCollapsed = collapsedIds.has(range.id);
                    const color = KIND_COLORS[range.kind] ?? "var(--editor-muted, #6272a4)";

                    return (
                        <div
                            key={range.id}
                            style={{
                                position: "absolute",
                                top,
                                left: 2,
                                width: 16,
                                height: lineHeight,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                pointerEvents: "auto",
                                cursor: "pointer",
                                userSelect: "none",
                                opacity: 0.6,
                                transition: "opacity 0.15s, transform 0.15s",
                            }}
                            title={`${isCollapsed ? "Expand" : "Collapse"} ${range.kind} (lines ${range.startLine}–${range.endLine})`}
                            onClick={() => toggleFold(range.id)}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0.6"; }}
                        >
                            <span
                                style={{
                                    fontSize: 9,
                                    color,
                                    transform: isCollapsed ? "rotate(0deg)" : "rotate(90deg)",
                                    transition: "transform 0.15s ease",
                                    display: "inline-block",
                                    lineHeight: 1,
                                }}
                            >
                                ▶
                            </span>
                        </div>
                    );
                })}
            </div>

            {/* Collapsed placeholder badges on the fold line */}
            <div
                className="editor-folding-badges"
                style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    pointerEvents: "none",
                    zIndex: 4,
                    overflow: "hidden",
                }}
            >
                {foldingRanges
                    .filter((r) => collapsedIds.has(r.id))
                    .map((range) => {
                        const top = (range.startLine - 1) * lineHeight + 10 - scrollTop;
                        if (top < -lineHeight || top > containerHeight) return null;

                        const hiddenCount = range.endLine - range.startLine;
                        const summary = range.collapsedText ?? `… ${hiddenCount} lines`;

                        return (
                            <div
                                key={`badge-${range.id}`}
                                style={{
                                    position: "absolute",
                                    top: top + 1,
                                    right: 12,
                                    height: lineHeight - 2,
                                    display: "flex",
                                    alignItems: "center",
                                    pointerEvents: "auto",
                                    cursor: "pointer",
                                }}
                                onClick={() => toggleFold(range.id)}
                                title={`Expand ${range.kind} (${hiddenCount} hidden lines)`}
                            >
                                <span
                                    style={{
                                        fontSize: Math.max(fontSize - 3, 9),
                                        fontFamily: "var(--editor-font-family)",
                                        color: "var(--editor-muted, #6272a4)",
                                        background: "var(--editor-fold-badge-bg, rgba(98, 114, 164, 0.15))",
                                        border: "1px solid var(--editor-fold-badge-border, rgba(98, 114, 164, 0.25))",
                                        borderRadius: 3,
                                        padding: "1px 6px",
                                        opacity: 0.85,
                                        whiteSpace: "nowrap",
                                    }}
                                >
                                    {summary}
                                </span>
                            </div>
                        );
                    })}
            </div>

            {/* Visual line-hiding overlay for collapsed regions */}
            {collapsedLineRanges.size > 0 && (
                <div
                    className="editor-folding-hide-overlay"
                    style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        pointerEvents: "none",
                        zIndex: 2,
                        overflow: "hidden",
                    }}
                >
                    {/* Render opaque covers over hidden line regions */}
                    {(() => {
                        // Merge consecutive hidden lines into contiguous spans
                        const sortedLines = Array.from(collapsedLineRanges).sort((a, b) => a - b);
                        const spans: Array<{ start: number; end: number }> = [];
                        let spanStart = sortedLines[0];
                        let spanEnd = sortedLines[0];
                        for (let i = 1; i < sortedLines.length; i++) {
                            if (sortedLines[i] === spanEnd + 1) {
                                spanEnd = sortedLines[i];
                            } else {
                                spans.push({ start: spanStart, end: spanEnd });
                                spanStart = sortedLines[i];
                                spanEnd = sortedLines[i];
                            }
                        }
                        spans.push({ start: spanStart, end: spanEnd });

                        return spans.map((span) => {
                            const top = (span.start - 1) * lineHeight + 10 - scrollTop;
                            const height = (span.end - span.start + 1) * lineHeight;
                            if (top + height < 0 || top > containerHeight) return null;

                            return (
                                <div
                                    key={`hide-${span.start}-${span.end}`}
                                    style={{
                                        position: "absolute",
                                        top,
                                        left: 0,
                                        right: 0,
                                        height,
                                        background: "var(--editor-bg, #282a36)",
                                        opacity: 0.95,
                                    }}
                                />
                            );
                        });
                    })()}
                </div>
            )}
        </>
    );
});
