/**
 * @module editor/hooks/useViewport
 *
 * Tracks the visible line range in the editor textarea via scroll events.
 * Uses requestAnimationFrame for throttled updates to avoid layout thrashing.
 *
 * Returns { scrollTop, clientHeight, startLine, endLine, totalLines }
 * where startLine/endLine include a configurable buffer for smooth scrolling.
 */
import { useState, useCallback, useEffect, useRef } from "react";
import { useEditorStore, useEditorRefs } from "../state/context";

export interface ViewportInfo {
    /** Current scrollTop of the textarea */
    scrollTop: number;
    /** Visible height of the textarea */
    clientHeight: number;
    /** First visible line index (0-based, includes buffer) */
    startLine: number;
    /** Last visible line index (exclusive, includes buffer) */
    endLine: number;
    /** Total number of lines in the document */
    totalLines: number;
}

/** Number of extra lines rendered above/below the visible area */
const BUFFER_LINES = 30;

export function useViewport(): ViewportInfo {
    const lineHeight = useEditorStore((s) => s.lineHeight);
    const lineCount = useEditorStore((s) => s.lineCount);
    const { textareaRef } = useEditorRefs();

    const [viewport, setViewport] = useState<ViewportInfo>({
        scrollTop: 0,
        clientHeight: 0,
        startLine: 0,
        endLine: Math.min(80, lineCount),
        totalLines: lineCount,
    });

    const rafRef = useRef(0);
    const prevStartRef = useRef(0);
    const prevEndRef = useRef(0);

    const updateViewport = useCallback(() => {
        const ta = textareaRef.current;
        if (!ta) return;

        const scrollTop = ta.scrollTop;
        const clientHeight = ta.clientHeight;
        const padding = 10; // matches editor padding-top

        const rawStart = Math.floor(Math.max(0, scrollTop - padding) / lineHeight);
        const rawEnd = Math.ceil((scrollTop + clientHeight - padding) / lineHeight) + 1;

        const startLine = Math.max(0, rawStart - BUFFER_LINES);
        const endLine = Math.min(lineCount, rawEnd + BUFFER_LINES);

        // Only update state if the range actually changed (avoids re-renders)
        if (startLine !== prevStartRef.current || endLine !== prevEndRef.current) {
            prevStartRef.current = startLine;
            prevEndRef.current = endLine;
            setViewport({
                scrollTop,
                clientHeight,
                startLine,
                endLine,
                totalLines: lineCount,
            });
        }
    }, [textareaRef, lineHeight, lineCount]);

    // Listen for scroll events on the textarea
    useEffect(() => {
        const ta = textareaRef.current;
        if (!ta) return;

        const handleScroll = () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            rafRef.current = requestAnimationFrame(updateViewport);
        };

        ta.addEventListener("scroll", handleScroll, { passive: true });

        // Also observe resize to recalculate on dimension changes
        let ro: ResizeObserver | null = null;
        if (typeof ResizeObserver !== "undefined") {
            ro = new ResizeObserver(handleScroll);
            ro.observe(ta);
        }

        // Initial calculation
        updateViewport();

        return () => {
            ta.removeEventListener("scroll", handleScroll);
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            ro?.disconnect();
        };
    }, [textareaRef, updateViewport]);

    // Recalculate when lineCount changes (content loaded/modified)
    useEffect(() => {
        updateViewport();
    }, [lineCount, updateViewport]);

    return viewport;
}
