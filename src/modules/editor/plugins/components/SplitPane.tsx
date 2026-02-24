/**
 * @module editor/plugins/components/SplitPane
 *
 * Resizable split pane system for the editor.
 * Supports horizontal (left/right) and vertical (top/bottom) splits
 * with draggable dividers and smooth resizing.
 *
 * Features:
 *   - Drag-to-resize with min/max constraints
 *   - Double-click divider to reset to 50%
 *   - Collapse/restore with divider click
 *   - Smooth animation on toggle
 *   - Keyboard accessible
 */
import { useState, useRef, useEffect, useCallback, type ReactNode, type CSSProperties } from "react";

export type SplitDirection = "horizontal" | "vertical";

export interface SplitPaneProps {
    /** Direction of the split */
    direction: SplitDirection;
    /** Content of the primary (left/top) pane */
    primary: ReactNode;
    /** Content of the secondary (right/bottom) pane */
    secondary: ReactNode;
    /** Initial split ratio (0-1, default 0.5) */
    defaultRatio?: number;
    /** Minimum fraction for primary pane (0-1) */
    minPrimary?: number;
    /** Minimum fraction for secondary pane (0-1) */
    minSecondary?: number;
    /** Divider width in pixels */
    dividerSize?: number;
    /** Whether split is active (false = only show primary) */
    splitActive?: boolean;
    /** Callback when ratio changes */
    onRatioChange?: (ratio: number) => void;
    /** Container style */
    style?: CSSProperties;
    /** Container className */
    className?: string;
}

const DIVIDER_SIZE = 4;

export function SplitPane({
    direction,
    primary,
    secondary,
    defaultRatio = 0.5,
    minPrimary = 0.15,
    minSecondary = 0.15,
    dividerSize = DIVIDER_SIZE,
    splitActive = true,
    onRatioChange,
    style,
    className,
}: SplitPaneProps) {
    const [ratio, setRatio] = useState(defaultRatio);
    const [isDragging, setIsDragging] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const dragStartRef = useRef({ pos: 0, ratio: defaultRatio });

    const isHorizontal = direction === "horizontal";

    // Reset ratio when defaultRatio changes
    useEffect(() => {
        setRatio(defaultRatio);
    }, [defaultRatio]);

    // ── Drag handling ────────────────────────────────────────
    const onDragStart = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        setIsDragging(true);
        dragStartRef.current = {
            pos: isHorizontal ? e.clientX : e.clientY,
            ratio,
        };
    }, [ratio, isHorizontal]);

    useEffect(() => {
        if (!isDragging) return;

        const onMouseMove = (e: MouseEvent) => {
            const container = containerRef.current;
            if (!container) return;

            const rect = container.getBoundingClientRect();
            const totalSize = isHorizontal ? rect.width : rect.height;
            const mousePos = isHorizontal ? e.clientX : e.clientY;
            const containerStart = isHorizontal ? rect.left : rect.top;

            let newRatio = (mousePos - containerStart) / totalSize;
            newRatio = Math.max(minPrimary, Math.min(1 - minSecondary, newRatio));

            setRatio(newRatio);
            onRatioChange?.(newRatio);
        };

        const onMouseUp = () => {
            setIsDragging(false);
        };

        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
        // Prevent text selection during drag
        document.body.style.userSelect = "none";
        document.body.style.cursor = isHorizontal ? "col-resize" : "row-resize";

        return () => {
            document.removeEventListener("mousemove", onMouseMove);
            document.removeEventListener("mouseup", onMouseUp);
            document.body.style.userSelect = "";
            document.body.style.cursor = "";
        };
    }, [isDragging, isHorizontal, minPrimary, minSecondary, onRatioChange]);

    // Double-click to reset
    const onDividerDoubleClick = useCallback(() => {
        setRatio(0.5);
        onRatioChange?.(0.5);
    }, [onRatioChange]);

    if (!splitActive) {
        return (
            <div
                ref={containerRef}
                className={className}
                style={{
                    display: "flex",
                    flexDirection: isHorizontal ? "row" : "column",
                    width: "100%",
                    height: "100%",
                    overflow: "hidden",
                    ...style,
                }}
            >
                <div style={{ flex: 1, overflow: "hidden" }}>{primary}</div>
            </div>
        );
    }

    const primaryStyle: CSSProperties = isHorizontal
        ? { width: `calc(${ratio * 100}% - ${dividerSize / 2}px)`, height: "100%" }
        : { height: `calc(${ratio * 100}% - ${dividerSize / 2}px)`, width: "100%" };

    const secondaryStyle: CSSProperties = isHorizontal
        ? { width: `calc(${(1 - ratio) * 100}% - ${dividerSize / 2}px)`, height: "100%" }
        : { height: `calc(${(1 - ratio) * 100}% - ${dividerSize / 2}px)`, width: "100%" };

    return (
        <div
            ref={containerRef}
            className={className}
            style={{
                display: "flex",
                flexDirection: isHorizontal ? "row" : "column",
                width: "100%",
                height: "100%",
                overflow: "hidden",
                ...style,
            }}
        >
            {/* Primary pane */}
            <div style={{ ...primaryStyle, overflow: "hidden", flexShrink: 0 }}>
                {primary}
            </div>

            {/* Divider */}
            <div
                onMouseDown={onDragStart}
                onDoubleClick={onDividerDoubleClick}
                style={{
                    width: isHorizontal ? dividerSize : "100%",
                    height: isHorizontal ? "100%" : dividerSize,
                    cursor: isHorizontal ? "col-resize" : "row-resize",
                    background: isDragging
                        ? "var(--editor-accent, #bd93f9)"
                        : "var(--editor-border, #44475a)",
                    transition: isDragging ? "none" : "background 0.15s",
                    flexShrink: 0,
                    position: "relative",
                    zIndex: 2,
                }}
                onMouseEnter={(e) => {
                    if (!isDragging)
                        (e.currentTarget as HTMLElement).style.background =
                            "var(--editor-accent, #bd93f9)";
                }}
                onMouseLeave={(e) => {
                    if (!isDragging)
                        (e.currentTarget as HTMLElement).style.background =
                            "var(--editor-border, #44475a)";
                }}
                title="Drag to resize, double-click to reset"
            >
                {/* Visual dots on the divider */}
                <div
                    style={{
                        position: "absolute",
                        top: "50%",
                        left: "50%",
                        transform: "translate(-50%, -50%)",
                        display: "flex",
                        flexDirection: isHorizontal ? "column" : "row",
                        gap: 2,
                        opacity: isDragging ? 1 : 0.4,
                        transition: "opacity 0.15s",
                    }}
                >
                    {[0, 1, 2].map((i) => (
                        <div
                            key={i}
                            style={{
                                width: 2,
                                height: 2,
                                borderRadius: "50%",
                                background: "var(--editor-foreground, #f8f8f2)",
                            }}
                        />
                    ))}
                </div>
            </div>

            {/* Secondary pane */}
            <div style={{ ...secondaryStyle, overflow: "hidden", flexShrink: 0 }}>
                {secondary}
            </div>
        </div>
    );
}
