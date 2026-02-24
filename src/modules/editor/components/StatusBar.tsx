/**
 * @module editor/components/StatusBar
 * Bottom status bar with language, cursor, line count, encoding, tab size,
 * line endings, auto-save indicator, and whitespace visibility toggle.
 */
import { memo, useState, useRef, useEffect } from "react";
import { useEditorStore } from "../state/context";

export const StatusBar = memo(function StatusBar(props: { language: string }) {
    const lineCount = useEditorStore((s) => s.lineCount);
    const charCount = useEditorStore((s) => s.charCount);
    const cursorLine = useEditorStore((s) => s.cursorLine);
    const cursorCol = useEditorStore((s) => s.cursorCol);
    const wordWrap = useEditorStore((s) => s.wordWrap);
    const fontSize = useEditorStore((s) => s.fontSize);
    const readOnly = useEditorStore((s) => s.readOnly);
    const tabSize = useEditorStore((s) => s.tabSize);
    const lineEnding = useEditorStore((s) => s.lineEnding);
    const autoSave = useEditorStore((s) => s.autoSave);
    const showWhitespace = useEditorStore((s) => s.showWhitespace);
    const openShortcuts = useEditorStore((s) => s.openShortcuts);
    const setTabSize = useEditorStore((s) => s.setTabSize);
    const setLineEnding = useEditorStore((s) => s.setLineEnding);
    const setAutoSave = useEditorStore((s) => s.setAutoSave);
    const toggleWhitespace = useEditorStore((s) => s.toggleWhitespace);

    // Tab size dropdown
    const [showTabMenu, setShowTabMenu] = useState(false);
    const [showEolMenu, setShowEolMenu] = useState(false);
    const tabMenuRef = useRef<HTMLDivElement>(null);
    const eolMenuRef = useRef<HTMLDivElement>(null);

    // Close dropdowns on click outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (tabMenuRef.current && !tabMenuRef.current.contains(e.target as Node)) setShowTabMenu(false);
            if (eolMenuRef.current && !eolMenuRef.current.contains(e.target as Node)) setShowEolMenu(false);
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const cellStyle: React.CSSProperties = {
        display: "flex", alignItems: "center", gap: 4,
        padding: "0 8px", fontSize: 11, whiteSpace: "nowrap",
        color: "var(--editor-muted)",
    };

    const clickCellStyle: React.CSSProperties = {
        ...cellStyle,
        cursor: "pointer",
        background: "transparent",
        border: "none",
        borderRadius: 3,
    };

    const sepStyle: React.CSSProperties = {
        width: 1, height: 12, background: "var(--editor-border)", opacity: 0.5,
    };

    const dropdownStyle: React.CSSProperties = {
        position: "absolute",
        bottom: "100%",
        left: 0,
        marginBottom: 4,
        background: "var(--editor-popup-bg)",
        border: "1px solid var(--editor-border)",
        borderRadius: 6,
        padding: 4,
        zIndex: 50,
        minWidth: 100,
        boxShadow: "0 -2px 8px rgba(0,0,0,0.3)",
    };

    const dropdownItemStyle = (active: boolean): React.CSSProperties => ({
        display: "block",
        width: "100%",
        padding: "4px 12px",
        fontSize: 11,
        textAlign: "left",
        background: active ? "var(--editor-popup-hover-bg)" : "transparent",
        color: active ? "var(--editor-accent)" : "var(--editor-foreground)",
        border: "none",
        borderRadius: 3,
        cursor: "pointer",
    });

    return (
        <div
            className="flex items-center justify-between select-none shrink-0"
            style={{
                background: "var(--editor-statusbar-bg)",
                borderTop: "1px solid var(--editor-border)",
                height: 24,
                minHeight: 24,
                padding: "0 8px",
            }}
        >
            {/* Left */}
            <div className="flex items-center">
                <span style={cellStyle} title="Language">{props.language}</span>
                <div style={sepStyle} />
                <span style={cellStyle}>UTF-8</span>
                <div style={sepStyle} />

                {/* Line ending selector */}
                <div className="relative" ref={eolMenuRef}>
                    <button
                        style={clickCellStyle}
                        onClick={() => setShowEolMenu(!showEolMenu)}
                        title="Line Ending"
                        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--editor-popup-hover-bg)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                        {lineEnding.toUpperCase()}
                    </button>
                    {showEolMenu && (
                        <div style={dropdownStyle}>
                            <button
                                style={dropdownItemStyle(lineEnding === "lf")}
                                onClick={() => { setLineEnding("lf"); setShowEolMenu(false); }}
                                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--editor-popup-hover-bg)")}
                                onMouseLeave={(e) => (e.currentTarget.style.background = lineEnding === "lf" ? "var(--editor-popup-hover-bg)" : "transparent")}
                            >
                                LF (Unix)
                            </button>
                            <button
                                style={dropdownItemStyle(lineEnding === "crlf")}
                                onClick={() => { setLineEnding("crlf"); setShowEolMenu(false); }}
                                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--editor-popup-hover-bg)")}
                                onMouseLeave={(e) => (e.currentTarget.style.background = lineEnding === "crlf" ? "var(--editor-popup-hover-bg)" : "transparent")}
                            >
                                CRLF (Windows)
                            </button>
                        </div>
                    )}
                </div>
                <div style={sepStyle} />

                {/* Tab size selector */}
                <div className="relative" ref={tabMenuRef}>
                    <button
                        style={clickCellStyle}
                        onClick={() => setShowTabMenu(!showTabMenu)}
                        title="Tab Size"
                        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--editor-popup-hover-bg)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                        Spaces: {tabSize}
                    </button>
                    {showTabMenu && (
                        <div style={dropdownStyle}>
                            {[2, 4, 8].map((size) => (
                                <button
                                    key={size}
                                    style={dropdownItemStyle(tabSize === size)}
                                    onClick={() => { setTabSize(size); setShowTabMenu(false); }}
                                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--editor-popup-hover-bg)")}
                                    onMouseLeave={(e) => (e.currentTarget.style.background = tabSize === size ? "var(--editor-popup-hover-bg)" : "transparent")}
                                >
                                    {size} spaces
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                <div style={sepStyle} />

                <span style={cellStyle}>{wordWrap ? "Wrap" : "No Wrap"}</span>
                <div style={sepStyle} />
                <span style={cellStyle}>{fontSize}px</span>

                {/* Whitespace visibility */}
                <div style={sepStyle} />
                <button
                    style={{
                        ...clickCellStyle,
                        color: showWhitespace ? "var(--editor-accent)" : "var(--editor-muted)",
                    }}
                    onClick={toggleWhitespace}
                    title="Toggle Whitespace Visibility"
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--editor-popup-hover-bg)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                    {showWhitespace ? "WS:ON" : "WS:OFF"}
                </button>

                {/* Auto-save indicator */}
                <div style={sepStyle} />
                <button
                    style={{
                        ...clickCellStyle,
                        color: autoSave ? "var(--editor-success)" : "var(--editor-muted)",
                    }}
                    onClick={() => setAutoSave(!autoSave)}
                    title="Toggle Auto Save"
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--editor-popup-hover-bg)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                    {autoSave ? "Auto Save: ON" : "Auto Save: OFF"}
                </button>

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
                        ...clickCellStyle,
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
