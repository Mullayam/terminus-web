/**
 * @module editor/plugins/builtin/todo-highlighter
 *
 * Highlights TODO, FIXME, HACK, BUG, NOTE, XXX comments
 * and provides a summary panel.
 */
import { createElement, useMemo } from "react";
import type { ExtendedEditorPlugin, ExtendedPluginAPI, InlineDecoration, PanelDescriptor } from "../types";

interface TodoItem {
    tag: string;
    text: string;
    line: number;
}

const TODO_REGEX = /\b(TODO|FIXME|HACK|BUG|NOTE|XXX|WARN|OPTIMIZE|REVIEW)\b[:\s]*(.*)/gi;

const TAG_COLORS: Record<string, string> = {
    TODO: "#f1fa8c",
    FIXME: "#ff5555",
    HACK: "#ffb86c",
    BUG: "#ff5555",
    NOTE: "#8be9fd",
    XXX: "#ff79c6",
    WARN: "#ffb86c",
    OPTIMIZE: "#bd93f9",
    REVIEW: "#50fa7b",
};

function findTodos(content: string): TodoItem[] {
    const items: TodoItem[] = [];
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
        let match: RegExpExecArray | null;
        TODO_REGEX.lastIndex = 0;
        while ((match = TODO_REGEX.exec(lines[i])) !== null) {
            items.push({
                tag: match[1].toUpperCase(),
                text: match[2].trim(),
                line: i + 1,
            });
        }
    }
    return items;
}

function TodoPanel({ api }: { api: ExtendedPluginAPI }) {
    const content = api.getContent();
    const todos = useMemo(() => findTodos(content), [content]);

    if (todos.length === 0) {
        return createElement("div", {
            style: { padding: "20px", textAlign: "center", color: "var(--editor-muted, #6272a4)" },
        }, "No TODOs found");
    }

    return createElement("div", { style: { height: "100%", overflow: "auto", fontSize: "12px" } },
        createElement("div", {
            style: { padding: "8px", borderBottom: "1px solid var(--editor-border, #44475a)", fontWeight: 600 },
        }, `${todos.length} item${todos.length !== 1 ? "s" : ""}`),
        todos.map((todo, i) =>
            createElement("div", {
                key: i,
                onClick: () => api.executeCommand("goToLine", todo.line),
                style: { padding: "4px 8px", cursor: "pointer", display: "flex", gap: "8px", alignItems: "center" },
            },
                createElement("span", {
                    style: {
                        color: TAG_COLORS[todo.tag] ?? "#f8f8f2",
                        fontWeight: 600, fontSize: "10px", minWidth: "50px",
                    },
                }, todo.tag),
                createElement("span", {
                    style: { flex: 1, color: "var(--editor-foreground, #f8f8f2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
                }, todo.text || "(no description)"),
                createElement("span", {
                    style: { color: "var(--editor-muted, #6272a4)", fontSize: "10px" },
                }, `L${todo.line}`),
            ),
        ),
    );
}

export function createTodoHighlighterPlugin(): ExtendedEditorPlugin {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    return {
        id: "todo-highlighter",
        name: "TODO Highlighter",
        version: "1.0.0",
        description: "Highlights TODO/FIXME/HACK/BUG comments and provides a summary panel",
        category: "tools",
        defaultEnabled: true,

        panels: [
            {
                id: "todo-highlighter:panel",
                title: "TODOs",
                position: "right",
                defaultSize: 300,
                render: (api) => createElement(TodoPanel, { api }),
            },
        ],

        onActivate(api) {
            update(api);

            api.registerKeybinding({
                id: "todo-highlighter:toggle",
                label: "Toggle TODO Panel",
                keys: "Ctrl+Shift+T",
                handler: (e) => { e.preventDefault(); api.togglePanel("todo-highlighter:panel"); },
                when: "editor",
                category: "Tools",
            });
        },

        onContentChange(_content, api) {
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => update(api), 500);
        },

        onDeactivate(api) {
            if (debounceTimer) clearTimeout(debounceTimer);
            api.clearInlineDecorations("todo-highlighter");
        },
    };
}

function update(api: ExtendedPluginAPI) {
    const content = api.getContent();
    const todos = findTodos(content);
    const decorations: InlineDecoration[] = todos.map((todo, i) => {
        const line = content.split("\n")[todo.line - 1] || "";
        const col = line.search(new RegExp(`\\b${todo.tag}\\b`, "i"));
        return {
            id: `todo-highlighter:${i}`,
            line: todo.line,
            startCol: Math.max(0, col),
            endCol: Math.max(0, col) + todo.tag.length,
            className: `editor-todo-${todo.tag.toLowerCase()}`,
            style: {
                backgroundColor: `${TAG_COLORS[todo.tag]}22`,
                color: TAG_COLORS[todo.tag],
                fontWeight: "600",
                borderRadius: "2px",
                padding: "0 2px",
            },
            hoverMessage: `${todo.tag}: ${todo.text}`,
        };
    });

    api.clearInlineDecorations("todo-highlighter");
    api.addInlineDecorations(decorations);
}
