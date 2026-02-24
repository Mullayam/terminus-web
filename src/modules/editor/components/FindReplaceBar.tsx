/**
 * @module editor/components/FindReplaceBar
 * Find & Replace bar with match navigation, case-sensitive, whole-word, and regex toggles.
 */
import { memo, useCallback, useEffect } from "react";
import {
    Search, ArrowUp, ArrowDown, Replace, X,
    CaseSensitive, WholeWord, Regex,
} from "lucide-react";
import { useEditorStore, useEditorRefs } from "../state/context";

export const FindReplaceBar = memo(function FindReplaceBar() {
    const showFind = useEditorStore((s) => s.showFind);
    const showReplace = useEditorStore((s) => s.showReplace);
    const findText = useEditorStore((s) => s.findText);
    const replaceText = useEditorStore((s) => s.replaceText);
    const findMatchCount = useEditorStore((s) => s.findMatchCount);
    const findMatchIndex = useEditorStore((s) => s.findMatchIndex);
    const content = useEditorStore((s) => s.content);
    const findCaseSensitive = useEditorStore((s) => s.findCaseSensitive);
    const findWholeWord = useEditorStore((s) => s.findWholeWord);
    const findUseRegex = useEditorStore((s) => s.findUseRegex);

    const setFindText = useEditorStore((s) => s.setFindText);
    const setReplaceText = useEditorStore((s) => s.setReplaceText);
    const setFindMatchCount = useEditorStore((s) => s.setFindMatchCount);
    const setFindMatchIndex = useEditorStore((s) => s.setFindMatchIndex);
    const closeFind = useEditorStore((s) => s.closeFind);
    const openFind = useEditorStore((s) => s.openFind);
    const openFindReplace = useEditorStore((s) => s.openFindReplace);
    const pushChange = useEditorStore((s) => s.pushChange);
    const toggleFindCaseSensitive = useEditorStore((s) => s.toggleFindCaseSensitive);
    const toggleFindWholeWord = useEditorStore((s) => s.toggleFindWholeWord);
    const toggleFindUseRegex = useEditorStore((s) => s.toggleFindUseRegex);

    const { findInputRef, textareaRef } = useEditorRefs();

    // Focus find input when opened
    useEffect(() => {
        if (showFind) setTimeout(() => findInputRef.current?.focus(), 50);
    }, [showFind, findInputRef]);

    /** Build regex based on current find options */
    const buildFindRegex = useCallback((text: string): RegExp | null => {
        if (!text) return null;
        try {
            let pattern: string;
            if (findUseRegex) {
                pattern = text;
            } else {
                pattern = text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            }
            if (findWholeWord) {
                pattern = `\\b${pattern}\\b`;
            }
            const flags = findCaseSensitive ? "g" : "gi";
            return new RegExp(pattern, flags);
        } catch {
            return null;
        }
    }, [findCaseSensitive, findWholeWord, findUseRegex]);

    // Update match count when find text, content, or options change
    useEffect(() => {
        if (!findText) { setFindMatchCount(0); setFindMatchIndex(-1); return; }
        const regex = buildFindRegex(findText);
        if (!regex) { setFindMatchCount(0); setFindMatchIndex(-1); return; }
        const matches = [...content.matchAll(regex)];
        setFindMatchCount(matches.length);
        if (matches.length > 0) {
            const ta = textareaRef.current;
            const cursorPos = ta ? ta.selectionStart : 0;
            const idx = matches.findIndex((m) => (m.index ?? 0) >= cursorPos);
            setFindMatchIndex(idx >= 0 ? idx : 0);
        } else {
            setFindMatchIndex(-1);
        }
    }, [findText, content, findCaseSensitive, findWholeWord, findUseRegex, buildFindRegex, setFindMatchCount, setFindMatchIndex, textareaRef]);

    const doFindNext = useCallback(() => {
        if (!findText || findMatchCount === 0) return;
        const regex = buildFindRegex(findText);
        if (!regex) return;
        const matches = [...content.matchAll(regex)];
        const nextIdx = (findMatchIndex + 1) % matches.length;
        setFindMatchIndex(nextIdx);
        const match = matches[nextIdx];
        const ta = textareaRef.current;
        if (ta && match) {
            ta.focus();
            ta.selectionStart = match.index ?? 0;
            ta.selectionEnd = (match.index ?? 0) + match[0].length;
        }
    }, [findText, findMatchCount, findMatchIndex, content, buildFindRegex, setFindMatchIndex, textareaRef]);

    const doFindPrev = useCallback(() => {
        if (!findText || findMatchCount === 0) return;
        const regex = buildFindRegex(findText);
        if (!regex) return;
        const matches = [...content.matchAll(regex)];
        const prevIdx = (findMatchIndex - 1 + matches.length) % matches.length;
        setFindMatchIndex(prevIdx);
        const match = matches[prevIdx];
        const ta = textareaRef.current;
        if (ta && match) {
            ta.focus();
            ta.selectionStart = match.index ?? 0;
            ta.selectionEnd = (match.index ?? 0) + match[0].length;
        }
    }, [findText, findMatchCount, findMatchIndex, content, buildFindRegex, setFindMatchIndex, textareaRef]);

    const doReplaceOne = () => {
        if (!findText || findMatchCount === 0) return;
        const regex = buildFindRegex(findText);
        if (!regex) return;
        const matches = [...content.matchAll(regex)];
        const idx = Math.max(0, findMatchIndex);
        const match = matches[idx];
        if (!match) return;
        const pos = match.index ?? 0;
        pushChange(content.substring(0, pos) + replaceText + content.substring(pos + match[0].length));
    };

    const doReplaceAll = () => {
        if (!findText) return;
        const regex = buildFindRegex(findText);
        if (!regex) return;
        pushChange(content.replace(regex, replaceText));
    };

    const handleClose = () => {
        closeFind();
        textareaRef.current?.focus();
    };

    if (!showFind) return null;

    const inputStyle: React.CSSProperties = {
        background: "var(--editor-input-bg)",
        border: "1px solid var(--editor-input-border)",
        color: "var(--editor-foreground)",
        fontSize: 12,
        fontFamily: "var(--editor-font-family)",
        padding: "4px 8px",
        borderRadius: 4,
        outline: "none",
    };

    const btnStyle: React.CSSProperties = {
        padding: 4,
        borderRadius: 4,
        color: "var(--editor-muted)",
        cursor: "pointer",
        background: "transparent",
        border: "none",
    };

    const toggleBtnStyle = (active: boolean): React.CSSProperties => ({
        ...btnStyle,
        background: active ? "var(--editor-accent)" : "transparent",
        color: active ? "#fff" : "var(--editor-muted)",
        borderRadius: 3,
        width: 24,
        height: 24,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
    });

    return (
        <div
            className="flex items-center gap-2 px-3 py-1.5 flex-wrap"
            style={{
                background: "var(--editor-toolbar-bg)",
                borderBottom: "1px solid var(--editor-border)",
            }}
        >
            <Search className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--editor-muted)" }} />
            <input
                ref={findInputRef}
                value={findText}
                onChange={(e) => setFindText(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === "Enter") { e.shiftKey ? doFindPrev() : doFindNext(); }
                    if (e.key === "Escape") handleClose();
                }}
                onFocus={(e) => (e.target.style.borderColor = "var(--editor-input-focus-border)")}
                onBlur={(e) => (e.target.style.borderColor = "var(--editor-input-border)")}
                placeholder="Find…"
                style={{ ...inputStyle, width: 192 }}
            />

            {/* Search option toggles */}
            <button
                onClick={toggleFindCaseSensitive}
                style={toggleBtnStyle(findCaseSensitive)}
                title="Match Case (Alt+C)"
            >
                <CaseSensitive className="w-3.5 h-3.5" />
            </button>
            <button
                onClick={toggleFindWholeWord}
                style={toggleBtnStyle(findWholeWord)}
                title="Match Whole Word (Alt+W)"
            >
                <WholeWord className="w-3.5 h-3.5" />
            </button>
            <button
                onClick={toggleFindUseRegex}
                style={toggleBtnStyle(findUseRegex)}
                title="Use Regular Expression (Alt+R)"
            >
                <Regex className="w-3.5 h-3.5" />
            </button>

            {findText && (
                <span className="text-[11px] min-w-[60px]" style={{ color: "var(--editor-muted)" }}>
                    {findMatchCount > 0 ? `${findMatchIndex + 1} of ${findMatchCount}` : "No results"}
                </span>
            )}
            <button onClick={doFindPrev} disabled={findMatchCount === 0} style={{ ...btnStyle, opacity: findMatchCount === 0 ? 0.3 : 1 }} title="Previous (Shift+Enter)">
                <ArrowUp className="w-3.5 h-3.5" />
            </button>
            <button onClick={doFindNext} disabled={findMatchCount === 0} style={{ ...btnStyle, opacity: findMatchCount === 0 ? 0.3 : 1 }} title="Next (Enter)">
                <ArrowDown className="w-3.5 h-3.5" />
            </button>
            <button
                onClick={() => { if (showReplace) { closeFind(); openFind(); } else { openFindReplace(); } }}
                style={{
                    ...btnStyle,
                    background: showReplace ? "var(--editor-popup-hover-bg)" : "transparent",
                    color: showReplace ? "var(--editor-foreground)" : "var(--editor-muted)",
                }}
                title="Toggle Replace"
            >
                <Replace className="w-3.5 h-3.5" />
            </button>

            {showReplace && (
                <>
                    <input
                        value={replaceText}
                        onChange={(e) => setReplaceText(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Escape") handleClose(); }}
                        onFocus={(e) => (e.target.style.borderColor = "var(--editor-input-focus-border)")}
                        onBlur={(e) => (e.target.style.borderColor = "var(--editor-input-border)")}
                        placeholder="Replace…"
                        style={{ ...inputStyle, width: 160 }}
                    />
                    <button
                        onClick={doReplaceOne}
                        disabled={findMatchCount === 0}
                        className="text-[11px] px-2 py-1 rounded-md"
                        style={{
                            background: "var(--editor-popup-hover-bg)",
                            color: "var(--editor-foreground)",
                            border: "none",
                            cursor: "pointer",
                            opacity: findMatchCount === 0 ? 0.3 : 1,
                        }}
                    >
                        Replace
                    </button>
                    <button
                        onClick={doReplaceAll}
                        disabled={findMatchCount === 0}
                        className="text-[11px] px-2 py-1 rounded-md"
                        style={{
                            background: "var(--editor-popup-hover-bg)",
                            color: "var(--editor-foreground)",
                            border: "none",
                            cursor: "pointer",
                            opacity: findMatchCount === 0 ? 0.3 : 1,
                        }}
                    >
                        All
                    </button>
                </>
            )}
            <button onClick={handleClose} style={{ ...btnStyle, marginLeft: "auto" }} title="Close (Escape)">
                <X className="w-3.5 h-3.5" />
            </button>
        </div>
    );
});
