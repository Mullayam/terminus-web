/**
 * @module editor/plugins/builtin/ai-code-actions
 *
 * Provides quick AI-powered code action commands:
 * optimize, simplify, add error handling, convert, etc.
 */
import type { ExtendedEditorPlugin } from "../types";

export function createAiCodeActionsPlugin(): ExtendedEditorPlugin {
    return {
        id: "ai-code-actions",
        name: "AI Code Actions",
        version: "1.0.0",
        description: "Quick AI-powered code actions (optimize, simplify, add error handling)",
        category: "ai",
        defaultEnabled: true,

        onActivate(api) {
            const actions = [
                { id: "ai.optimize", label: "Optimize Code", desc: "Optimize for performance" },
                { id: "ai.simplify", label: "Simplify Code", desc: "Reduce complexity" },
                { id: "ai.addErrorHandling", label: "Add Error Handling", desc: "Add try/catch and validation" },
                { id: "ai.addTypes", label: "Add Type Annotations", desc: "Add TypeScript types" },
                { id: "ai.convertAsync", label: "Convert to Async/Await", desc: "Convert promises to async/await" },
                { id: "ai.addTests", label: "Generate Tests", desc: "Generate unit tests" },
            ];

            for (const action of actions) {
                api.registerCommand(action.id, () => {
                    const sel = api.getSelection();
                    if (!sel || sel.start === sel.end) {
                        api.showToast("AI Action", "Select code first", "default");
                        return;
                    }
                    api.showToast("AI Action", `"${action.desc}" — connect an AI provider to use this feature`, "default");
                });
            }
        },
    };
}
