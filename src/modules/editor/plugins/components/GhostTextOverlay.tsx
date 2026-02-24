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

            {/* Accept / Reject controls + keyboard hints – shown when streaming complete */}
            {!ghost.isStreaming && ghost.streamedLength > 0 && (
                <div
                    style={{
                        marginTop: 4,
                        marginLeft: isMultiLine ? -position.left + 10 : 0,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "3px 8px",
                        borderRadius: 5,
                        fontSize: 11,
                        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                        background: "var(--editor-popup-bg, #282a36)",
                        color: "var(--editor-foreground, #f8f8f2)",
                        border: "1px solid var(--editor-border, #44475a)",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
                        opacity: 1,
                        pointerEvents: "auto",
                        animation: "ghostFadeIn 0.3s ease-out",
                        zIndex: 6,
                        position: "relative",
                    }}
                >
                    {/* Accept button (green check) */}
                    <button
                        onClick={() => ghost.onAccept?.()}
                        title="Accept (Alt+A)"
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 3,
                            background: "rgba(80, 250, 123, 0.15)",
                            border: "1px solid rgba(80, 250, 123, 0.35)",
                            borderRadius: 4,
                            padding: "2px 8px",
                            cursor: "pointer",
                            color: "#50fa7b",
                            fontSize: 11,
                            fontWeight: 500,
                            lineHeight: "16px",
                            transition: "all 0.15s",
                        }}
                        onMouseEnter={(e) => {
                            (e.currentTarget as HTMLElement).style.background = "rgba(80, 250, 123, 0.3)";
                            (e.currentTarget as HTMLElement).style.borderColor = "rgba(80, 250, 123, 0.6)";
                        }}
                        onMouseLeave={(e) => {
                            (e.currentTarget as HTMLElement).style.background = "rgba(80, 250, 123, 0.15)";
                            (e.currentTarget as HTMLElement).style.borderColor = "rgba(80, 250, 123, 0.35)";
                        }}
                    >
                        <span style={{ fontSize: 12, lineHeight: 1 }}>✓</span>
                        <span>Accept</span>
                        <kbd
                            style={{
                                padding: "0 3px",
                                borderRadius: 2,
                                fontSize: 9,
                                fontWeight: 600,
                                lineHeight: "14px",
                                background: "rgba(255,255,255,0.08)",
                                border: "1px solid rgba(255,255,255,0.12)",
                                color: "rgba(80, 250, 123, 0.8)",
                            }}
                        >
                            Alt+A
                        </kbd>
                    </button>

                    <span style={{ opacity: 0.3 }}>│</span>

                    {/* Reject button (red cross) */}
                    <button
                        onClick={() => ghost.onReject?.()}
                        title="Reject (Alt+R)"
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 3,
                            background: "rgba(255, 85, 85, 0.12)",
                            border: "1px solid rgba(255, 85, 85, 0.3)",
                            borderRadius: 4,
                            padding: "2px 8px",
                            cursor: "pointer",
                            color: "#ff5555",
                            fontSize: 11,
                            fontWeight: 500,
                            lineHeight: "16px",
                            transition: "all 0.15s",
                        }}
                        onMouseEnter={(e) => {
                            (e.currentTarget as HTMLElement).style.background = "rgba(255, 85, 85, 0.25)";
                            (e.currentTarget as HTMLElement).style.borderColor = "rgba(255, 85, 85, 0.5)";
                        }}
                        onMouseLeave={(e) => {
                            (e.currentTarget as HTMLElement).style.background = "rgba(255, 85, 85, 0.12)";
                            (e.currentTarget as HTMLElement).style.borderColor = "rgba(255, 85, 85, 0.3)";
                        }}
                    >
                        <span style={{ fontSize: 12, lineHeight: 1 }}>✕</span>
                        <span>Reject</span>
                        <kbd
                            style={{
                                padding: "0 3px",
                                borderRadius: 2,
                                fontSize: 9,
                                fontWeight: 600,
                                lineHeight: "14px",
                                background: "rgba(255,255,255,0.08)",
                                border: "1px solid rgba(255,255,255,0.12)",
                                color: "rgba(255, 85, 85, 0.7)",
                            }}
                        >
                            Alt+R
                        </kbd>
                    </button>

                    <span style={{ opacity: 0.3 }}>│</span>

                    {/* Follow-up action */}
                    <button
                        onClick={() => ghost.onAccept?.()}
                        title="Follow-up (Alt+F)"
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 3,
                            background: "rgba(139, 233, 253, 0.1)",
                            border: "1px solid rgba(139, 233, 253, 0.25)",
                            borderRadius: 4,
                            padding: "2px 8px",
                            cursor: "pointer",
                            color: "#8be9fd",
                            fontSize: 11,
                            fontWeight: 500,
                            lineHeight: "16px",
                            transition: "all 0.15s",
                        }}
                        onMouseEnter={(e) => {
                            (e.currentTarget as HTMLElement).style.background = "rgba(139, 233, 253, 0.2)";
                            (e.currentTarget as HTMLElement).style.borderColor = "rgba(139, 233, 253, 0.45)";
                        }}
                        onMouseLeave={(e) => {
                            (e.currentTarget as HTMLElement).style.background = "rgba(139, 233, 253, 0.1)";
                            (e.currentTarget as HTMLElement).style.borderColor = "rgba(139, 233, 253, 0.25)";
                        }}
                    >
                        <span style={{ fontSize: 11, lineHeight: 1 }}>💬</span>
                        <span>Follow-up</span>
                        <kbd
                            style={{
                                padding: "0 3px",
                                borderRadius: 2,
                                fontSize: 9,
                                fontWeight: 600,
                                lineHeight: "14px",
                                background: "rgba(255,255,255,0.08)",
                                border: "1px solid rgba(255,255,255,0.12)",
                                color: "rgba(139, 233, 253, 0.7)",
                            }}
                        >
                            Alt+F
                        </kbd>
                    </button>
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
