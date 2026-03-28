/**
 * @module editor/plugins/builtin/clipboard-history
 *
 * Maintains a history of clipboard operations
 * for paste-from-history functionality.
 */
import type { ExtendedEditorPlugin } from "../types";

const MAX_HISTORY = 20;
const clipboardHistory: string[] = [];

export function createClipboardHistoryPlugin(): ExtendedEditorPlugin {
    return {
        id: "clipboard-history",
        name: "Clipboard History",
        version: "1.0.0",
        description: "Maintains a clipboard history for paste-from-history",
        category: "tools",
        defaultEnabled: true,

        onActivate(api) {
            api.registerCommand("clipboard.copy", () => {
                const sel = api.getSelection();
                if (!sel || sel.start === sel.end) return;
                const text = api.getContent().slice(sel.start, sel.end);
                if (text.trim()) {
                    clipboardHistory.unshift(text);
                    if (clipboardHistory.length > MAX_HISTORY) clipboardHistory.pop();
                }
            });

            api.registerCommand("clipboard.showHistory", () => {
                const items = clipboardHistory.map((item, i) => {
                    const preview = item.length > 50 ? item.slice(0, 50) + "..." : item;
                    return `${i + 1}. ${preview}`;
                });
                api.showToast("Clipboard History", items.join("\n") || "Empty", "default");
            });

            api.registerCommand("clipboard.pasteIndex", (...args: unknown[]) => {
                const index = typeof args[0] === "number" ? args[0] : 0;
                if (index >= 0 && index < clipboardHistory.length) {
                    api.replaceSelection(clipboardHistory[index]);
                }
            });

            api.registerCommand("clipboard.clear", () => {
                clipboardHistory.length = 0;
            });
        },
    };
}
