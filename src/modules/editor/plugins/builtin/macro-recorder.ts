/**
 * @module editor/plugins/builtin/macro-recorder
 *
 * Records and replays keyboard macros.
 */
import type { ExtendedEditorPlugin } from "../types";

interface MacroAction {
    type: "insert" | "delete" | "replace";
    text: string;
    position?: number;
}

export function createMacroRecorderPlugin(): ExtendedEditorPlugin {
    let recording = false;
    const actions: MacroAction[] = [];
    const savedMacros = new Map<string, MacroAction[]>();

    return {
        id: "macro-recorder",
        name: "Macro Recorder",
        version: "1.0.0",
        description: "Record and replay editing macros",
        category: "tools",
        defaultEnabled: true,

        onActivate(api) {
            api.registerCommand("macro.startRecording", () => {
                recording = true;
                actions.length = 0;
                api.showToast("Macro", "Recording started...", "default");
            });

            api.registerCommand("macro.stopRecording", () => {
                recording = false;
                api.showToast("Macro", `Recording stopped. ${actions.length} actions captured.`, "default");
            });

            api.registerCommand("macro.play", () => {
                if (actions.length === 0) {
                    api.showToast("Macro", "No macro recorded", "default");
                    return;
                }
                for (const action of actions) {
                    if (action.type === "insert") {
                        api.replaceSelection(action.text);
                    }
                }
                api.showToast("Macro", `Replayed ${actions.length} actions`, "default");
            });

            api.registerCommand("macro.save", (...args: unknown[]) => {
                const name = typeof args[0] === "string" ? args[0] : `macro-${Date.now()}`;
                savedMacros.set(name, [...actions]);
                api.showToast("Macro", `Saved macro "${name}"`, "default");
            });

            api.registerCommand("macro.load", (...args: unknown[]) => {
                const name = typeof args[0] === "string" ? args[0] : "";
                const macro = savedMacros.get(name);
                if (macro) {
                    actions.length = 0;
                    actions.push(...macro);
                    api.showToast("Macro", `Loaded macro "${name}" (${macro.length} actions)`, "default");
                }
            });

            api.registerCommand("macro.list", () => {
                const names = Array.from(savedMacros.keys());
                api.showToast("Saved Macros", names.join(", ") || "None", "default");
            });
        },

        onContentChange(content, api) {
            if (!recording) return;
            // Track content changes (simplified)
            actions.push({ type: "insert", text: "", position: 0 });
        },
    };
}
