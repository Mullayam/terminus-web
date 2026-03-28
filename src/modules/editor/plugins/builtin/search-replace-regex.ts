/**
 * @module editor/plugins/builtin/search-and-replace-regex
 *
 * Advanced search & replace with regex support.
 */
import type { ExtendedEditorPlugin, ExtendedPluginAPI, InlineDecoration } from "../types";

function performSearch(content: string, pattern: string, isRegex: boolean, caseSensitive: boolean) {
    const results: Array<{ start: number; end: number; line: number; col: number; text: string }> = [];

    if (!pattern) return results;

    try {
        const flags = "g" + (caseSensitive ? "" : "i");
        const regex = isRegex ? new RegExp(pattern, flags) : new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), flags);
        let match: RegExpExecArray | null;

        while ((match = regex.exec(content)) !== null) {
            const before = content.slice(0, match.index);
            const lines = before.split("\n");
            results.push({
                start: match.index,
                end: match.index + match[0].length,
                line: lines.length,
                col: lines[lines.length - 1].length,
                text: match[0],
            });
            if (match.index === regex.lastIndex) regex.lastIndex++;
        }
    } catch {
        // Invalid regex
    }

    return results;
}

export function createSearchReplaceRegexPlugin(): ExtendedEditorPlugin {
    return {
        id: "search-replace-regex",
        name: "Regex Search & Replace",
        version: "1.0.0",
        description: "Search and replace with regex pattern support",
        category: "tools",
        defaultEnabled: true,

        onActivate(api) {
            api.registerCommand("searchRegex.find", (...args: unknown[]) => {
                const pattern = typeof args[0] === "string" ? args[0] : "";
                if (!pattern) return;

                const content = api.getContent();
                const results = performSearch(content, pattern, true, false);
                highlightMatches(api, results);
                api.showToast("Search", `${results.length} match${results.length !== 1 ? "es" : ""}`, "default");
            });

            api.registerCommand("searchRegex.replaceAll", (...args: unknown[]) => {
                const pattern = typeof args[0] === "string" ? args[0] : "";
                const replacement = typeof args[1] === "string" ? args[1] : "";
                if (!pattern) return;

                try {
                    const content = api.getContent();
                    const regex = new RegExp(pattern, "g");
                    const newContent = content.replace(regex, replacement);
                    if (newContent !== content) {
                        api.setContent(newContent);
                        const count = (content.match(regex) || []).length;
                        api.showToast("Replace", `${count} replacement${count !== 1 ? "s" : ""}`, "default");
                    }
                } catch {
                    api.showToast("Replace", "Invalid regex pattern", "destructive");
                }
            });
        },

        onDeactivate(api) {
            api.clearInlineDecorations("search-replace-regex");
        },
    };
}

function highlightMatches(api: ExtendedPluginAPI, results: Array<{ line: number; col: number; text: string }>) {
    const decorations: InlineDecoration[] = results.slice(0, 500).map((r, i) => ({
        id: `search-replace-regex:${i}`,
        line: r.line,
        startCol: r.col,
        endCol: r.col + r.text.length,
        className: "editor-search-match",
        style: { backgroundColor: "rgba(255, 255, 0, 0.2)", borderRadius: "2px" },
    }));

    api.clearInlineDecorations("search-replace-regex");
    api.addInlineDecorations(decorations);
}
