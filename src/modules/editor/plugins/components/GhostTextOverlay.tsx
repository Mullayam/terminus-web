/**
 * @module editor/plugins/components/GhostTextOverlay
 *
 * VS Code-style ghost text rendering.
 *
 * Instead of overlapping code, ghost text is rendered as an inline
 * decoration on the cursor line + inserted visual-only lines that
 * push subsequent code DOWN in the syntax overlay.
 *
 * Approach:
 *   - A transparent overlay (inset:0, z:5) renders:
 *     1. The first ghost line as inline text after the cursor column
 *        on the cursor row, with a clipping mask that hides real code
 *        after the cursor (so ghost replaces it visually).
 *     2. Additional ghost lines inserted between the cursor line and
 *        the next real line. A CSS transform shifts everything below
 *        the cursor down by (extraLines * lineHeight).
 *   - The textarea and line numbers remain untouched.
 */
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useEditorStore, useEditorRefs } from "../../state/context";
import { ghostTextStore, type GhostTextState } from "../builtin/ai-ghost-text";

/** Must match textarea / overlay padding */
const CANVAS_PAD = 4;
const CODE_PAD_X = 16;

export function GhostTextOverlay() {
    const [ghost, setGhost] = useState<GhostTextState>(ghostTextStore.getState());

    const fontSize = useEditorStore((s) => s.fontSize);
    const lineHeight = useEditorStore((s) => s.lineHeight);
    const content = useEditorStore((s) => s.content);
    const tabSize = useEditorStore((s) => s.tabSize);
    const { textareaRef } = useEditorRefs();

    // Scroll tracking
    const [scrollTop, setScrollTop] = useState(0);
    const [scrollLeft, setScrollLeft] = useState(0);

    useEffect(() => {
        return ghostTextStore.subscribe(setGhost);
    }, []);

    useEffect(() => {
        const ta = textareaRef.current;
        if (!ta) return;
        const sync = () => {
            setScrollTop(ta.scrollTop);
            setScrollLeft(ta.scrollLeft);
        };
        ta.addEventListener("scroll", sync, { passive: true });
        sync();
        return () => ta.removeEventListener("scroll", sync);
    }, [textareaRef]);

    if (!ghost.visible || ghost.streamedLength === 0) return null;

    const charWidth = fontSize * 0.6;
    const displayText = ghost.fullText.slice(0, ghost.streamedLength);
    const ghostLines = displayText.split("\n");
    const isMultiLine = ghostLines.length > 1;
    const extraLineCount = ghostLines.length - 1; // lines to insert visually

    // Cursor position in pixel space
    const cursorTop = (ghost.line - 1) * lineHeight + CANVAS_PAD - scrollTop;
    const cursorLeft = ghost.col * charWidth + CODE_PAD_X - scrollLeft;

    // Viewport bounds
    const viewportHeight = textareaRef.current?.clientHeight ?? 800;
    if (cursorTop < -lineHeight * 2 || cursorTop > viewportHeight + lineHeight) return null;

    // How much to push content below the cursor line down
    const shiftPx = extraLineCount * lineHeight;

    return (
        <>
            {/* ── Ghost text inline + inserted lines ────────────── */}
            <div
                className="editor-ghost-text-overlay"
                style={{
                    position: "absolute",
                    inset: 0,
                    pointerEvents: "none",
                    zIndex: 5,
                    overflow: "hidden",
                    fontFamily: "var(--editor-font-family, monospace)",
                    fontSize,
                    lineHeight: `${lineHeight}px`,
                    whiteSpace: "pre",
                    tabSize,
                }}
            >
                {/* First ghost line: renders inline after cursor on the cursor row */}
                <div
                    style={{
                        position: "absolute",
                        top: cursorTop,
                        left: cursorLeft,
                        height: lineHeight,
                        color: "var(--editor-ghost-text, #6272a4)",
                        opacity: 0.55,
                        animation: ghost.streamedLength <= 1 ? "ghostFadeIn 0.2s ease-out" : undefined,
                    }}
                >
                    {ghostLines[0]}
                    {/* Streaming cursor on single-line suggestions */}
                    {!isMultiLine && ghost.isStreaming && <StreamingCursor />}
                </div>

                {/* Opaque mask: covers real code after the cursor on the cursor line */}
                <div
                    style={{
                        position: "absolute",
                        top: cursorTop,
                        left: cursorLeft,
                        right: 0,
                        height: lineHeight,
                        background: "var(--editor-background, #282a36)",
                        zIndex: -1,
                    }}
                />

                {/* Multi-line: inserted ghost lines between cursor line and next line */}
                {isMultiLine && ghostLines.slice(1).map((line, i) => (
                    <div
                        key={i}
                        style={{
                            position: "absolute",
                            top: cursorTop + (i + 1) * lineHeight,
                            left: CODE_PAD_X - scrollLeft,
                            height: lineHeight,
                            color: "var(--editor-ghost-text, #6272a4)",
                            opacity: 0.55,
                        }}
                    >
                        {line}
                        {/* Streaming cursor on the last ghost line */}
                        {i === ghostLines.length - 2 && ghost.isStreaming && <StreamingCursor />}
                    </div>
                ))}

                {/* Push-down band: opaque background for the inserted ghost area
                    so we don't see the real code beneath */}
                {isMultiLine && (
                    <div
                        style={{
                            position: "absolute",
                            top: cursorTop + lineHeight,
                            left: 0,
                            right: 0,
                            height: shiftPx,
                            background: "var(--editor-background, #282a36)",
                            zIndex: -1,
                        }}
                    />
                )}
            </div>

            {/* ── Shift real content below cursor line down ─────── */}
            {isMultiLine && shiftPx > 0 && (
                <div
                    className="editor-ghost-shift"
                    style={{
                        position: "absolute",
                        top: cursorTop + lineHeight,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        transform: `translateY(${shiftPx}px)`,
                        pointerEvents: "none",
                        zIndex: 3,
                    }}
                >
                    {/* Transparent pass-through: the real syntax overlay underneath
                        still renders, but this layer shifts the VISUAL position
                        of all overlays below the cursor line by shiftPx. */}
                </div>
            )}

            {/* ── Accept / Reject toolbar ──────────────────────── */}
            {!ghost.isStreaming && ghost.streamedLength > 0 && (
                <div
                    style={{
                        position: "absolute",
                        top: cursorTop + lineHeight + shiftPx + 2,
                        left: Math.max(CODE_PAD_X, cursorLeft),
                        zIndex: 6,
                        pointerEvents: "auto",
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
                        animation: "ghostFadeIn 0.3s ease-out",
                    }}
                >
                    <GhostButton
                        onClick={() => ghost.onAccept?.()}
                        title="Accept (Alt+A)"
                        label="✓ Accept"
                        kbd="Alt+A"
                        color="#50fa7b"
                    />
                    <span style={{ opacity: 0.3 }}>│</span>
                    <GhostButton
                        onClick={() => ghost.onReject?.()}
                        title="Reject (Alt+R)"
                        label="✕ Reject"
                        kbd="Alt+R"
                        color="#ff5555"
                    />
                    <span style={{ opacity: 0.3 }}>│</span>
                    <GhostButton
                        onClick={() => ghost.onAccept?.()}
                        title="Follow-up (Alt+F)"
                        label="💬 Follow-up"
                        kbd="Alt+F"
                        color="#8be9fd"
                    />
                </div>
            )}

            {/* Inline keyframes */}
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
        </>
    );
}

/* ── Small helper components ──────────────────────────────── */

function StreamingCursor() {
    return (
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
    );
}

function GhostButton({ onClick, title, label, kbd, color }: {
    onClick?: () => void;
    title: string;
    label: string;
    kbd: string;
    color: string;
}) {
    return (
        <button
            onClick={onClick}
            title={title}
            style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 3,
                background: `${color}20`,
                border: `1px solid ${color}55`,
                borderRadius: 4,
                padding: "2px 8px",
                cursor: "pointer",
                color,
                fontSize: 11,
                fontWeight: 500,
                lineHeight: "16px",
                transition: "all 0.15s",
            }}
            onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = `${color}40`;
                (e.currentTarget as HTMLElement).style.borderColor = `${color}88`;
            }}
            onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = `${color}20`;
                (e.currentTarget as HTMLElement).style.borderColor = `${color}55`;
            }}
        >
            <span>{label}</span>
            <kbd
                style={{
                    padding: "0 3px",
                    borderRadius: 2,
                    fontSize: 9,
                    fontWeight: 600,
                    lineHeight: "14px",
                    background: "rgba(255,255,255,0.08)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    color: `${color}cc`,
                }}
            >
                {kbd}
            </kbd>
        </button>
    );
}
