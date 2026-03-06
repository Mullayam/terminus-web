import { useEffect, useRef, useCallback, memo } from "react";
import type { Terminal } from "@xterm/xterm";

interface CursorTextOverlayProps {
    termRef: React.RefObject<Terminal | null>;
    text: string;
}

/**
 * Renders a dim text overlay at the terminal cursor position.
 * Shows only when commandBuffer is empty. No API calls — just displays the text prop.
 */
const CursorTextOverlay = memo(function CursorTextOverlay({
    termRef,

    text,
}: CursorTextOverlayProps) {
    const overlayRef = useRef<HTMLSpanElement>(null);
    const rafId = useRef(0);
    const intervalId = useRef<ReturnType<typeof setInterval> | null>(null);

    const syncPosition = useCallback(() => {
        const el = overlayRef.current;
        const term = termRef.current;
        if (!el || !term) return;

        const core = (term as any)._core;
        const dims = core?._renderService?.dimensions;
        if (!dims) return;

        const screen = term.element?.querySelector(
            ".xterm-screen",
        ) as HTMLElement | null;
        const offsetX = screen?.offsetLeft ?? 0;
        const offsetY = screen?.offsetTop ?? 0;

        const buf = term.buffer.active;
        const cellW = dims.css.cell.width;
        const x = (buf.cursorX + 2) * cellW + offsetX;
        const y = buf.cursorY * dims.css.cell.height + offsetY;

        el.style.transform = `translate3d(${x}px,${y}px,0)`;
    }, [termRef]);

    useEffect(() => {
        const scheduleSync = () => {
            cancelAnimationFrame(rafId.current);
            rafId.current = requestAnimationFrame(syncPosition);
        };

        let disposed = false;
        let cursorDisposable: { dispose(): void } | null = null;

        const tryAttach = () => {
            const term = termRef.current;
            if (!term || disposed) return false;
            scheduleSync();
            cursorDisposable = term.onCursorMove(scheduleSync);
            if (intervalId.current) {
                clearInterval(intervalId.current);
                intervalId.current = null;
            }
            return true;
        };

        if (!tryAttach()) {
            intervalId.current = setInterval(() => tryAttach(), 200);
        }

        return () => {
            disposed = true;
            cursorDisposable?.dispose();
            cancelAnimationFrame(rafId.current);
            if (intervalId.current) {
                clearInterval(intervalId.current);
                intervalId.current = null;
            }
        };
    }, [syncPosition, termRef]);

    useEffect(() => {
        const id = requestAnimationFrame(syncPosition);
        return () => cancelAnimationFrame(id);
    }, [syncPosition]);

    const term = termRef.current;

    return (
        <span
            ref={overlayRef}
            aria-hidden
            style={{
                position: "absolute",
                left: 0,
                top: 0,
                willChange: "transform",
                pointerEvents: "none",
                whiteSpace: "pre",
                fontFamily: term?.options.fontFamily ?? "monospace",
                fontSize: term?.options.fontSize ?? 15,
                lineHeight: `${(term as any)?._core?._renderService?.dimensions?.css?.cell?.height ?? 18}px`,
                color: "rgba(255,255,255,0.35)",
                zIndex: 10,
                userSelect: "none",
                WebkitUserSelect: "none",
            }}
        >
            {text}
        </span>
    );
});

export default CursorTextOverlay;
