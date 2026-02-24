/**
 * @module editor/plugins/mock/mock-ghost-text
 *
 * Mock Ghost Text Plugin.
 *
 * Simulates an AI ghost-text provider that streams inline suggestions
 * after a short typing pause. Uses canned responses so no backend is needed.
 *
 * Demonstrates:
 *   - `onContentChange` life-cycle hook
 *   - `ghostTextStore` integration for the GhostTextOverlay component
 *   - Keybindings (Tab to accept, Escape to dismiss, Ctrl+] to trigger)
 *   - Streaming character-by-character into ghost text
 *
 * Usage:
 * ```ts
 * import { createMockGhostTextPlugin } from "./plugins/mock";
 * <FileEditor plugins={[createMockGhostTextPlugin()]} … />
 * ```
 */
import type { ExtendedEditorPlugin, ExtendedPluginAPI } from "../types";
import { ghostTextStore } from "../builtin/ai-ghost-text";

// ── Canned ghost-text suggestions ────────────────────────────

const GHOST_SUGGESTIONS: Record<string, string[]> = {
    "function": [
        "(name: string): Promise<void> {\n  console.log(name);\n  return Promise.resolve();\n}",
        "() {\n  // mock implementation\n  return null;\n}",
    ],
    "const": [
        " data = await fetchData();\n  return data.map(item => item.id);",
        " config = { port: 3000, host: \"localhost\" };",
    ],
    "if": [
        " (condition) {\n  handleSuccess();\n} else {\n  handleError();\n}",
    ],
    "for": [
        " (let i = 0; i < items.length; i++) {\n  process(items[i]);\n}",
    ],
    "import": [
        " { useEffect, useState } from \"react\";",
    ],
    "return": [
        " { success: true, data: result };",
    ],
    "class": [
        " MockService {\n  private data: string[] = [];\n\n  add(item: string) {\n    this.data.push(item);\n  }\n}",
    ],
};

const FALLBACK_SUGGESTIONS = [
    "// TODO: implement this section",
    "console.log('mock suggestion');",
    "const result = await processData(input);",
];

function pickSuggestion(lineText: string): string {
    const trimmed = lineText.trimStart();
    for (const [prefix, suggestions] of Object.entries(GHOST_SUGGESTIONS)) {
        if (trimmed.startsWith(prefix)) {
            return suggestions[Math.floor(Math.random() * suggestions.length)];
        }
    }
    return FALLBACK_SUGGESTIONS[Math.floor(Math.random() * FALLBACK_SUGGESTIONS.length)];
}

// ═══════════════════════════════════════════════════════════════
//  PLUGIN FACTORY
// ═══════════════════════════════════════════════════════════════

export function createMockGhostTextPlugin(): ExtendedEditorPlugin {
    let api: ExtendedPluginAPI | null = null;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let streamTimer: ReturnType<typeof setInterval> | null = null;
    let sessionCounter = 0;

    function cancelGhost() {
        if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null; }
        if (streamTimer) { clearInterval(streamTimer); streamTimer = null; }
        ghostTextStore.reset();
    }

    function streamGhostText(text: string, line: number, col: number) {
        cancelGhost();
        const session = ++sessionCounter;

        ghostTextStore.setState({
            visible: true,
            fullText: text,
            streamedLength: 0,
            line,
            col,
            isStreaming: true,
            sessionId: session,
        });

        let charIdx = 0;
        streamTimer = setInterval(() => {
            if (ghostTextStore.getState().sessionId !== session) {
                clearInterval(streamTimer!);
                streamTimer = null;
                return;
            }
            charIdx++;
            if (charIdx >= text.length) {
                ghostTextStore.setState({ streamedLength: text.length, isStreaming: false });
                clearInterval(streamTimer!);
                streamTimer = null;
            } else {
                ghostTextStore.setState({ streamedLength: charIdx });
            }
        }, 20); // stream speed: 20ms per char
    }

    function acceptGhost() {
        if (!api) return;
        const state = ghostTextStore.getState();
        if (!state.visible || !state.fullText) return;

        const content = api.getContent();
        const lines = content.split("\n");
        let offset = 0;
        for (let i = 0; i < state.line - 1; i++) offset += lines[i].length + 1;
        offset += state.col;

        const newContent = content.slice(0, offset) + state.fullText + content.slice(offset);
        api.setContent(newContent);
        cancelGhost();
    }

    function scheduleGhost(content: string) {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            if (!api) return;
            const { line, col } = api.getCursorPosition();
            const lines = content.split("\n");
            const lineText = lines[line - 1] ?? "";

            // Only trigger when cursor is at end of a non-empty line
            if (lineText.trim().length < 2 || col < lineText.length) return;

            const suggestion = pickSuggestion(lineText);
            streamGhostText(suggestion, line, col);
        }, 800);
    }

    return {
        id: "mock-ghost-text",
        name: "Mock Ghost Text",
        version: "1.0.0",
        description: "Simulates AI ghost-text streaming suggestions (no backend needed)",
        category: "ai",
        defaultEnabled: true,

        onActivate(pluginApi) {
            api = pluginApi;
            api.showToast("Mock Ghost Text", "Plugin activated – pause typing to see suggestions", "default");
        },

        onDeactivate() {
            cancelGhost();
            api = null;
        },

        onContentChange(content) {
            scheduleGhost(content);
        },

        onSelectionChange() {
            if (ghostTextStore.getState().visible) {
                cancelGhost();
            }
        },

        keybindings: [
            {
                id: "mockGhostText.accept",
                label: "Accept Mock Ghost Text",
                keys: "Tab",
                handler: (e) => {
                    if (ghostTextStore.getState().visible) {
                        e.preventDefault();
                        acceptGhost();
                    }
                },
                when: "editor",
                category: "Mock AI",
            },
            {
                id: "mockGhostText.dismiss",
                label: "Dismiss Mock Ghost Text",
                keys: "Escape",
                handler: (e) => {
                    if (ghostTextStore.getState().visible) {
                        e.preventDefault();
                        cancelGhost();
                    }
                },
                when: "editor",
                category: "Mock AI",
            },
            {
                id: "mockGhostText.trigger",
                label: "Trigger Mock Ghost Text",
                keys: "Ctrl+]",
                handler: (e) => {
                    if (api) {
                        e.preventDefault();
                        const content = api.getContent();
                        scheduleGhost(content);
                    }
                },
                when: "editor",
                category: "Mock AI",
            },
        ],
    };
}
