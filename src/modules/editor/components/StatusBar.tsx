/**
 * @module editor/components/StatusBar
 * Bottom status bar with language, cursor, line count, encoding, etc.
 */
import { memo } from "react";
import { useEditorStore } from "../state/context";

export const StatusBar = memo(function StatusBar(props: { language: string }) {
    const lineCount = useEditorStore((s) => s.lineCount);
    const charCount = useEditorStore((s) => s.charCount);
    const cursorLine = useEditorStore((s) => s.cursorLine);
    const cursorCol = useEditorStore((s) => s.cursorCol);
    const wordWrap = useEditorStore((s) => s.wordWrap);
    const fontSize = useEditorStore((s) => s.fontSize);
    const readOnly = useEditorStore((s) => s.readOnly);
    const openShortcuts = useEditorStore((s) => s.openShortcuts);

    const cellStyle: React.CSSProperties = {
        display: "flex", alignItems: "center", gap: 4,
        padding: "0 8px", fontSize: 11, whiteSpace: "nowrap",
        color: "var(--editor-muted)",
    };

    const sepStyle: React.CSSProperties = {
        width: 1, height: 12, background: "var(--editor-border)", opacity: 0.5,
    };

    return (
        <div
            className="flex items-center justify-between select-none"
            style={{
                background: "var(--editor-statusbar-bg)",
                borderTop: "1px solid var(--editor-border)",
                height: 24,
                padding: "0 8px",
            }}
        >
            {/* Left */}
            <div className="flex items-center">
                <span style={cellStyle} title="Language">{props.language}</span>
                <div style={sepStyle} />
                <span style={cellStyle}>UTF-8</span>
                <div style={sepStyle} />
                <span style={cellStyle}>{wordWrap ? "Wrap" : "No Wrap"}</span>
                <div style={sepStyle} />
                <span style={cellStyle}>{fontSize}px</span>
                {readOnly && (
                    <>
                        <div style={sepStyle} />
                        <span style={{ ...cellStyle, color: "var(--editor-accent)" }}>READ-ONLY</span>
                    </>
                )}
            </div>

            {/* Right */}
            <div className="flex items-center">
                <span style={cellStyle}>
                    Ln {cursorLine}, Col {cursorCol}
                </span>
                <div style={sepStyle} />
                <span style={cellStyle}>
                    {lineCount} lines · {charCount.toLocaleString()} chars
                </span>
                <div style={sepStyle} />
                <button
                    onClick={openShortcuts}
                    style={{
                        ...cellStyle,
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        textDecoration: "underline",
                        textDecorationStyle: "dotted",
                        textUnderlineOffset: 2,
                    }}
                >
                    Ctrl+K shortcuts
                </button>
            </div>
        </div>
    );
});
