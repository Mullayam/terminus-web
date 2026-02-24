/**
 * @module editor/components/GoToLineBar
 * "Go to Line" input bar.
 */
import { memo, useEffect } from "react";
import { Hash, X } from "lucide-react";
import { useEditorStore, useEditorRefs } from "../state/context";
import { lineToPosition } from "../core/text-ops";

export const GoToLineBar = memo(function GoToLineBar() {
    const showGoToLine = useEditorStore((s) => s.showGoToLine);
    const goToLineValue = useEditorStore((s) => s.goToLineValue);
    const lineCount = useEditorStore((s) => s.lineCount);
    const content = useEditorStore((s) => s.content);
    const closeGoToLine = useEditorStore((s) => s.closeGoToLine);
    const setGoToLineValue = useEditorStore((s) => s.setGoToLineValue);
    const setCursor = useEditorStore((s) => s.setCursor);
    const { goToLineInputRef, textareaRef } = useEditorRefs();

    useEffect(() => {
        if (showGoToLine) setTimeout(() => goToLineInputRef.current?.focus(), 50);
    }, [showGoToLine, goToLineInputRef]);

    if (!showGoToLine) return null;

    const doGoTo = () => {
        const num = parseInt(goToLineValue);
        if (isNaN(num) || num < 1) return;
        const ta = textareaRef.current;
        if (!ta) return;
        const target = Math.min(num, lineCount);
        const pos = lineToPosition(content, target);
        ta.focus();
        ta.selectionStart = ta.selectionEnd = pos;
        setCursor(target, 1);
        closeGoToLine();
    };

    const handleClose = () => { closeGoToLine(); textareaRef.current?.focus(); };

    const inputStyle: React.CSSProperties = {
        background: "var(--editor-input-bg)",
        border: "1px solid var(--editor-input-border)",
        color: "var(--editor-foreground)",
        fontSize: 12,
        fontFamily: "var(--editor-font-family)",
        padding: "4px 8px",
        borderRadius: 4,
        outline: "none",
        width: 128,
    };

    return (
        <div
            className="flex items-center gap-2 px-3 py-1.5"
            style={{
                background: "var(--editor-toolbar-bg)",
                borderBottom: "1px solid var(--editor-border)",
            }}
        >
            <Hash className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--editor-muted)" }} />
            <span className="text-[12px]" style={{ color: "var(--editor-muted)" }}>Go to Line:</span>
            <input
                ref={goToLineInputRef}
                value={goToLineValue}
                onChange={(e) => setGoToLineValue(e.target.value.replace(/\D/g, ""))}
                onKeyDown={(e) => {
                    if (e.key === "Enter") doGoTo();
                    if (e.key === "Escape") handleClose();
                }}
                onFocus={(e) => (e.target.style.borderColor = "var(--editor-input-focus-border)")}
                onBlur={(e) => (e.target.style.borderColor = "var(--editor-input-border)")}
                placeholder={`1 – ${lineCount}`}
                style={inputStyle}
            />
            <button
                onClick={doGoTo}
                className="text-[11px] px-2 py-1 rounded-md"
                style={{
                    background: "var(--editor-popup-hover-bg)",
                    color: "var(--editor-foreground)",
                    border: "none",
                    cursor: "pointer",
                }}
            >
                Go
            </button>
            <button
                onClick={handleClose}
                style={{
                    padding: 4, borderRadius: 4, color: "var(--editor-muted)",
                    cursor: "pointer", background: "transparent", border: "none", marginLeft: "auto",
                }}
                title="Close"
            >
                <X className="w-3.5 h-3.5" />
            </button>
        </div>
    );
});
