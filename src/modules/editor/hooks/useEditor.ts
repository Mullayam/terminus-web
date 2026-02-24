/**
 * @module editor/hooks/useEditor
 * Core editing hook – wires text-ops to the textarea and pushes results into the store.
 * Also keeps cursorLine / cursorCol in sync on every input / selection change.
 * Includes auto-close brackets/quotes, auto-indent on Enter, and snippet expansion.
 */
import { useCallback, useEffect } from "react";
import { useEditorStore, useEditorStoreApi, useEditorRefs } from "../state/context";
import * as ops from "../core/text-ops";
import type { TextSelection } from "../core/text-ops";
import { cursorToLineCol } from "../core/text-ops";
import { SnippetEngine } from "../core/snippets";

/** Bracket/quote pair map */
const BRACKET_PAIRS: Record<string, string> = {
    "(": ")",
    "[": "]",
    "{": "}",
    '"': '"',
    "'": "'",
    "`": "`",
};

const CLOSING_CHARS = new Set(Object.values(BRACKET_PAIRS));

export function useEditor() {
    const storeApi = useEditorStoreApi();
    const { textareaRef } = useEditorRefs();
    const content = useEditorStore((s) => s.content);
    const readOnly = useEditorStore((s) => s.readOnly);
    const autoCloseBrackets = useEditorStore((s) => s.autoCloseBrackets);
    const tabSize = useEditorStore((s) => s.tabSize);
    const prismLanguage = useEditorStore((s) => s.prismLanguage);

    /* ── cursor tracking ──────────────────────────── */
    const syncCursor = useCallback(() => {
        const ta = textareaRef.current;
        if (!ta) return;
        const { line, col } = cursorToLineCol(ta.value, ta.selectionStart);
        storeApi.getState().setCursor(line, col);
    }, [storeApi, textareaRef]);

    useEffect(() => {
        const ta = textareaRef.current;
        if (!ta) return;
        const events = ["click", "keyup", "select"] as const;
        events.forEach((e) => ta.addEventListener(e, syncCursor));
        return () => events.forEach((e) => ta.removeEventListener(e, syncCursor));
    }, [syncCursor, textareaRef]);

    /* ── helpers ───────────────────────────────────── */
    const getSel = (): TextSelection => {
        const ta = textareaRef.current;
        return ta ? { start: ta.selectionStart, end: ta.selectionEnd } : { start: 0, end: 0 };
    };

    const applyResult = useCallback(
        (result: ops.TextOpResult) => {
            const ta = textareaRef.current;
            if (!ta) return;
            storeApi.getState().pushChange(result.content);
            requestAnimationFrame(() => {
                ta.selectionStart = result.selStart;
                ta.selectionEnd = result.selEnd;
                ta.focus();
                syncCursor();
            });
        },
        [storeApi, textareaRef, syncCursor],
    );

    /* ── auto-close brackets / quotes ─────────────── */
    const handleAutoClose = useCallback(
        (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
            if (readOnly || !autoCloseBrackets) return false;
            const ta = e.currentTarget;
            const key = e.key;
            const cursorPos = ta.selectionStart;
            const selEnd = ta.selectionEnd;
            const hasSelection = cursorPos !== selEnd;
            const val = ta.value;

            // Auto-close brackets/quotes
            if (BRACKET_PAIRS[key]) {
                e.preventDefault();
                const closing = BRACKET_PAIRS[key];
                if (hasSelection) {
                    // Wrap selection
                    const selected = val.slice(cursorPos, selEnd);
                    const newContent = val.slice(0, cursorPos) + key + selected + closing + val.slice(selEnd);
                    storeApi.getState().pushChange(newContent);
                    requestAnimationFrame(() => {
                        ta.selectionStart = cursorPos + 1;
                        ta.selectionEnd = selEnd + 1;
                        syncCursor();
                    });
                } else {
                    // Insert pair
                    const newContent = val.slice(0, cursorPos) + key + closing + val.slice(cursorPos);
                    storeApi.getState().pushChange(newContent);
                    requestAnimationFrame(() => {
                        ta.selectionStart = cursorPos + 1;
                        ta.selectionEnd = cursorPos + 1;
                        syncCursor();
                    });
                }
                return true;
            }

            // Skip over closing bracket/quote if next char matches
            if (CLOSING_CHARS.has(key) && val[cursorPos] === key && !hasSelection) {
                e.preventDefault();
                requestAnimationFrame(() => {
                    ta.selectionStart = cursorPos + 1;
                    ta.selectionEnd = cursorPos + 1;
                    syncCursor();
                });
                return true;
            }

            // Delete matching pair on Backspace
            if (key === "Backspace" && cursorPos > 0 && !hasSelection) {
                const charBefore = val[cursorPos - 1];
                const charAfter = val[cursorPos];
                if (BRACKET_PAIRS[charBefore] && BRACKET_PAIRS[charBefore] === charAfter) {
                    e.preventDefault();
                    const newContent = val.slice(0, cursorPos - 1) + val.slice(cursorPos + 1);
                    storeApi.getState().pushChange(newContent);
                    requestAnimationFrame(() => {
                        ta.selectionStart = cursorPos - 1;
                        ta.selectionEnd = cursorPos - 1;
                        syncCursor();
                    });
                    return true;
                }
            }

            return false;
        },
        [readOnly, autoCloseBrackets, storeApi, syncCursor],
    );

    /* ── auto-indent on Enter ─────────────────────── */
    const handleAutoIndent = useCallback(
        (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
            if (readOnly || e.key !== "Enter") return false;
            const ta = e.currentTarget;
            const val = ta.value;
            const cursorPos = ta.selectionStart;

            // Find current line start
            const lineStart = val.lastIndexOf("\n", cursorPos - 1) + 1;
            const currentLine = val.slice(lineStart, cursorPos);
            const indent = currentLine.match(/^[\t ]*/)?.[0] ?? "";

            // Check if cursor is after an opening bracket
            const charBefore = val[cursorPos - 1];
            const charAfter = val[cursorPos];
            const isOpenBracket = charBefore === "{" || charBefore === "(" || charBefore === "[";
            const isCloseBracket = charAfter === "}" || charAfter === ")" || charAfter === "]";

            if (isOpenBracket && isCloseBracket) {
                // Add extra indent between brackets
                e.preventDefault();
                const tabStr = " ".repeat(tabSize);
                const insert = "\n" + indent + tabStr + "\n" + indent;
                const newContent = val.slice(0, cursorPos) + insert + val.slice(cursorPos);
                storeApi.getState().pushChange(newContent);
                requestAnimationFrame(() => {
                    const newPos = cursorPos + indent.length + tabStr.length + 1;
                    ta.selectionStart = newPos;
                    ta.selectionEnd = newPos;
                    syncCursor();
                });
                return true;
            }

            if (isOpenBracket) {
                // Indent after opening bracket
                e.preventDefault();
                const tabStr = " ".repeat(tabSize);
                const insert = "\n" + indent + tabStr;
                const newContent = val.slice(0, cursorPos) + insert + val.slice(cursorPos);
                storeApi.getState().pushChange(newContent);
                requestAnimationFrame(() => {
                    const newPos = cursorPos + insert.length;
                    ta.selectionStart = newPos;
                    ta.selectionEnd = newPos;
                    syncCursor();
                });
                return true;
            }

            if (indent) {
                // Maintain current indentation
                e.preventDefault();
                const insert = "\n" + indent;
                const newContent = val.slice(0, cursorPos) + insert + val.slice(cursorPos);
                storeApi.getState().pushChange(newContent);
                requestAnimationFrame(() => {
                    const newPos = cursorPos + insert.length;
                    ta.selectionStart = newPos;
                    ta.selectionEnd = newPos;
                    syncCursor();
                });
                return true;
            }

            return false;
        },
        [readOnly, tabSize, storeApi, syncCursor],
    );

    /* ── snippet expansion on Tab ─────────────────── */
    const handleSnippetExpand = useCallback(
        (e: React.KeyboardEvent<HTMLTextAreaElement>): boolean => {
            if (readOnly || e.key !== "Tab" || e.shiftKey || e.ctrlKey || e.altKey) return false;
            const ta = e.currentTarget;
            if (ta.selectionStart !== ta.selectionEnd) return false; // has selection → normal tab
            const result = SnippetEngine.tryExpand(ta.value, ta.selectionStart, prismLanguage);
            if (!result) return false;
            e.preventDefault();
            storeApi.getState().pushChange(result.newContent);
            requestAnimationFrame(() => {
                ta.selectionStart = result.cursorPos;
                ta.selectionEnd = result.cursorPos;
                ta.focus();
                syncCursor();
            });
            return true;
        },
        [readOnly, prismLanguage, storeApi, syncCursor],
    );

    /** Combined keydown handler for textarea (snippet → auto-close → auto-indent) */
    const handleTextareaKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
            // Try snippet expansion first (Tab)
            if (handleSnippetExpand(e)) return;
            // Try auto-close
            if (handleAutoClose(e)) return;
            // Then auto-indent
            if (handleAutoIndent(e)) return;
        },
        [handleSnippetExpand, handleAutoClose, handleAutoIndent],
    );

    /* ── exposed ops ──────────────────────────────── */
    const indent = useCallback(() => {
        if (readOnly) return;
        applyResult(ops.indentSelection(content, getSel()));
    }, [content, readOnly, applyResult]);

    const outdent = useCallback(() => {
        if (readOnly) return;
        applyResult(ops.outdentSelection(content, getSel()));
    }, [content, readOnly, applyResult]);

    const deleteLine = useCallback(() => {
        if (readOnly) return;
        const ta = textareaRef.current;
        if (!ta) return;
        applyResult(ops.deleteLine(content, ta.selectionStart));
    }, [content, readOnly, applyResult, textareaRef]);

    const duplicateLine = useCallback(() => {
        if (readOnly) return;
        const ta = textareaRef.current;
        if (!ta) return;
        applyResult(ops.duplicateLine(content, ta.selectionStart));
    }, [content, readOnly, applyResult, textareaRef]);

    const moveLineUp = useCallback(() => {
        if (readOnly) return;
        const ta = textareaRef.current;
        if (!ta) return;
        applyResult(ops.moveLineUp(content, ta.selectionStart));
    }, [content, readOnly, applyResult, textareaRef]);

    const moveLineDown = useCallback(() => {
        if (readOnly) return;
        const ta = textareaRef.current;
        if (!ta) return;
        applyResult(ops.moveLineDown(content, ta.selectionStart));
    }, [content, readOnly, applyResult, textareaRef]);

    const toggleComment = useCallback(() => {
        if (readOnly) return;
        applyResult(ops.toggleLineComment(content, getSel()));
    }, [content, readOnly, applyResult]);

    const sortLines = useCallback(() => {
        if (readOnly) return;
        applyResult(ops.sortLines(content, getSel()));
    }, [content, readOnly, applyResult]);

    const toUpper = useCallback(() => {
        if (readOnly) return;
        applyResult(ops.toUpperCase(content, getSel()));
    }, [content, readOnly, applyResult]);

    const toLower = useCallback(() => {
        if (readOnly) return;
        applyResult(ops.toLowerCase(content, getSel()));
    }, [content, readOnly, applyResult]);

    const trimWhitespace = useCallback(() => {
        if (readOnly) return;
        const trimmed = ops.trimTrailingWhitespace(content);
        if (trimmed !== content) {
            storeApi.getState().pushChange(trimmed);
        }
    }, [content, readOnly, storeApi]);

    const wrapBrackets = useCallback(() => {
        if (readOnly) return;
        const result = ops.wrapWithBrackets(content, getSel(), "[");
        if (result) applyResult(result);
    }, [content, readOnly, applyResult]);

    const wrapBraces = useCallback(() => {
        if (readOnly) return;
        const result = ops.wrapWithBrackets(content, getSel(), "{");
        if (result) applyResult(result);
    }, [content, readOnly, applyResult]);

    /** Programmatic content set (keeps textarea synced) */
    const setContent = useCallback(
        (value: string) => {
            storeApi.getState().pushChange(value);
            const ta = textareaRef.current;
            if (ta) {
                ta.value = value;
                syncCursor();
            }
        },
        [storeApi, textareaRef, syncCursor],
    );

    return {
        indent, outdent, deleteLine, duplicateLine,
        moveLineUp, moveLineDown, toggleComment, sortLines,
        toUpper, toLower, trimWhitespace, wrapBrackets, wrapBraces,
        setContent, syncCursor, handleTextareaKeyDown,
    };
}
