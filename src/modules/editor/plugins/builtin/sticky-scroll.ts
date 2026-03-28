/**
 * @module editor/plugins/builtin/sticky-scroll
 *
 * Keeps the current scope's opening line visible
 * (like VS Code's sticky scroll feature).
 */
import type { ExtendedEditorPlugin, ExtendedPluginAPI, InlineAnnotation } from "../types";

interface ScopeInfo {
    name: string;
    line: number;
    lineText: string;
}

function findCurrentScope(content: string, cursorLine: number): ScopeInfo | null {
    const lines = content.split("\n");
    const bracketStack: Array<{ name: string; line: number; lineText: string }> = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        const lineNum = i + 1;

        const m = trimmed.match(/(?:function|class|interface|def|fn|func|pub fn|pub struct)\s+(\w+)/);
        if (m) {
            bracketStack.push({ name: m[1], line: lineNum, lineText: trimmed });
        }

        if (lineNum === cursorLine && bracketStack.length > 0) {
            return bracketStack[bracketStack.length - 1];
        }

        // Track closing braces
        for (const ch of line) {
            if (ch === "}") bracketStack.pop();
        }
    }

    return bracketStack.length > 0 ? bracketStack[bracketStack.length - 1] : null;
}

export function createStickyScrollPlugin(): ExtendedEditorPlugin {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    return {
        id: "sticky-scroll",
        name: "Sticky Scroll",
        version: "1.0.0",
        description: "Shows the current scope header when scrolled past it",
        category: "ui",
        defaultEnabled: false,

        onSelectionChange(_sel, api) {
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => update(api), 150);
        },

        onContentChange(_content, api) {
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => update(api), 300);
        },

        onDeactivate(api) {
            if (debounceTimer) clearTimeout(debounceTimer);
            api.clearInlineAnnotations("sticky-scroll");
        },
    };
}

function update(api: ExtendedPluginAPI) {
    const content = api.getContent();
    const { line } = api.getCursorPosition();
    const scope = findCurrentScope(content, line);

    if (scope && scope.line < line) {
        const annotation: InlineAnnotation = {
            id: "sticky-scroll:header",
            line: 1,
            text: `  ⌈ ${scope.lineText.trim()}`,
            className: "editor-sticky-scroll",
            style: { opacity: 0.5, fontStyle: "italic", fontSize: "10px" },
        };
        api.setInlineAnnotations([annotation]);
    } else {
        api.clearInlineAnnotations("sticky-scroll");
    }
}
