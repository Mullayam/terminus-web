/**
 * @module editor/plugins/components/CodeLensOverlay
 *
 * Renders CodeLens items above their target lines.
 * Positioned absolutely within the editor body, scrolls with content.
 */
import { useEditorStore, useEditorRefs } from "../../state/context";
import type { CodeLensItem } from "../types";

interface CodeLensOverlayProps {
    codeLenses: CodeLensItem[];
}

export function CodeLensOverlay({ codeLenses }: CodeLensOverlayProps) {
    const lineHeight = useEditorStore((s) => s.lineHeight);
    const fontSize = useEditorStore((s) => s.fontSize);
    const wordWrap = useEditorStore((s) => s.wordWrap);
    const { textareaRef } = useEditorRefs();

    if (codeLenses.length === 0) return null;

    // Group lenses by line
    const byLine = new Map<number, CodeLensItem[]>();
    for (const lens of codeLenses) {
        if (!byLine.has(lens.line)) byLine.set(lens.line, []);
        byLine.get(lens.line)!.push(lens);
    }

    const scrollTop = textareaRef.current?.scrollTop ?? 0;

    return (
        <div
            className="editor-codelens-overlay"
            style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                pointerEvents: "none",
                zIndex: 3,
                overflow: "hidden",
            }}
        >
            {Array.from(byLine.entries()).map(([line, lenses]) => {
                const top = (line - 1) * lineHeight + 10 - scrollTop - 14; // Position above the line
                if (top < -20 || top > (textareaRef.current?.clientHeight ?? 1000)) return null;

                return (
                    <div
                        key={line}
                        style={{
                            position: "absolute",
                            top,
                            left: 60,
                            display: "flex",
                            gap: 12,
                            pointerEvents: "auto",
                            height: 14,
                            lineHeight: "14px",
                        }}
                    >
                        {lenses.map((lens) => (
                            <button
                                key={lens.id}
                                onClick={lens.onClick}
                                title={lens.tooltip}
                                style={{
                                    background: "transparent",
                                    border: "none",
                                    padding: 0,
                                    color: "var(--editor-muted, #6272a4)",
                                    fontSize: 10,
                                    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                                    cursor: "pointer",
                                    opacity: 0.7,
                                    transition: "opacity 0.15s",
                                }}
                                onMouseEnter={(e) => { (e.target as HTMLElement).style.opacity = "1"; }}
                                onMouseLeave={(e) => { (e.target as HTMLElement).style.opacity = "0.7"; }}
                            >
                                {lens.title}
                            </button>
                        ))}
                    </div>
                );
            })}
        </div>
    );
}
