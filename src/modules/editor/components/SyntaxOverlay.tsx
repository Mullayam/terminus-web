/**
 * @module editor/components/SyntaxOverlay
 * Renders syntax-highlighted HTML behind the transparent textarea.
 * Scroll-synced with the textarea via shared refs.
 */
import { useMemo, memo } from "react";
import { useEditorStore, useEditorRefs } from "../state/context";
import { highlightCode } from "../core/syntax";

export const SyntaxOverlay = memo(function SyntaxOverlay() {
    const content = useEditorStore((s) => s.content);
    const prismLang = useEditorStore((s) => s.prismLanguage);
    const wordWrap = useEditorStore((s) => s.wordWrap);
    const fontSize = useEditorStore((s) => s.fontSize);
    const lineHeight = useEditorStore((s) => s.lineHeight);
    const { highlightRef } = useEditorRefs();

    const html = useMemo(
        () => highlightCode(content, prismLang),
        [content, prismLang],
    );

    return (
        <pre
            ref={highlightRef}
            className="editor-highlight-overlay absolute inset-0 m-0 overflow-hidden"
            style={{
                padding: 10,
                fontSize,
                fontFamily: "var(--editor-font-family)",
                fontWeight: "var(--editor-font-weight)" as unknown as number,
                lineHeight: `${lineHeight}px`,
                background: "var(--editor-background)",
                whiteSpace: wordWrap ? "pre-wrap" : "pre",
                overflowWrap: wordWrap ? "break-word" : "normal",
                tabSize: 2,
                color: "var(--editor-foreground)",
            }}
            aria-hidden
        >
            <code
                dangerouslySetInnerHTML={{ __html: html + "\n" }}
                style={{ fontFamily: "inherit" }}
            />
        </pre>
    );
});
