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

// ── Language-specific suggestion banks ────────────────────────

const LANGUAGE_GHOST_SUGGESTIONS: Record<string, Record<string, string[]>> = {
    python: {
        "def": [" process(self, items):\n    return [x for x in items if x.is_valid()]"],
        "class": [" Handler:\n    def __init__(self):\n        self.data = []\n\n    def run(self):\n        pass"],
        "if": [" __name__ == '__main__':\n    main()"],
        "for": [" item in items:\n    print(item)"],
        "import": [" os\nimport json"],
        "from": [" typing import List, Optional"],
        "with": [" open('file.txt') as f:\n    data = f.read()"],
    },
    dockerfile: {
        "FROM": [" node:20-alpine\nWORKDIR /app\nCOPY package*.json ./\nRUN npm ci"],
        "RUN": [" apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*"],
        "COPY": [" . ."],
        "EXPOSE": [" 3000\nCMD [\"node\", \"index.js\"]"],
        "ENV": [" NODE_ENV=production"],
    },
    bash: {
        "if": [" [ -z \"$1\" ]; then\n  echo \"Usage: $0 <arg>\"\n  exit 1\nfi"],
        "for": [" f in *.txt; do\n  echo \"$f\"\ndone"],
        "function": [" cleanup() {\n  rm -rf \"$TMPDIR\"\n}"],
        "while": [" read -r line; do\n  echo \"$line\"\ndone < input.txt"],
        "#!": ["/bin/bash\nset -euo pipefail"],
    },
    go: {
        "func": [" (s *Server) Handle(w http.ResponseWriter, r *http.Request) {\n\tw.WriteHeader(http.StatusOK)\n}"],
        "type": [" Config struct {\n\tHost string `json:\"host\"`\n\tPort int    `json:\"port\"`\n}"],
        "if": [" err != nil {\n\treturn fmt.Errorf(\"failed: %w\", err)\n}"],
        "for": [" _, item := range items {\n\tfmt.Println(item)\n}"],
    },
    rust: {
        "fn": [" process(input: &str) -> Result<String, Box<dyn Error>> {\n    Ok(input.to_uppercase())\n}"],
        "struct": [" Config {\n    host: String,\n    port: u16,\n}"],
        "let": [" result: Vec<_> = items.iter().filter(|x| x.is_valid()).collect();"],
        "match": [" status {\n    Ok(v) => println!(\"{v}\"),\n    Err(e) => eprintln!(\"{e}\"),\n}"],
    },
    sql: {
        "SELECT": [" * FROM users WHERE created_at > NOW() - INTERVAL '7 days' LIMIT 10;"],
        "CREATE": [" TABLE users (\n  id SERIAL PRIMARY KEY,\n  name VARCHAR(255) NOT NULL\n);"],
        "INSERT": [" INTO users (name, email) VALUES ($1, $2) RETURNING id;"],
    },
    yaml: {
        "name": [": Build\non:\n  push:\n    branches: [main]"],
        "services": [":\n  app:\n    build: .\n    ports:\n      - \"3000:3000\""],
    },
};

/** Map language to a suggestion bank key */
function normalizeLanguage(lang: string): string | null {
    const l = lang.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (/^(typescript|javascript|tsx|jsx|ts|js)$/.test(l)) return null;
    if (/^(python|py)$/.test(l)) return "python";
    if (/^(dockerfile|docker)$/.test(l)) return "dockerfile";
    if (/^(bash|sh|shell|zsh|shellscript)$/.test(l)) return "bash";
    if (/^(go|golang)$/.test(l)) return "go";
    if (/^(rust|rs)$/.test(l)) return "rust";
    if (/^(yaml|yml)$/.test(l)) return "yaml";
    if (/^(sql|mysql|postgresql|postgres|sqlite)$/.test(l)) return "sql";
    return null;
}

function pickSuggestion(lineText: string, language?: string): string {
    const trimmed = lineText.trimStart();

    // Try language-specific bank first
    if (language) {
        const langKey = normalizeLanguage(language);
        if (langKey && LANGUAGE_GHOST_SUGGESTIONS[langKey]) {
            const bank = LANGUAGE_GHOST_SUGGESTIONS[langKey];
            for (const [prefix, suggestions] of Object.entries(bank)) {
                if (trimmed.startsWith(prefix)) {
                    return suggestions[Math.floor(Math.random() * suggestions.length)];
                }
            }
            // No keyword match – pick random from this language's bank
            const all = Object.values(bank).flat();
            if (all.length > 0) return all[Math.floor(Math.random() * all.length)];
        }
    }

    // Fall back to JS/TS bank
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

            // Get language for context-aware suggestions
            const fileInfo = api.getFileInfo();
            const suggestion = pickSuggestion(lineText, fileInfo.language);
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
            // Expose accept/reject for clickable UI controls in ghost overlay
            ghostTextStore.setCallbacks(acceptGhost, cancelGhost);
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
