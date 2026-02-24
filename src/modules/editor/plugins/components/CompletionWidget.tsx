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

    const providers = useMemo(
        () => Array.from(snapshot.completionProviders.values()),
        [snapshot.completionProviders],
    );

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

        // Calculate position relative to textarea
        const taRect = ta.getBoundingClientRect();
        const lineTop = (cursorLine - 1) * lineHeight + 10 - ta.scrollTop;
        const charWidth = fontSize * 0.6; // Approximate
        const colLeft = (cursorCol - 1 - wordBeforeCursor.length) * charWidth + 10 - ta.scrollLeft;

        setPosition({
            top: taRect.top + lineTop + lineHeight + 2,
            left: taRect.left + colLeft,
        });

        setItems(limited);
        setSelectedIndex(0);
        setVisible(true);
    }, [content, cursorLine, cursorCol, providers, textareaRef, lineHeight, fontSize, language, fileName]);

    useEffect(() => {
        const timer = setTimeout(fetchCompletions, 150);
        return () => clearTimeout(timer);
    }, [fetchCompletions]);

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
    }, [visible, items, selectedIndex]);

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
