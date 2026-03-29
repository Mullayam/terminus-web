/**
 * @module editor/plugins/components/CodeLensOverlay
 *
 * Renders VS Code-style CodeLens items. Each lens group appears as
 * a subtle row of clickable links positioned at the very top of its
 * target line (flush with the line, no negative offset).
 */
import { useState, useEffect } from "react";
import { useEditorStore, useEditorRefs } from "../../state/context";
import type { CodeLensItem } from "../types";

interface CodeLensOverlayProps {
    codeLenses: CodeLensItem[];
}

/** Must match textarea padding */
const CANVAS_PAD = 4;
const CODE_PAD_X = 16;

export function CodeLensOverlay({ codeLenses }: CodeLensOverlayProps) {
    const lineHeight = useEditorStore((s) => s.lineHeight);
    const { textareaRef } = useEditorRefs();

    const [scrollTop, setScrollTop] = useState(0);

    useEffect(() => {
        const ta = textareaRef.current;
        if (!ta) return;
        const handleScroll = () => setScrollTop(ta.scrollTop);
        ta.addEventListener("scroll", handleScroll, { passive: true });
        setScrollTop(ta.scrollTop);
        return () => ta.removeEventListener("scroll", handleScroll);
    }, [textareaRef]);

    if (codeLenses.length === 0) return null;

    const viewportHeight = textareaRef.current?.clientHeight ?? 1000;

    // Group lenses by line
    const byLine = new Map<number, CodeLensItem[]>();
    for (const lens of codeLenses) {
        if (!byLine.has(lens.line)) byLine.set(lens.line, []);
        byLine.get(lens.line)!.push(lens);
    }

    return (
        <div
            className="editor-codelens-overlay"
            style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                pointerEvents: "none",
                zIndex: 5,
                overflow: "hidden",
            }}
        >
            {Array.from(byLine.entries()).map(([line, lenses]) => {
                // Position flush at the top of the target line
                const top = (line - 1) * lineHeight + CANVAS_PAD - scrollTop;
                if (top < -lineHeight || top > viewportHeight) return null;

                return (
                    <div
                        key={line}
                        style={{
                            position: "absolute",
                            top,
                            left: CODE_PAD_X,
                            display: "flex",
                            gap: 10,
                            pointerEvents: "auto",
                            height: lineHeight,
                            alignItems: "center",
                        }}
                    >
                        {lenses.map((lens) => (
                            <button
                                key={lens.id}
                                onClick={lens.onClick}
                                title={lens.tooltip}
                                className="editor-codelens-btn"
                                style={{
                                    background: "transparent",
                                    border: "none",
                                    padding: 0,
                                    color: "var(--editor-codelens-fg, var(--editor-muted, #6272a4))",
                                    fontSize: 10,
                                    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                                    cursor: "pointer",
                                    opacity: 0,
                                    transition: "opacity 0.15s",
                                    lineHeight: 1,
                                }}
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
