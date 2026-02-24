/**
 * @module editor/plugins/components/GhostTextOverlay
 *
 * Renders Copilot-style ghost text at the cursor position.
 * Subscribes to the ghostTextStore from the ai-ghost-text plugin
 * and renders the streamed text with a typing animation.
 *
 * Features:
 *   - Positioned inline after the cursor
 *   - Character-by-character streaming with blinking cursor
 *   - Subtle fade-in animation
 *   - "Tab to accept" hint
 *   - Scrolls with the editor
 */
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useEditorStore, useEditorRefs } from "../../state/context";
import { ghostTextStore, type GhostTextState } from "../builtin/ai-ghost-text";

export function GhostTextOverlay() {
    const [ghost, setGhost] = useState<GhostTextState>(ghostTextStore.getState());
    const overlayRef = useRef<HTMLDivElement>(null);

    const fontSize = useEditorStore((s) => s.fontSize);
    const lineHeight = useEditorStore((s) => s.lineHeight);
    const content = useEditorStore((s) => s.content);
    const wordWrap = useEditorStore((s) => s.wordWrap);
    const tabSize = useEditorStore((s) => s.tabSize);
    const { textareaRef } = useEditorRefs();

    // Subscribe to ghost text state changes
    useEffect(() => {
        return ghostTextStore.subscribe(setGhost);
    }, []);

    // Measure exact cursor position using hidden mirror div (same technique as CompletionWidget)
    const measureCursorPosition = useCallback(() => {
        const ta = textareaRef.current;
        if (!ta) return null;

        // Calculate the cursor offset from line/col
        const lines = ta.value.split("\n");
        let offset = 0;
        for (let i = 0; i < ghost.line - 1 && i < lines.length; i++) {
            offset += lines[i].length + 1;
        }
        offset += ghost.col;

        const computed = window.getComputedStyle(ta);
        const properties = [
            "direction", "boxSizing",
            "width", "height",
            "overflowX", "overflowY",
            "borderTopWidth", "borderRightWidth",
            "borderBottomWidth", "borderLeftWidth",
            "borderStyle",
            "paddingTop", "paddingRight",
            "paddingBottom", "paddingLeft",
            "fontStyle", "fontVariant", "fontWeight",
            "fontStretch", "fontSize", "fontSizeAdjust",
            "lineHeight", "fontFamily",
            "textAlign", "textTransform", "textIndent",
            "textDecoration",
            "letterSpacing", "wordSpacing",
            "tabSize",
            "whiteSpace", "wordWrap", "overflowWrap",
        ];

        const div = document.createElement("div");
        div.style.position = "absolute";
        div.style.visibility = "hidden";

        for (const prop of properties) {
            (div.style as any)[prop] = (computed as any)[prop];
        }
        div.style.overflow = "hidden";
        div.style.width = computed.width;

        div.textContent = ta.value.substring(0, offset);

        const span = document.createElement("span");
        span.textContent = ta.value.substring(offset) || ".";
        div.appendChild(span);

        document.body.appendChild(div);

        const caretTop = span.offsetTop + parseInt(computed.borderTopWidth, 10);
        const caretLeft = span.offsetLeft + parseInt(computed.borderLeftWidth, 10);

        document.body.removeChild(div);

        return {
            top: caretTop - ta.scrollTop,
            left: caretLeft - ta.scrollLeft,
        };
    }, [textareaRef, ghost.line, ghost.col, content]);

    // Compute position relative to textarea
    const position = useMemo(() => {
        if (!ghost.visible || !textareaRef.current) return null;
        return measureCursorPosition();
    }, [ghost.visible, ghost.line, ghost.col, measureCursorPosition, textareaRef]);

    if (!ghost.visible || !position) return null;

    // Get the currently streamed portion of the suggestion
    const displayText = ghost.fullText.slice(0, ghost.streamedLength);
    const lines = displayText.split("\n");
    const isMultiLine = lines.length > 1;

    return (
        <div
            ref={overlayRef}
            className="editor-ghost-text-overlay"
            style={{
                position: "absolute",
                top: position.top,
                left: position.left,
                zIndex: 5,
                pointerEvents: "none",
                fontFamily: "var(--editor-font-family, monospace)",
                fontSize,
                lineHeight: `${lineHeight}px`,
                whiteSpace: "pre",
                tabSize,
                maxWidth: "calc(100% - 80px)",
                overflow: "hidden",
            }}
        >
            {/* Ghost text lines */}
            {lines.map((line, i) => (
                <div
                    key={i}
                    style={{
                        color: "var(--editor-ghost-text, #6272a4)",
                        opacity: 0.55,
                        // First line flows inline, subsequent lines start at gutter
                        marginLeft: i > 0 ? -position.left + 10 : 0,
                        animation: i === 0 && ghost.streamedLength <= 1 ? "ghostFadeIn 0.2s ease-out" : undefined,
                    }}
                >
                    {line}
                    {/* Streaming cursor on the last line */}
                    {i === lines.length - 1 && ghost.isStreaming && (
                        <span
                            className="ghost-streaming-cursor"
                            style={{
                                display: "inline-block",
                                width: 2,
                                height: "1em",
                                background: "var(--editor-ghost-cursor, #bd93f9)",
                                opacity: 0.7,
                                marginLeft: 1,
                                verticalAlign: "text-bottom",
                                animation: "ghostCursorBlink 0.6s ease-in-out infinite",
                            }}
                        />
                    )}
                </div>
            ))}

            {/* Tab hint – shown when streaming is complete */}
            {!ghost.isStreaming && ghost.streamedLength > 0 && (
                <div
                    style={{
                        marginTop: 4,
                        marginLeft: isMultiLine ? -position.left + 10 : 0,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        padding: "2px 8px",
                        borderRadius: 4,
                        fontSize: 10,
                        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                        background: "var(--editor-popup-bg, #282a36)",
                        color: "var(--editor-ghost-hint-fg, #bd93f9)",
                        border: "1px solid var(--editor-border, #44475a)",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
                        opacity: 1,
                        pointerEvents: "auto",
                        animation: "ghostFadeIn 0.3s ease-out",
                        zIndex: 6,
                        position: "relative",
                    }}
                >
                    <kbd
                        style={{
                            padding: "0 4px",
                            borderRadius: 3,
                            fontSize: 9,
                            fontWeight: 600,
                            lineHeight: "16px",
                            background: "rgba(255,255,255,0.1)",
                            border: "1px solid rgba(255,255,255,0.15)",
                        }}
                    >
                        Tab
                    </kbd>
                    <span>to accept</span>
                    <span style={{ opacity: 0.5, margin: "0 2px" }}>·</span>
                    <kbd
                        style={{
                            padding: "0 4px",
                            borderRadius: 3,
                            fontSize: 9,
                            fontWeight: 600,
                            lineHeight: "16px",
                            background: "rgba(255,255,255,0.1)",
                            border: "1px solid rgba(255,255,255,0.15)",
                        }}
                    >
                        Esc
                    </kbd>
                    <span style={{ opacity: 0.6 }}>to dismiss</span>
                </div>
            )}

            {/* CSS animations (injected once) */}
            <style>{`
                @keyframes ghostFadeIn {
                    from { opacity: 0; transform: translateY(-2px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
                @keyframes ghostCursorBlink {
                    0%, 100% { opacity: 0.7; }
                    50%      { opacity: 0.1; }
                }
            `}</style>
        </div>
    );
}
