/**
 * @module editor/components/StatusBar
 * VS Code-style bottom status bar. Uses CSS classes from editor.css.
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

    const [showTabMenu, setShowTabMenu] = useState(false);
    const [showEolMenu, setShowEolMenu] = useState(false);
    const tabMenuRef = useRef<HTMLDivElement>(null);
    const eolMenuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (tabMenuRef.current && !tabMenuRef.current.contains(e.target as Node)) setShowTabMenu(false);
            if (eolMenuRef.current && !eolMenuRef.current.contains(e.target as Node)) setShowEolMenu(false);
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <div className="flex items-center w-full" style={{ height: "100%" }}>
            {/* Left items */}
            <div className="flex items-center">
                <span className="editor-statusbar__item" title="Language">{props.language}</span>
                <div className="editor-statusbar__sep" />
                <span className="editor-statusbar__item">UTF-8</span>
                <div className="editor-statusbar__sep" />

                {/* Line ending selector */}
                <div className="relative" ref={eolMenuRef}>
                    <button
                        className="editor-statusbar__btn"
                        onClick={() => setShowEolMenu(!showEolMenu)}
                        title="Line Ending"
                    >
                        {lineEnding.toUpperCase()}
                    </button>
                    {showEolMenu && (
                        <div className="editor-statusbar__dropdown">
                            <button
                                className={`editor-statusbar__dropdown-item${lineEnding === "lf" ? " editor-statusbar__dropdown-item--active" : ""}`}
                                onClick={() => { setLineEnding("lf"); setShowEolMenu(false); }}
                            >
                                LF (Unix)
                            </button>
                            <button
                                className={`editor-statusbar__dropdown-item${lineEnding === "crlf" ? " editor-statusbar__dropdown-item--active" : ""}`}
                                onClick={() => { setLineEnding("crlf"); setShowEolMenu(false); }}
                            >
                                CRLF (Windows)
                            </button>
                        </div>
                    )}
                </div>
                <div className="editor-statusbar__sep" />

                {/* Tab size selector */}
                <div className="relative" ref={tabMenuRef}>
                    <button
                        className="editor-statusbar__btn"
                        onClick={() => setShowTabMenu(!showTabMenu)}
                        title="Tab Size"
                    >
                        Spaces: {tabSize}
                    </button>
                    {showTabMenu && (
                        <div className="editor-statusbar__dropdown">
                            {[2, 4, 8].map((size) => (
                                <button
                                    key={size}
                                    className={`editor-statusbar__dropdown-item${tabSize === size ? " editor-statusbar__dropdown-item--active" : ""}`}
                                    onClick={() => { setTabSize(size); setShowTabMenu(false); }}
                                >
                                    {size} spaces
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                <div className="editor-statusbar__sep" />

                <span className="editor-statusbar__item">{wordWrap ? "Wrap" : "No Wrap"}</span>
                <div className="editor-statusbar__sep" />
                <span className="editor-statusbar__item">{fontSize}px</span>
                <div className="editor-statusbar__sep" />

                <button
                    className={`editor-statusbar__btn${showWhitespace ? " editor-statusbar__btn--active" : ""}`}
                    onClick={toggleWhitespace}
                    title="Toggle Whitespace Visibility"
                >
                    {showWhitespace ? "WS:ON" : "WS:OFF"}
                </button>
                <div className="editor-statusbar__sep" />

                <button
                    className="editor-statusbar__btn"
                    style={{ color: autoSave ? "var(--editor-success)" : undefined }}
                    onClick={() => setAutoSave(!autoSave)}
                    title="Toggle Auto Save"
                >
                    {autoSave ? "Auto Save: ON" : "Auto Save: OFF"}
                </button>

                {readOnly && (
                    <>
                        <div className="editor-statusbar__sep" />
                        <span className="editor-statusbar__item editor-statusbar__btn--active">READ-ONLY</span>
                    </>
                )}
            </div>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Right items */}
            <div className="flex items-center">
                <span className="editor-statusbar__item">
                    Ln {cursorLine}, Col {cursorCol}
                </span>
                <div className="editor-statusbar__sep" />
                <span className="editor-statusbar__item">
                    {lineCount} lines · {charCount.toLocaleString()} chars
                </span>
                <div className="editor-statusbar__sep" />
                <button
                    className="editor-statusbar__btn"
                    onClick={openShortcuts}
                    style={{ textDecoration: "underline", textDecorationStyle: "dotted", textUnderlineOffset: 2 }}
                >
                    Ctrl+K shortcuts
                </button>
            </div>
        </div>
    );
});
