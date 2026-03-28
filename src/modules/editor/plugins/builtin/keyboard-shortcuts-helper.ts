/**
 * @module editor/plugins/builtin/keyboard-shortcuts-helper
 *
 * Shows a keyboard shortcuts cheat sheet panel.
 */
import { createElement, useState, useMemo } from "react";
import type { ExtendedEditorPlugin, ExtendedPluginAPI } from "../types";

interface ShortcutEntry {
    key: string;
    description: string;
    category: string;
}

const SHORTCUTS: ShortcutEntry[] = [
    // File
    { key: "Ctrl+S", description: "Save", category: "File" },
    { key: "Ctrl+Shift+S", description: "Save As", category: "File" },
    { key: "Ctrl+N", description: "New File", category: "File" },

    // Edit
    { key: "Ctrl+Z", description: "Undo", category: "Edit" },
    { key: "Ctrl+Y", description: "Redo", category: "Edit" },
    { key: "Ctrl+/", description: "Toggle Comment", category: "Edit" },
    { key: "Ctrl+J", description: "Join Lines", category: "Edit" },
    { key: "Ctrl+Shift+K", description: "Delete Line", category: "Edit" },
    { key: "Alt+↑/↓", description: "Move Line Up/Down", category: "Edit" },
    { key: "Shift+Alt+↑/↓", description: "Duplicate Line Up/Down", category: "Edit" },
    { key: "Ctrl+Shift+Space", description: "Expand Selection", category: "Edit" },

    // Navigation
    { key: "Ctrl+G", description: "Go to Line", category: "Navigation" },
    { key: "Ctrl+Shift+O", description: "Symbol Outline", category: "Navigation" },
    { key: "Alt+←/→", description: "Navigate Back/Forward", category: "Navigation" },
    { key: "Ctrl+Alt+K", description: "Toggle Bookmark", category: "Navigation" },
    { key: "Ctrl+Alt+N/P", description: "Next/Prev Bookmark", category: "Navigation" },

    // View
    { key: "Ctrl+Shift+F11", description: "Focus Mode", category: "View" },
    { key: "Ctrl+K Z", description: "Zen Mode", category: "View" },
    { key: "Ctrl+Shift+T", description: "Toggle TODO Panel", category: "View" },
    { key: "Ctrl+Shift+G", description: "Toggle Diff View", category: "View" },

    // Selection
    { key: "Ctrl+Shift+L", description: "Select All Occurrences", category: "Selection" },
    { key: "Ctrl+D", description: "Select Next Occurrence", category: "Selection" },
];

function ShortcutsPanel({ api }: { api: ExtendedPluginAPI }) {
    const [filter, setFilter] = useState("");
    const filtered = useMemo(() => {
        if (!filter) return SHORTCUTS;
        const lower = filter.toLowerCase();
        return SHORTCUTS.filter(
            (s) => s.description.toLowerCase().includes(lower) ||
                s.key.toLowerCase().includes(lower) ||
                s.category.toLowerCase().includes(lower)
        );
    }, [filter]);

    const categories = useMemo(() => {
        const cats = new Map<string, ShortcutEntry[]>();
        for (const s of filtered) {
            if (!cats.has(s.category)) cats.set(s.category, []);
            cats.get(s.category)!.push(s);
        }
        return cats;
    }, [filtered]);

    return createElement("div", { style: { height: "100%", overflow: "auto", fontSize: "12px" } },
        createElement("div", { style: { padding: "8px", borderBottom: "1px solid var(--editor-border, #44475a)" } },
            createElement("input", {
                type: "text",
                placeholder: "Search shortcuts...",
                value: filter,
                onChange: (e: React.ChangeEvent<HTMLInputElement>) => setFilter(e.target.value),
                style: {
                    width: "100%", padding: "4px 8px", borderRadius: "4px",
                    border: "1px solid var(--editor-border, #44475a)",
                    background: "var(--editor-bg, #282a36)",
                    color: "var(--editor-foreground, #f8f8f2)", fontSize: "11px",
                },
            }),
        ),
        Array.from(categories.entries()).map(([cat, entries]) =>
            createElement("div", { key: cat, style: { padding: "4px 0" } },
                createElement("div", {
                    style: { padding: "4px 8px", fontWeight: 600, fontSize: "11px", color: "var(--editor-muted, #6272a4)" },
                }, cat),
                entries.map((s, i) =>
                    createElement("div", {
                        key: i,
                        style: { display: "flex", justifyContent: "space-between", padding: "2px 8px 2px 16px" },
                    },
                        createElement("span", null, s.description),
                        createElement("kbd", {
                            style: {
                                fontSize: "10px", padding: "1px 4px", borderRadius: "3px",
                                border: "1px solid var(--editor-border, #44475a)",
                                background: "var(--editor-popup-bg, #1e1f29)",
                            },
                        }, s.key),
                    ),
                ),
            ),
        ),
    );
}

export function createKeyboardShortcutsHelperPlugin(): ExtendedEditorPlugin {
    return {
        id: "keyboard-shortcuts-helper",
        name: "Keyboard Shortcuts Helper",
        version: "1.0.0",
        description: "Shows a searchable keyboard shortcuts cheat sheet",
        category: "tools",
        defaultEnabled: true,

        panels: [
            {
                id: "keyboard-shortcuts-helper:panel",
                title: "Shortcuts",
                position: "right",
                defaultSize: 300,
                render: (api) => createElement(ShortcutsPanel, { api }),
            },
        ],

        onActivate(api) {
            api.registerCommand("shortcuts.show", () => {
                api.togglePanel("keyboard-shortcuts-helper:panel");
            });

            api.registerKeybinding({
                id: "keyboard-shortcuts-helper:show",
                label: "Show Keyboard Shortcuts",
                keys: "Ctrl+Shift+?",
                handler: (e) => { e.preventDefault(); api.togglePanel("keyboard-shortcuts-helper:panel"); },
                when: "editor",
                category: "Help",
            });
        },
    };
}
