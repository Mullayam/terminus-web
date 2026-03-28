/**
 * @module editor/plugins/builtin/quick-jump
 *
 * Quick jump to any visible symbol by typing its first few characters.
 */
import type { ExtendedEditorPlugin, ExtendedPluginAPI } from "../types";

function jumpToSymbol(api: ExtendedPluginAPI, query: string) {
    const content = api.getContent();
    const lines = content.split("\n");
    const lowerQuery = query.toLowerCase();

    for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trim();
        // Match functions, classes, variables
        const m = trimmed.match(
            /(?:function|class|interface|type|enum|const|let|var|def|fn|func|pub fn|pub struct|pub enum)\s+(\w+)/
        );
        if (m && m[1].toLowerCase().startsWith(lowerQuery)) {
            let offset = 0;
            for (let j = 0; j < i; j++) offset += lines[j].length + 1;
            offset += lines[i].indexOf(m[1]);
            api.setSelection(offset, offset + m[1].length);
            return;
        }
    }
}

export function createQuickJumpPlugin(): ExtendedEditorPlugin {
    return {
        id: "quick-jump",
        name: "Quick Jump",
        version: "1.0.0",
        description: "Jump to symbols by typing their name prefix",
        category: "editor",
        defaultEnabled: true,

        onActivate(api) {
            api.registerCommand("quickJump", (...args: unknown[]) => {
                const query = typeof args[0] === "string" ? args[0] : "";
                if (query) jumpToSymbol(api, query);
            });
        },
    };
}
