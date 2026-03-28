/**
 * @module editor/plugins/builtin/scope-highlighter
 *
 * Highlights the current scope (function, class, block).
 */
import type { ExtendedEditorPlugin, ExtendedPluginAPI, InlineDecoration } from "../types";

interface ScopeRange {
    start: number;
    end: number;
    type: string;
}

function findScopes(content: string): ScopeRange[] {
    const lines = content.split("\n");
    const scopes: ScopeRange[] = [];
    const stack: { line: number; type: string }[] = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Detect scope openers
        const funcMatch = line.match(/\b(function|class|if|for|while|switch|try)\b/);
        const arrowMatch = line.match(/=>\s*\{/);

        const opens = (line.match(/{/g) || []).length;
        const closes = (line.match(/}/g) || []).length;

        for (let j = 0; j < opens; j++) {
            stack.push({
                line: i + 1,
                type: funcMatch?.[1] ?? (arrowMatch ? "arrow" : "block"),
            });
        }

        for (let j = 0; j < closes; j++) {
            const opened = stack.pop();
            if (opened) {
                scopes.push({
                    start: opened.line,
                    end: i + 1,
                    type: opened.type,
                });
            }
        }
    }

    return scopes;
}

export function createScopeHighlighterPlugin(): ExtendedEditorPlugin {
    return {
        id: "scope-highlighter",
        name: "Scope Highlighter",
        version: "1.0.0",
        description: "Highlights the boundaries of the current scope at cursor",
        category: "ui",
        defaultEnabled: false,

        onSelectionChange(_sel, api) {
            highlightScope(api);
        },

        onDeactivate(api) {
            api.clearInlineDecorations("scope-highlighter");
        },
    };
}

function highlightScope(api: ExtendedPluginAPI) {
    const content = api.getContent();
    const { line } = api.getCursorPosition();
    const scopes = findScopes(content);

    // Find innermost scope containing cursor
    let bestScope: ScopeRange | null = null;
    for (const scope of scopes) {
        if (line >= scope.start && line <= scope.end) {
            if (!bestScope || (scope.end - scope.start) < (bestScope.end - bestScope.start)) {
                bestScope = scope;
            }
        }
    }

    api.clearInlineDecorations("scope-highlighter");

    if (!bestScope) return;

    const lines = content.split("\n");
    const decorations: InlineDecoration[] = [
        {
            id: `scope-highlighter:start`,
            line: bestScope.start,
            startCol: 0,
            endCol: (lines[bestScope.start - 1] || "").length,
            style: { backgroundColor: "rgba(255, 255, 255, 0.03)" },
        },
        {
            id: `scope-highlighter:end`,
            line: bestScope.end,
            startCol: 0,
            endCol: (lines[bestScope.end - 1] || "").length,
            style: { backgroundColor: "rgba(255, 255, 255, 0.03)" },
        },
    ];

    api.addInlineDecorations(decorations);
}
