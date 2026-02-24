/**
 * @module editor/plugins/components/DiagnosticsOverlay
 *
 * Renders diagnostic squiggly underlines and gutter markers.
 */
import { useState, useEffect } from "react";
import { useEditorStore, useEditorRefs } from "../../state/context";
import type { Diagnostic } from "../types";

interface DiagnosticsOverlayProps {
    diagnostics: Diagnostic[];
}

const SEVERITY_COLORS: Record<Diagnostic["severity"], string> = {
    error: "#ff5555",
    warning: "#f1fa8c",
    info: "#8be9fd",
    hint: "#6272a4",
};

const SEVERITY_ICONS: Record<Diagnostic["severity"], string> = {
    error: "●",
    warning: "▲",
    info: "ℹ",
    hint: "○",
};

export function DiagnosticsOverlay({ diagnostics }: DiagnosticsOverlayProps) {
    const lineHeight = useEditorStore((s) => s.lineHeight);
    const fontSize = useEditorStore((s) => s.fontSize);
    const { textareaRef } = useEditorRefs();

    // Track scroll position reactively
    const [scrollTop, setScrollTop] = useState(0);
    const [scrollLeft, setScrollLeft] = useState(0);

    useEffect(() => {
        const ta = textareaRef.current;
        if (!ta) return;
        const handleScroll = () => {
            setScrollTop(ta.scrollTop);
            setScrollLeft(ta.scrollLeft);
        };
        ta.addEventListener("scroll", handleScroll, { passive: true });
        handleScroll();
        return () => ta.removeEventListener("scroll", handleScroll);
    }, [textareaRef]);

    if (diagnostics.length === 0) return null;

    const viewportHeight = textareaRef.current?.clientHeight ?? 800;
    const charWidth = fontSize * 0.6;

    return (
        <div
            className="editor-diagnostics-overlay"
            style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                pointerEvents: "none",
                zIndex: 4,
                overflow: "hidden",
            }}
        >
            {diagnostics.map((diag) => {
                const top = (diag.line - 1) * lineHeight + 10 - scrollTop;
                if (top < -lineHeight || top > viewportHeight + lineHeight) return null;

                const left = diag.startCol * charWidth + 10;
                const width = Math.max((diag.endCol - diag.startCol) * charWidth, charWidth);
                const color = SEVERITY_COLORS[diag.severity];

                return (
                    <div key={diag.id} className="diag-item-group">
                        {/* Invisible hover zone over the squiggly area */}
                        <div
                            className="diag-hover-zone"
                            style={{
                                position: "absolute",
                                top: top,
                                left,
                                width,
                                height: lineHeight,
                                pointerEvents: "auto",
                                cursor: "default",
                                zIndex: 5,
                            }}
                        />
                        {/* Squiggly underline */}
                        <div
                            style={{
                                position: "absolute",
                                top: top + lineHeight - 3,
                                left,
                                width,
                                height: 3,
                                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='6' height='3'%3E%3Cpath d='M0 3 L1.5 0 L3 3 L4.5 0 L6 3' stroke='${encodeURIComponent(color)}' fill='none' stroke-width='1'/%3E%3C/svg%3E")`,
                                backgroundRepeat: "repeat-x",
                                backgroundSize: "6px 3px",
                            }}
                        />
                        {/* Hover tooltip — positioned at the diagnostic word location */}
                        <div
                            className="diag-tooltip"
                            style={{
                                position: "absolute",
                                top: top - 18,
                                left,
                                fontSize: 10,
                                lineHeight: "14px",
                                padding: "2px 8px",
                                borderRadius: 3,
                                background: "var(--editor-popup-bg, #282a36)",
                                border: `1px solid ${color}33`,
                                color,
                                whiteSpace: "nowrap",
                                maxWidth: 400,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                pointerEvents: "none",
                                opacity: 0,
                                transition: "opacity 0.15s",
                                zIndex: 10,
                            }}
                        >
                            <span style={{ marginRight: 4 }}>{SEVERITY_ICONS[diag.severity]}</span>
                            {diag.message}
                            <span style={{ marginLeft: 8, opacity: 0.6 }}>[{diag.source}]</span>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
