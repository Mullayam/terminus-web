/**
 * @module editor/components/VirtualizedSyntaxOverlay
 *
 * Virtualized syntax-highlighted overlay that only parses and renders
 * lines visible in the current viewport. For a 50,000-line file this
 * means highlighting ~100 lines instead of 50,000.
 *
 * Layout strategy:
 *   - Outer <pre> has overflow:hidden and is scroll-synced via ref
 *   - A top spacer div pushes highlighted content to the correct offset
 *   - A bottom spacer ensures the total height matches the textarea
 *   - Only the visible slice of content is fed to Prism
 *
 * GPU Acceleration:
 *   - Uses `contain: layout style paint` for browser optimizations
 *   - Uses `will-change: contents` on the highlighted region
 */
import { useMemo, memo, useRef } from "react";
import { useEditorStore, useEditorRefs } from "../state/context";
import { highlightCode } from "../core/syntax";
import { colorizeBrackets, shouldColorizeBrackets } from "../core/bracket-colorizer";
import { useViewport } from "../hooks/useViewport";

/** Cache for highlighted line ranges to avoid re-highlighting on small scrolls */
interface HighlightCache {
    key: string;
    html: string;
}

export const VirtualizedSyntaxOverlay = memo(function VirtualizedSyntaxOverlay() {
    const content = useEditorStore((s) => s.content);
    const prismLang = useEditorStore((s) => s.prismLanguage);
    const wordWrap = useEditorStore((s) => s.wordWrap);
    const fontSize = useEditorStore((s) => s.fontSize);
    const lineHeight = useEditorStore((s) => s.lineHeight);
    const tabSize = useEditorStore((s) => s.tabSize);
    const { highlightRef } = useEditorRefs();
    const viewport = useViewport();

    // Cache the last highlight result to avoid re-highlighting when content hasn't changed
    const cacheRef = useRef<HighlightCache>({ key: "", html: "" });

    const { html, topPadding, bottomPadding } = useMemo(() => {
        const lines = content.split("\n");
        const totalLines = lines.length;
        const start = Math.max(0, viewport.startLine);
        const end = Math.min(totalLines, viewport.endLine);

        const visibleContent = lines.slice(start, end).join("\n");

        // Check cache — skip highlighting if the visible content is the same
        const cacheKey = `${start}:${end}:${prismLang}:${visibleContent.length}`;
        let highlighted: string;

        if (cacheRef.current.key === cacheKey) {
            highlighted = cacheRef.current.html;
        } else {
            highlighted = highlightCode(visibleContent, prismLang);
            if (shouldColorizeBrackets(visibleContent.length)) {
                highlighted = colorizeBrackets(highlighted);
            }
            cacheRef.current = { key: cacheKey, html: highlighted };
        }

        return {
            html: highlighted,
            topPadding: start * lineHeight + 10, // 10px = editor top padding
            bottomPadding: Math.max(0, (totalLines - end) * lineHeight + 10),
        };
    }, [content, prismLang, viewport.startLine, viewport.endLine, lineHeight]);

    return (
        <pre
            ref={highlightRef}
            className="editor-highlight-overlay absolute inset-0 m-0 overflow-hidden"
            style={{
                padding: 0,
                fontSize,
                fontFamily: "var(--editor-font-family)",
                fontWeight: "var(--editor-font-weight)" as unknown as number,
                lineHeight: `${lineHeight}px`,
                background: "var(--editor-background)",
                whiteSpace: wordWrap ? "pre-wrap" : "pre",
                overflowWrap: wordWrap ? "break-word" : "normal",
                tabSize,
                color: "var(--editor-foreground)",
                contain: "layout style paint",
            }}
            aria-hidden
        >
            {/* Top spacer — pushes content to correct vertical position */}
            <div style={{ height: topPadding, pointerEvents: "none" }} />

            {/* Highlighted visible content */}
            <code
                dangerouslySetInnerHTML={{ __html: html + "\n" }}
                style={{
                    fontFamily: "inherit",
                    display: "block",
                    paddingLeft: 10,
                    paddingRight: 10,
                    willChange: "contents",
                }}
            />

            {/* Bottom spacer — ensures full virtual height for scroll sync */}
            <div style={{ height: bottomPadding, pointerEvents: "none" }} />
        </pre>
    );
});
