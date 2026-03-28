/**
 * @module editor/components/VirtualizedSyntaxOverlay
 *
 * Virtualized syntax-highlighted overlay. Renders only visible lines through
 * Prism with bracket colorization, an active-line highlight band, and caching
 * to skip re-highlighting on identical scrolls.
 *
 * z-order within the canvas:
 *   <pre>  (z:2, pointer-events:none)
 *     ├── active-line highlight (z:1, background band)
 *     ├── top spacer
 *     ├── <code> highlighted HTML (z:2)
 *     └── bottom spacer
 */
import { useMemo, memo, useRef } from "react";
import { useEditorStore, useEditorRefs } from "../state/context";
import { highlightCode } from "../core/syntax";
import { colorizeBrackets, shouldColorizeBrackets } from "../core/bracket-colorizer";
import { useViewport } from "../hooks/useViewport";

/** Must match textarea padding */
const CANVAS_PAD = 4;
const CODE_PAD_X = 16;

interface HighlightCache { key: string; html: string; }

export const VirtualizedSyntaxOverlay = memo(function VirtualizedSyntaxOverlay() {
    const content = useEditorStore((s) => s.content);
    const prismLang = useEditorStore((s) => s.prismLanguage);
    const wordWrap = useEditorStore((s) => s.wordWrap);
    const fontSize = useEditorStore((s) => s.fontSize);
    const lineHeight = useEditorStore((s) => s.lineHeight);
    const tabSize = useEditorStore((s) => s.tabSize);
    const cursorLine = useEditorStore((s) => s.cursorLine);
    const { highlightRef } = useEditorRefs();
    const viewport = useViewport();

    const cacheRef = useRef<HighlightCache>({ key: "", html: "" });

    const { html, topPadding, bottomPadding } = useMemo(() => {
        const lines = content.split("\n");
        const totalLines = lines.length;
        const start = Math.max(0, viewport.startLine);
        const end = Math.min(totalLines, viewport.endLine);

        const visibleContent = lines.slice(start, end).join("\n");
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
            topPadding: start * lineHeight + CANVAS_PAD,
            bottomPadding: Math.max(0, (totalLines - end) * lineHeight + CANVAS_PAD),
        };
    }, [content, prismLang, viewport.startLine, viewport.endLine, lineHeight]);

    // Active line highlight (only when cursor is in viewport)
    const showActiveLine =
        cursorLine >= viewport.startLine + 1 && cursorLine <= viewport.endLine;
    const activeLineTop = (cursorLine - 1) * lineHeight + CANVAS_PAD;

    return (
        <pre
            ref={highlightRef}
            className="editor-highlight-overlay"
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
            }}
            aria-hidden
        >
            {/* Active line: subtle background band */}
            {showActiveLine && (
                <div
                    className="editor-active-line"
                    style={{ top: activeLineTop, height: lineHeight }}
                />
            )}

            {/* Top spacer for virtualization */}
            <div style={{ height: topPadding, pointerEvents: "none" }} />

            {/* Highlighted code block */}
            <code
                dangerouslySetInnerHTML={{ __html: html + "\n" }}
                style={{
                    fontFamily: "inherit",
                    display: "block",
                    paddingLeft: CODE_PAD_X,
                    paddingRight: CODE_PAD_X,
                    willChange: "contents",
                    position: "relative",
                    zIndex: 2,
                }}
            />

            {/* Bottom spacer */}
            <div style={{ height: bottomPadding, pointerEvents: "none" }} />
        </pre>
    );
});
