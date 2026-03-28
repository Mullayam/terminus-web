/**
 * @module editor/plugins/builtin/markdown-table-formatter
 *
 * Formats markdown tables to be properly aligned.
 */
import type { ExtendedEditorPlugin } from "../types";

function formatMarkdownTable(tableText: string): string {
    const rows = tableText.trim().split("\n").map((r) => r.trim());
    if (rows.length < 2) return tableText;

    const parsed = rows.map((row) =>
        row.replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim())
    );

    const colCount = Math.max(...parsed.map((r) => r.length));
    const colWidths: number[] = Array(colCount).fill(3);

    for (const row of parsed) {
        for (let i = 0; i < row.length; i++) {
            const isSeparator = /^[-:]+$/.test(row[i]);
            if (!isSeparator) {
                colWidths[i] = Math.max(colWidths[i], row[i].length);
            }
        }
    }

    return parsed
        .map((row) => {
            const cells = Array(colCount).fill("").map((_, i) => {
                const cell = row[i] || "";
                const isSeparator = /^[-:]+$/.test(cell);
                if (isSeparator) {
                    const left = cell.startsWith(":");
                    const right = cell.endsWith(":");
                    const fill = "-".repeat(colWidths[i]);
                    return (left ? ":" : "-") + fill.slice(left ? 1 : 0, right ? -1 : undefined) + (right ? ":" : "-");
                }
                return cell.padEnd(colWidths[i]);
            });
            return "| " + cells.join(" | ") + " |";
        })
        .join("\n");
}

export function createMarkdownTableFormatterPlugin(): ExtendedEditorPlugin {
    return {
        id: "markdown-table-formatter",
        name: "Markdown Table Formatter",
        version: "1.0.0",
        description: "Formats markdown tables with aligned columns",
        category: "language",
        defaultEnabled: true,

        onActivate(api) {
            api.registerCommand("markdown.formatTable", () => {
                const sel = api.getSelection();
                if (!sel || sel.start === sel.end) {
                    api.showToast("Table Formatter", "Select a markdown table to format", "default");
                    return;
                }
                const text = api.getContent().slice(sel.start, sel.end);
                const formatted = formatMarkdownTable(text);
                api.replaceSelection(formatted);
            });
        },

        onSave(_content, api) {
            const { language } = api.getFileInfo();
            if (!language.toLowerCase().includes("markdown")) return;

            const content = api.getContent();
            const tableRegex = /(?:^|\n)((?:\|[^\n]+\|\n)+)/g;
            let modified = content;
            let match;

            while ((match = tableRegex.exec(content)) !== null) {
                const formatted = formatMarkdownTable(match[1]);
                modified = modified.replace(match[1], formatted);
            }

            if (modified !== content) {
                api.setContent(modified);
            }
        },
    };
}
