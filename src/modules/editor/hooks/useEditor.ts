/**
 * @module editor/hooks/useEditor
 * Core editing hook – wires text-ops to the textarea and pushes results into the store.
 * Also keeps cursorLine / cursorCol in sync on every input / selection change.
 */
import { useCallback, useEffect } from "react";
import { useEditorStore, useEditorStoreApi, useEditorRefs } from "../state/context";
import * as ops from "../core/text-ops";
import type { TextSelection } from "../core/text-ops";
import { cursorToLineCol } from "../core/text-ops";

export function useEditor() {
    const storeApi = useEditorStoreApi();
    const { textareaRef } = useEditorRefs();
    const content = useEditorStore((s) => s.content);
    const readOnly = useEditorStore((s) => s.readOnly);

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
        setContent, syncCursor,
    };
}
