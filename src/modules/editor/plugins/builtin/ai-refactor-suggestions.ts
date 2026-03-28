/**
 * @module editor/plugins/builtin/ai-refactor-suggestions
 *
 * Provides AI-powered refactoring suggestion placeholders
 * that integrate with the editor's AI provider system.
 */
import type { ExtendedEditorPlugin } from "../types";

export function createAiRefactorPlugin(): ExtendedEditorPlugin {
    return {
        id: "ai-refactor-suggestions",
        name: "AI Refactor Suggestions",
        version: "1.0.0",
        description: "AI-powered code refactoring suggestions",
        category: "ai",
        defaultEnabled: true,

        onActivate(api) {
            api.registerCommand("ai.extractFunction", () => {
                const sel = api.getSelection();
                if (!sel || sel.start === sel.end) {
                    api.showToast("AI Refactor", "Select code to extract into a function", "default");
                    return;
                }
                const text = api.getContent().slice(sel.start, sel.end);
                const funcName = "extractedFunction";
                const extracted = `function ${funcName}() {\n${text.split("\n").map((l) => "  " + l).join("\n")}\n}`;
                api.replaceSelection(`${funcName}()`);
                // Prepend the function
                const content = api.getContent();
                api.setContent(extracted + "\n\n" + content);
            });

            api.registerCommand("ai.inlineVariable", () => {
                const sel = api.getSelection();
                if (!sel || sel.start === sel.end) return;
                const text = api.getContent().slice(sel.start, sel.end).trim();
                // Find assignment
                const m = text.match(/(?:const|let|var)\s+(\w+)\s*=\s*(.+)/);
                if (!m) return;
                const [, name, value] = m;
                const content = api.getContent();
                const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                const replaced = content.replace(text, "").replace(new RegExp(`\\b${escaped}\\b`, "g"), value.replace(/;$/, ""));
                api.setContent(replaced);
            });

            api.registerCommand("ai.generateTypes", () => {
                api.showToast("AI", "Type generation requires AI provider connection", "default");
            });

            api.addContextMenuItem({
                label: "Extract to Function",
                action: () => api.executeCommand("ai.extractFunction"),
                priority: 30,
            });
        },
    };
}
