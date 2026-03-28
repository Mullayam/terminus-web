/**
 * @module editor/plugins/builtin/ai-code-explain
 *
 * Provides a "explain code" command that prepares
 * context for AI code explanation.
 */
import type { ExtendedEditorPlugin } from "../types";

export function createAiCodeExplainPlugin(): ExtendedEditorPlugin {
    return {
        id: "ai-code-explain",
        name: "AI Code Explain",
        version: "1.0.0",
        description: "Explain selected code using AI",
        category: "ai",
        defaultEnabled: true,

        onActivate(api) {
            api.registerCommand("ai.explainCode", () => {
                const sel = api.getSelection();
                if (!sel || sel.start === sel.end) {
                    api.showToast("AI Explain", "Select some code to explain", "default");
                    return;
                }
                const text = api.getContent().slice(sel.start, sel.end);
                const lineCount = text.split("\n").length;
                api.showToast("AI Explain",
                    `Ready to explain ${lineCount} line${lineCount !== 1 ? "s" : ""} of code. Connect an AI provider to enable explanations.`,
                    "default"
                );
            });

            api.registerCommand("ai.documentFunction", () => {
                const content = api.getContent();
                const { line } = api.getCursorPosition();
                const lines = content.split("\n");
                const currentLine = lines[line - 1]?.trim() ?? "";

                // Detect function and add JSDoc stub
                const m = currentLine.match(/(?:export\s+)?(?:async\s+)?function\s+(\w+)\(([^)]*)\)/);
                if (m) {
                    const params = m[2].split(",").map((p) => p.trim().split(":")[0].split("=")[0].trim()).filter(Boolean);
                    const jsdoc = ["/**", ` * ${m[1]}`, " *"];
                    for (const param of params) {
                        jsdoc.push(` * @param ${param}`);
                    }
                    jsdoc.push(" * @returns", " */");
                    lines.splice(line - 1, 0, ...jsdoc);
                    api.setContent(lines.join("\n"));
                    return;
                }

                api.showToast("AI Document", "Place cursor on a function declaration", "default");
            });

            api.addContextMenuItem({
                label: "Explain Code",
                action: () => api.executeCommand("ai.explainCode"),
                priority: 20,
            });

            api.addContextMenuItem({
                label: "Generate Documentation",
                action: () => api.executeCommand("ai.documentFunction"),
                priority: 21,
            });
        },
    };
}
