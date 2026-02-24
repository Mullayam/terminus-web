/**
 * @module editor/plugins/components/CompletionWidget
 *
 * Floating auto-completion dropdown widget.
 * Aggregates completions from all registered CompletionProviders
 * and renders them in a VS Code-style popup.
 */
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useEditorStore, useEditorRefs } from "../../state/context";
import type { PluginHostState, CompletionItem, CompletionContext } from "../types";
import type { PluginHost } from "../PluginHost";

interface CompletionWidgetProps {
    host: PluginHost;
    snapshot: PluginHostState;
}

const KIND_ICONS: Record<CompletionItem["kind"], string> = {
    keyword: "⬡",
    function: "ƒ",
    variable: "𝑥",
    snippet: "⟨⟩",
    property: "◆",
    method: "⊕",
    class: "◈",
    module: "☰",
    text: "Aa",
    ai: "✦",
};

const KIND_COLORS: Record<CompletionItem["kind"], string> = {
    keyword: "#ff79c6",
    function: "#8be9fd",
    variable: "#f8f8f2",
    snippet: "#ffb86c",
    property: "#50fa7b",
    method: "#8be9fd",
    class: "#f1fa8c",
    module: "#bd93f9",
    text: "#6272a4",
    ai: "#bd93f9",
};

export function CompletionWidget({ host, snapshot }: CompletionWidgetProps) {
    const [items, setItems] = useState<CompletionItem[]>([]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [visible, setVisible] = useState(false);
    const [position, setPosition] = useState({ top: 0, left: 0 });
    const listRef = useRef<HTMLDivElement>(null);
    const { textareaRef } = useEditorRefs();

    const content = useEditorStore((s) => s.content);
    const cursorLine = useEditorStore((s) => s.cursorLine);
    const cursorCol = useEditorStore((s) => s.cursorCol);
    const lineHeight = useEditorStore((s) => s.lineHeight);
    const fontSize = useEditorStore((s) => s.fontSize);
    const language = useEditorStore((s) => s.language);
    const fileName = useEditorStore((s) => s.fileName);
    const tabSize = useEditorStore((s) => s.tabSize);
    const wordWrap = useEditorStore((s) => s.wordWrap);

    const providers = useMemo(
        () => Array.from(snapshot.completionProviders.values()),
        [snapshot.completionProviders],
    );

    // ── Measure cursor pixel position ───────────────────────
    // Uses the well-known "mirror div" technique (same as the
    // textarea-caret-position library).  A hidden div replicates
    // the textarea's layout styles, the text before the cursor is
    // inserted as plain text, then a <span> with the remaining
    // text is appended.  The span's offsetTop/offsetLeft give us
    // the exact caret coordinates inside the content — accounting
    // for word-wrap, tab-size, padding, etc.

    const measureCursorPosition = useCallback(() => {
        const ta = textareaRef.current;
        if (!ta) return null;

        const position = ta.selectionStart;
        const computed = window.getComputedStyle(ta);

        // Properties that affect text layout — mirrors the list used
        // by the battle-tested textarea-caret-position library.
        const properties = [
            "direction", "boxSizing",
            "width", "height",
            "overflowX", "overflowY",
            "borderTopWidth", "borderRightWidth",
            "borderBottomWidth", "borderLeftWidth",
            "borderStyle",
            "paddingTop", "paddingRight",
            "paddingBottom", "paddingLeft",
            "fontStyle", "fontVariant", "fontWeight",
            "fontStretch", "fontSize", "fontSizeAdjust",
            "lineHeight", "fontFamily",
            "textAlign", "textTransform", "textIndent",
            "textDecoration",
            "letterSpacing", "wordSpacing",
            "tabSize",
            "whiteSpace", "wordWrap", "overflowWrap",
        ];

        const div = document.createElement("div");
        div.id = "completion-mirror";
        div.style.position = "absolute";
        div.style.visibility = "hidden";

        for (const prop of properties) {
            (div.style as any)[prop] = (computed as any)[prop];
        }
        // Prevent a scrollbar flash on the mirror
        div.style.overflow = "hidden";
        // Match the textarea's exact width so word-wrap breaks at the same points
        div.style.width = computed.width;

        div.textContent = ta.value.substring(0, position);

        // The span contains the remaining text (or a fallback period
        // so it always occupies visual space).  Its offset* values
        // represent the exact caret position inside the mirror div.
        const span = document.createElement("span");
        span.textContent = ta.value.substring(position) || ".";
        div.appendChild(span);

        document.body.appendChild(div);

        const caretTop =
            span.offsetTop + parseInt(computed.borderTopWidth, 10);
        const caretLeft =
            span.offsetLeft + parseInt(computed.borderLeftWidth, 10);

        document.body.removeChild(div);

        const taRect = ta.getBoundingClientRect();

        return {
            top: taRect.top + caretTop - ta.scrollTop + lineHeight + 2,
            left: taRect.left + caretLeft - ta.scrollLeft,
        };
    }, [textareaRef, content, cursorLine, cursorCol, lineHeight, tabSize]);

    // ── Compute completions on cursor change ─────────────────

    const fetchCompletions = useCallback(async () => {
        const ta = textareaRef.current;
        if (!ta || providers.length === 0) { setVisible(false); return; }

        const lines = content.split("\n");
        const lineText = lines[cursorLine - 1] ?? "";
        const beforeCursor = lineText.slice(0, cursorCol - 1);
        const wordMatch = beforeCursor.match(/(\w+)$/);
        const wordBeforeCursor = wordMatch?.[1] ?? "";

        // Require at least 1 char to trigger
        if (wordBeforeCursor.length < 1) {
            setVisible(false);
            return;
        }

        const ctx: CompletionContext = {
            content,
            cursorOffset: ta.selectionStart,
            lineNumber: cursorLine,
            column: cursorCol - 1,
            lineText,
            wordBeforeCursor,
            language,
            fileName,
            linesBefore: lines.slice(Math.max(0, cursorLine - 1 - 250), cursorLine - 1),
            linesAfter: lines.slice(cursorLine, Math.min(lines.length, cursorLine + 250)),
        };

        const allItems: CompletionItem[] = [];
        for (const provider of providers) {
            try {
                const providerItems = await provider.provideCompletions(ctx);
                allItems.push(...providerItems);
            } catch {
                // Silently ignore provider errors
            }
        }

        // Sort by sortOrder then alphabetically
        allItems.sort((a, b) => (a.sortOrder ?? 10) - (b.sortOrder ?? 10) || a.label.localeCompare(b.label));

        // Limit
        const limited = allItems.slice(0, 20);

        if (limited.length === 0) {
            setVisible(false);
            return;
        }

        // Measure actual cursor position using hidden span
        const measured = measureCursorPosition();
        if (!measured) { setVisible(false); return; }


        // // Clamp to viewport
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const widgetW = 340;
        const widgetH = Math.min(limited.length * 30 + 8, 263);

        let top = measured.top;
        let left = measured.left;

        // If widget would go below viewport, show above the cursor line
        if (top + widgetH > vh - 8) {
            top = measured.top - lineHeight - widgetH - 4;
        }
        // Clamp horizontal
        if (left + widgetW > vw - 8) {
            left = vw - widgetW - 8;
        }
        if (left < 8) left = 8;

        // Position the widget at the measured cursor coordinates        
        setPosition({ top: measured.top - 55, left: measured.left - 250 });

        setItems(limited);
        setSelectedIndex(0);
        setVisible(true);
    }, [content, cursorLine, cursorCol, providers, textareaRef, lineHeight, fontSize, language, fileName, measureCursorPosition]);

    useEffect(() => {
        const timer = setTimeout(fetchCompletions, 150);
        return () => clearTimeout(timer);
    }, [fetchCompletions]);

    // ── Reposition / dismiss on scroll & resize ──────────────

    useEffect(() => {
        if (!visible) return;
        const ta = textareaRef.current;

        const reposition = () => {
            const measured = measureCursorPosition();
            if (!measured) { setVisible(false); return; }

            const vw = window.innerWidth;
            const vh = window.innerHeight;
            const widgetW = 340;
            const widgetH = Math.min(items.length * 30 + 8, 260);
            let { top, left } = measured;

            if (top + widgetH > vh - 8) {
                top = measured.top - lineHeight - widgetH - 4;
            }
            if (left + widgetW > vw - 8) left = vw - widgetW - 8;
            if (left < 8) left = 8;

            setPosition({ top, left });
        };

        const onScroll = () => reposition();
        const onResize = () => reposition();

        ta?.addEventListener("scroll", onScroll, { passive: true });
        window.addEventListener("resize", onResize, { passive: true });
        return () => {
            ta?.removeEventListener("scroll", onScroll);
            window.removeEventListener("resize", onResize);
        };
    }, [visible, items.length, lineHeight, measureCursorPosition, textareaRef]);

    // ── Keyboard handling ────────────────────────────────────

    useEffect(() => {
        if (!visible) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "ArrowDown") {
                e.preventDefault();
                e.stopPropagation();
                setSelectedIndex((i) => Math.min(i + 1, items.length - 1));
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                e.stopPropagation();
                setSelectedIndex((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter" || e.key === "Tab") {
                e.preventDefault();
                e.stopPropagation();
                acceptCompletion(selectedIndex);
            } else if (e.key === "Escape") {
                e.preventDefault();
                setVisible(false);
            }
        };

        document.addEventListener("keydown", handleKeyDown, true);
        return () => document.removeEventListener("keydown", handleKeyDown, true);
    }, [visible, items, selectedIndex, position]);

    // ── Accept completion ────────────────────────────────────

    const acceptCompletion = useCallback((index: number) => {
        const item = items[index];
        if (!item) return;

        const ta = textareaRef.current;
        if (!ta) return;

        const lines = content.split("\n");
        const lineText = lines[cursorLine - 1] ?? "";
        const beforeCursor = lineText.slice(0, cursorCol - 1);
        const wordMatch = beforeCursor.match(/(\w+)$/);
        const wordBeforeCursor = wordMatch?.[1] ?? "";
        const wordStart = ta.selectionStart - wordBeforeCursor.length;

        const api = host.createAPI("completion-widget");
        const newContent = content.slice(0, wordStart) + item.insertText + content.slice(ta.selectionStart);
        api.setContent(newContent);

        requestAnimationFrame(() => {
            const newPos = wordStart + item.insertText.length;
            ta.selectionStart = newPos;
            ta.selectionEnd = newPos;
            ta.focus();
        });

        setVisible(false);
    }, [items, content, cursorLine, cursorCol, textareaRef, host]);

    // ── Scroll selected item into view ───────────────────────

    useEffect(() => {
        const list = listRef.current;
        if (!list || !visible) return;
        const selected = list.children[selectedIndex] as HTMLElement | undefined;
        selected?.scrollIntoView({ block: "nearest" });
    }, [selectedIndex, visible]);

    if (!visible || items.length === 0) return null;

    return (
        <div
            className="editor-completion-widget"
            style={{
                position: "fixed",
                top: position.top,
                left: position.left,
                zIndex: 10000,
                minWidth: 280,
                maxWidth: 480,
                maxHeight: 260,
                overflow: "auto",
                borderRadius: 6,
                boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
                border: "1px solid var(--editor-border, #44475a)",
                background: "var(--editor-popup-bg, #282a36)",
                fontFamily: "var(--editor-font-family, monospace)",
                fontSize: 12,
            }}
            ref={listRef}
        >
            {items.map((item, i) => (
                <div
                    key={`${item.label}-${i}`}
                    onClick={() => acceptCompletion(i)}
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "4px 10px",
                        cursor: "pointer",
                        background: i === selectedIndex ? "var(--editor-popup-hover-bg, #44475a)" : "transparent",
                        color: "var(--editor-foreground, #f8f8f2)",
                        borderBottom: i < items.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                    }}
                >
                    <span
                        style={{
                            width: 18,
                            height: 18,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 11,
                            fontWeight: 700,
                            borderRadius: 3,
                            flexShrink: 0,
                            background: `${KIND_COLORS[item.kind]}22`,
                            color: KIND_COLORS[item.kind],
                        }}
                    >
                        {KIND_ICONS[item.kind] ?? "?"}
                    </span>
                    <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {item.label}
                    </span>
                    {item.detail && (
                        <span style={{ fontSize: 10, color: "var(--editor-muted, #6272a4)", flexShrink: 0 }}>
                            {item.detail}
                        </span>
                    )}
                </div>
            ))}
        </div>
    );
}
