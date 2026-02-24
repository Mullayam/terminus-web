/**
 * @module editor/plugins/builtin/ai-ghost-text
 *
 * AI Ghost Text Streaming Demo Plugin.
 *
 * Simulates Copilot-style inline ghost text suggestions:
 *   - After the user pauses typing (~800ms), a dummy AI suggestion
 *     streams in character-by-character at the cursor position.
 *   - Ghost text appears as translucent gray text inline.
 *   - Tab to accept, Escape to dismiss.
 *   - Ctrl+] to manually trigger a new suggestion.
 *
 * The plugin uses InlineAnnotations with a special "ghost" category
 * and communicates the active ghost text + streaming state to the
 * GhostTextOverlay component via a shared reactive store.
 */
import type { ExtendedEditorPlugin, ExtendedPluginAPI, InlineAnnotation } from "../types";

// ═══════════════════════════════════════════════════════════════
//  GHOST TEXT STATE (shared with the overlay component)
// ═══════════════════════════════════════════════════════════════

export interface GhostTextState {
    /** Whether a suggestion is currently visible */
    visible: boolean;
    /** The full suggestion text */
    fullText: string;
    /** How many characters have been "streamed" so far */
    streamedLength: number;
    /** 1-based line where the ghost text appears */
    line: number;
    /** 0-based column where ghost text starts (end of real text) */
    col: number;
    /** Whether the text is still streaming in */
    isStreaming: boolean;
    /** Unique ID for this suggestion session */
    sessionId: number;
    /** Callback to accept the suggestion (for clickable controls) */
    onAccept?: () => void;
    /** Callback to reject/dismiss the suggestion (for clickable controls) */
    onReject?: () => void;
}

type GhostListener = (state: GhostTextState) => void;

const INITIAL_GHOST_STATE: GhostTextState = {
    visible: false,
    fullText: "",
    streamedLength: 0,
    line: 0,
    col: 0,
    isStreaming: false,
    sessionId: 0,
    onAccept: undefined,
    onReject: undefined,
};

/** Shared reactive store for the ghost text state */
class GhostTextStore {
    private state: GhostTextState = { ...INITIAL_GHOST_STATE };
    private listeners = new Set<GhostListener>();

    getState(): GhostTextState {
        return this.state;
    }

    setState(partial: Partial<GhostTextState>) {
        this.state = { ...this.state, ...partial };
        this.listeners.forEach((l) => l(this.state));
    }

    reset() {
        this.state = { ...INITIAL_GHOST_STATE };
        this.listeners.forEach((l) => l(this.state));
    }

    subscribe(listener: GhostListener): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    /** Set accept/reject callbacks (called by the plugin on activation) */
    setCallbacks(onAccept: () => void, onReject: () => void) {
        this.state = { ...this.state, onAccept, onReject };
        // Don't notify listeners – this is a one-time setup
    }
}

/** Singleton ghost text store – shared between plugin and overlay */
export const ghostTextStore = new GhostTextStore();

// ═══════════════════════════════════════════════════════════════
//  DUMMY "AI" RESPONSE BANK
// ═══════════════════════════════════════════════════════════════

const SUGGESTIONS_BY_CONTEXT: Record<string, string[]> = {
    // Generic code completions
    "function": [
        "(name: string, options?: Record<string, unknown>): Promise<void> {\n  // TODO: implement\n  return Promise.resolve();\n}",
        "(items: unknown[]): unknown[] {\n  return items.filter(Boolean).map((item) => item);\n}",
        "(req: Request, res: Response): void {\n  try {\n    const data = req.body;\n    res.json({ success: true, data });\n  } catch (err) {\n    res.status(500).json({ error: 'Internal server error' });\n  }\n}",
    ],
    "const": [
        " result = await fetch(apiUrl, {\n  method: 'POST',\n  headers: { 'Content-Type': 'application/json' },\n  body: JSON.stringify(payload),\n});",
        " config = {\n  retries: 3,\n  timeout: 5000,\n  baseUrl: process.env.API_URL ?? 'http://localhost:3000',\n};",
        " handler = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {\n  setValue(event.target.value);\n}, []);",
    ],
    "import": [
        " { useState, useEffect, useCallback, useMemo } from 'react';",
        " axios from 'axios';",
        " { z } from 'zod';",
    ],
    "if": [
        " (!response.ok) {\n  throw new Error(`HTTP ${response.status}: ${response.statusText}`);\n}",
        " (items.length === 0) {\n  return { empty: true, message: 'No results found' };\n}",
    ],
    "class": [
        " ApiService {\n  private baseUrl: string;\n\n  constructor(baseUrl: string) {\n    this.baseUrl = baseUrl;\n  }\n\n  async get<T>(path: string): Promise<T> {\n    const res = await fetch(`${this.baseUrl}${path}`);\n    return res.json();\n  }\n}",
    ],
    "for": [
        " (const item of items) {\n  await processItem(item);\n  results.push(item.id);\n}",
        " (let i = 0; i < arr.length; i++) {\n  if (arr[i] === target) return i;\n}",
    ],
    "return": [
        " (\n  <div className=\"flex items-center gap-2 p-4\">\n    <span className=\"text-sm font-medium\">{label}</span>\n    <Badge variant=\"secondary\">{count}</Badge>\n  </div>\n);",
    ],
    "try": [
        " {\n  const data = await fetchData(endpoint);\n  setResult(data);\n} catch (error) {\n  console.error('Failed to fetch:', error);\n  setError(error instanceof Error ? error.message : 'Unknown error');\n} finally {\n  setLoading(false);\n}",
    ],
    "async": [
        " function fetchUserData(userId: string) {\n  const response = await api.get(`/users/${userId}`);\n  if (!response.data) throw new NotFoundError('User not found');\n  return response.data;\n}",
    ],
    "interface": [
        " Props {\n  title: string;\n  description?: string;\n  onSubmit: (data: FormData) => Promise<void>;\n  isLoading?: boolean;\n  children?: React.ReactNode;\n}",
    ],
    "export": [
        " default function Page() {\n  const [data, setData] = useState<Data[]>([]);\n\n  useEffect(() => {\n    loadData().then(setData);\n  }, []);\n\n  return (\n    <main className=\"container mx-auto py-8\">\n      <h1 className=\"text-2xl font-bold mb-4\">Dashboard</h1>\n      <DataGrid items={data} />\n    </main>\n  );\n}",
    ],
};

/** Fallback suggestions when no context match */
const FALLBACK_SUGGESTIONS = [
    "console.log('Hello, World!');",
    "// TODO: implement this feature\nthrow new Error('Not implemented');",
    "const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));",
    "Object.entries(data).reduce<Record<string, number>>((acc, [key, val]) => {\n  acc[key] = typeof val === 'number' ? val : 0;\n  return acc;\n}, {});",
    "useEffect(() => {\n  const controller = new AbortController();\n  fetchData({ signal: controller.signal })\n    .then(setData)\n    .catch(console.error);\n  return () => controller.abort();\n}, []);",
    "const debounce = <T extends (...args: any[]) => void>(fn: T, delay: number): T => {\n  let timer: NodeJS.Timeout;\n  return ((...args: any[]) => {\n    clearTimeout(timer);\n    timer = setTimeout(() => fn(...args), delay);\n  }) as T;\n};",
];

// ═══════════════════════════════════════════════════════════════
//  LANGUAGE-SPECIFIC SUGGESTION BANKS
// ═══════════════════════════════════════════════════════════════

const LANGUAGE_SUGGESTIONS: Record<string, Record<string, string[]>> = {
    python: {
        "def": [
            " process_data(self, items: list) -> dict:\n    result = {}\n    for item in items:\n        result[item.id] = item.value\n    return result",
            " fetch_data(url: str, timeout: int = 30) -> dict:\n    import requests\n    response = requests.get(url, timeout=timeout)\n    response.raise_for_status()\n    return response.json()",
        ],
        "class": [
            " DataService:\n    def __init__(self, config: dict):\n        self.config = config\n        self._cache = {}\n\n    def get(self, key: str):\n        return self._cache.get(key)",
        ],
        "if": [
            " __name__ == '__main__':\n    main()",
            " not response.ok:\n    raise ValueError(f'Request failed: {response.status_code}')",
        ],
        "for": [
            " item in items:\n    processed = transform(item)\n    results.append(processed)",
            " i, value in enumerate(data):\n    print(f'{i}: {value}')",
        ],
        "import": [
            " os\nimport sys\nfrom pathlib import Path",
            " pandas as pd\nimport numpy as np",
        ],
        "from": [
            " typing import List, Dict, Optional, Tuple",
            " dataclasses import dataclass, field",
        ],
        "with": [
            " open(file_path, 'r') as f:\n    data = json.load(f)",
        ],
        "try": [
            ":\n    result = process(data)\nexcept ValueError as e:\n    logger.error(f'Validation error: {e}')\nexcept Exception as e:\n    logger.exception('Unexpected error')\n    raise",
        ],
        "async": [
            " def fetch_all(urls: list[str]) -> list[dict]:\n    async with aiohttp.ClientSession() as session:\n        tasks = [session.get(url) for url in urls]\n        responses = await asyncio.gather(*tasks)\n        return [await r.json() for r in responses]",
        ],
    },

    dockerfile: {
        "FROM": [
            " node:20-alpine AS builder\nWORKDIR /app\nCOPY package*.json ./\nRUN npm ci --only=production",
            " python:3.12-slim\nWORKDIR /app\nCOPY requirements.txt .\nRUN pip install --no-cache-dir -r requirements.txt",
        ],
        "RUN": [
            " apt-get update && apt-get install -y --no-install-recommends \\\n    curl \\\n    ca-certificates \\\n  && rm -rf /var/lib/apt/lists/*",
            " npm ci && npm run build",
        ],
        "COPY": [
            " --from=builder /app/dist ./dist\nCOPY --from=builder /app/node_modules ./node_modules",
            " . .",
        ],
        "EXPOSE": [
            " 3000\nENV NODE_ENV=production\nCMD [\"node\", \"dist/index.js\"]",
        ],
        "ENV": [
            " NODE_ENV=production \\\n    PORT=3000 \\\n    HOST=0.0.0.0",
        ],
        "CMD": [
            " [\"python\", \"-m\", \"uvicorn\", \"app.main:app\", \"--host\", \"0.0.0.0\", \"--port\", \"8000\"]",
        ],
        "ENTRYPOINT": [
            " [\"/docker-entrypoint.sh\"]",
        ],
    },

    bash: {
        "#!": [
            "/bin/bash\nset -euo pipefail\nIFS=$'\\n\\t'",
        ],
        "if": [
            " [ -z \"$1\" ]; then\n  echo \"Usage: $0 <filename>\"\n  exit 1\nfi",
            " [ -f \"$FILE\" ]; then\n  echo \"File exists\"\nelse\n  echo \"File not found\"\n  exit 1\nfi",
        ],
        "for": [
            " file in *.log; do\n  echo \"Processing $file...\"\n  gzip \"$file\"\ndone",
            " i in $(seq 1 10); do\n  echo \"Iteration $i\"\ndone",
        ],
        "function": [
            " cleanup() {\n  local exit_code=$?\n  rm -rf \"$TMPDIR\"\n  exit $exit_code\n}\ntrap cleanup EXIT",
        ],
        "while": [
            " IFS= read -r line; do\n  echo \"$line\"\ndone < \"$INPUT_FILE\"",
        ],
        "case": [
            " \"$1\" in\n  start)\n    echo \"Starting...\"\n    ;;\n  stop)\n    echo \"Stopping...\"\n    ;;\n  *)\n    echo \"Usage: $0 {start|stop}\"\n    exit 1\n    ;;\nesac",
        ],
        "echo": [
            " \"$(date '+%Y-%m-%d %H:%M:%S') [INFO] $*\" | tee -a \"$LOG_FILE\"",
        ],
    },

    go: {
        "func": [
            " (s *Server) HandleRequest(w http.ResponseWriter, r *http.Request) {\n\tvar req RequestBody\n\tif err := json.NewDecoder(r.Body).Decode(&req); err != nil {\n\t\thttp.Error(w, err.Error(), http.StatusBadRequest)\n\t\treturn\n\t}\n\tw.Header().Set(\"Content-Type\", \"application/json\")\n\tjson.NewEncoder(w).Encode(map[string]string{\"status\": \"ok\"})\n}",
        ],
        "type": [
            " Config struct {\n\tHost     string `json:\"host\" yaml:\"host\"`\n\tPort     int    `json:\"port\" yaml:\"port\"`\n\tLogLevel string `json:\"log_level\" yaml:\"log_level\"`\n}",
        ],
        "if": [
            " err != nil {\n\treturn fmt.Errorf(\"failed to process: %w\", err)\n}",
        ],
        "for": [
            " i, item := range items {\n\tfmt.Printf(\"%d: %v\\n\", i, item)\n}",
        ],
        "import": [
            " (\n\t\"context\"\n\t\"encoding/json\"\n\t\"fmt\"\n\t\"net/http\"\n)",
        ],
    },

    rust: {
        "fn": [
            " process(input: &str) -> Result<String, Box<dyn Error>> {\n    let data: Value = serde_json::from_str(input)?;\n    Ok(data.to_string())\n}",
        ],
        "struct": [
            " Config {\n    host: String,\n    port: u16,\n    workers: usize,\n}\n\nimpl Config {\n    fn new() -> Self {\n        Self {\n            host: \"0.0.0.0\".into(),\n            port: 8080,\n            workers: num_cpus::get(),\n        }\n    }\n}",
        ],
        "impl": [
            " Display for AppError {\n    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {\n        write!(f, \"{}: {}\", self.kind, self.message)\n    }\n}",
        ],
        "let": [
            " result = items\n        .iter()\n        .filter(|item| item.is_active())\n        .map(|item| item.id)\n        .collect::<Vec<_>>();",
        ],
        "match": [
            " status {\n    Status::Ok => println!(\"Success\"),\n    Status::Error(e) => eprintln!(\"Error: {}\", e),\n    _ => println!(\"Unknown status\"),\n}",
        ],
    },

    yaml: {
        "name": [
            ": CI/CD Pipeline\non:\n  push:\n    branches: [main]\n  pull_request:\n    branches: [main]\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/setup-node@v4\n        with:\n          node-version: 20",
        ],
        "services": [
            ":\n  app:\n    build: .\n    ports:\n      - \"3000:3000\"\n    environment:\n      - NODE_ENV=production\n    depends_on:\n      - db\n  db:\n    image: postgres:16-alpine\n    environment:\n      POSTGRES_PASSWORD: secret",
        ],
    },

    sql: {
        "SELECT": [
            " u.id, u.name, u.email, COUNT(o.id) as order_count\nFROM users u\nLEFT JOIN orders o ON o.user_id = u.id\nWHERE u.created_at > NOW() - INTERVAL '30 days'\nGROUP BY u.id, u.name, u.email\nORDER BY order_count DESC\nLIMIT 10;",
        ],
        "CREATE": [
            " TABLE IF NOT EXISTS users (\n  id SERIAL PRIMARY KEY,\n  name VARCHAR(255) NOT NULL,\n  email VARCHAR(255) UNIQUE NOT NULL,\n  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,\n  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP\n);",
        ],
        "INSERT": [
            " INTO users (name, email)\nVALUES ($1, $2)\nRETURNING id, name, email, created_at;",
        ],
        "ALTER": [
            " TABLE users\nADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'user';",
        ],
    },
};

/** Map a file language string (from editor state) to a suggestion bank key */
function normalizeLanguage(lang: string): string | null {
    const l = lang.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (/^(typescript|javascript|tsx|jsx|ts|js)$/.test(l)) return null; // use default bank
    if (/^(python|py)$/.test(l)) return "python";
    if (/^(dockerfile|docker)$/.test(l)) return "dockerfile";
    if (/^(bash|sh|shell|zsh|shellscript)$/.test(l)) return "bash";
    if (/^(go|golang)$/.test(l)) return "go";
    if (/^(rust|rs)$/.test(l)) return "rust";
    if (/^(yaml|yml)$/.test(l)) return "yaml";
    if (/^(sql|mysql|postgresql|postgres|sqlite)$/.test(l)) return "sql";
    return null; // fallback to JS/TS bank
}

function pickSuggestion(lineText: string, language?: string): string {
    const trimmed = lineText.trimStart();

    // Try language-specific bank first
    if (language) {
        const langKey = normalizeLanguage(language);
        if (langKey && LANGUAGE_SUGGESTIONS[langKey]) {
            const bank = LANGUAGE_SUGGESTIONS[langKey];
            for (const [keyword, suggestions] of Object.entries(bank)) {
                if (trimmed.startsWith(keyword) || trimmed.endsWith(keyword)) {
                    return suggestions[Math.floor(Math.random() * suggestions.length)];
                }
            }
            // If we have a language-specific bank but no keyword match,
            // pick a random entry from that language's bank
            const allEntries = Object.values(bank).flat();
            if (allEntries.length > 0) {
                return allEntries[Math.floor(Math.random() * allEntries.length)];
            }
        }
    }

    // Fall back to JS/TS context bank
    for (const [keyword, suggestions] of Object.entries(SUGGESTIONS_BY_CONTEXT)) {
        if (trimmed.startsWith(keyword) || trimmed.endsWith(keyword)) {
            return suggestions[Math.floor(Math.random() * suggestions.length)];
        }
    }
    return FALLBACK_SUGGESTIONS[Math.floor(Math.random() * FALLBACK_SUGGESTIONS.length)];
}

// ═══════════════════════════════════════════════════════════════
//  STREAMING CONTROLLER
// ═══════════════════════════════════════════════════════════════

class StreamController {
    private timer: ReturnType<typeof setInterval> | null = null;
    private sessionCounter = 0;

    start(fullText: string, line: number, col: number) {
        this.cancel();
        const sessionId = ++this.sessionCounter;

        ghostTextStore.setState({
            visible: true,
            fullText,
            streamedLength: 0,
            line,
            col,
            isStreaming: true,
            sessionId,
        });

        // Characters per tick, speeds up for longer suggestions
        const charsPerTick = fullText.length > 100 ? 3 : fullText.length > 50 ? 2 : 1;
        const tickMs = 22; // ~45 chars/sec at 1 char/tick

        this.timer = setInterval(() => {
            const state = ghostTextStore.getState();
            if (state.sessionId !== sessionId) { this.cancel(); return; }

            const next = Math.min(state.streamedLength + charsPerTick, fullText.length);
            ghostTextStore.setState({ streamedLength: next });

            if (next >= fullText.length) {
                ghostTextStore.setState({ isStreaming: false });
                if (this.timer) { clearInterval(this.timer); this.timer = null; }
            }
        }, tickMs);
    }

    cancel() {
        if (this.timer) { clearInterval(this.timer); this.timer = null; }
        ghostTextStore.reset();
    }

    isActive(): boolean {
        return ghostTextStore.getState().visible;
    }
}

// ═══════════════════════════════════════════════════════════════
//  PLUGIN FACTORY
// ═══════════════════════════════════════════════════════════════

export function createAiGhostTextPlugin(): ExtendedEditorPlugin {
    const stream = new StreamController();
    let triggerTimer: ReturnType<typeof setTimeout> | null = null;
    let api: ExtendedPluginAPI | null = null;

    const TRIGGER_DELAY = 800; // ms after last keystroke

    function scheduleGhost(content: string) {
        cancelGhost();
        if (!api) return;

        triggerTimer = setTimeout(() => {
            if (!api) return;
            const pos = api.getCursorPosition();
            const lineText = api.getLineContent(pos.line);

            // Don't suggest on empty lines or very short lines
            if (lineText.trim().length < 2) return;

            // Get language for context-aware suggestions
            const fileInfo = api.getFileInfo();
            const suggestion = pickSuggestion(lineText, fileInfo.language);
            stream.start(suggestion, pos.line, lineText.length);
        }, TRIGGER_DELAY);
    }

    function cancelGhost() {
        if (triggerTimer) { clearTimeout(triggerTimer); triggerTimer = null; }
        stream.cancel();
    }

    function acceptGhost() {
        const state = ghostTextStore.getState();
        if (!state.visible || !api) return;

        const acceptedText = state.fullText.slice(0, state.streamedLength);
        cancelGhost();

        // Insert the accepted text at cursor position
        const pos = api.getCursorPosition();
        const content = api.getContent();
        const before = content.slice(0, pos.offset);
        const after = content.slice(pos.offset);
        api.setContent(before + acceptedText + after);
    }

    return {
        id: "ai-ghost-text",
        name: "AI Ghost Text (Demo)",
        version: "1.0.0",
        description: "Simulates AI-powered inline ghost text suggestions with streaming animation",
        category: "ai",
        defaultEnabled: true,

        onActivate(pluginApi) {
            api = pluginApi;

            // Register a command to manually trigger suggestion
            api.registerCommand("ghostText.trigger", () => {
                const content = api!.getContent();
                scheduleGhost(content);
            });

            // Register accept command
            api.registerCommand("ghostText.accept", acceptGhost);

            // Register dismiss command
            api.registerCommand("ghostText.dismiss", cancelGhost);

            // Expose accept/reject callbacks on the store for clickable UI controls
            ghostTextStore.setCallbacks(acceptGhost, cancelGhost);
        },

        onDeactivate() {
            cancelGhost();
            api = null;
        },

        onContentChange(content) {
            scheduleGhost(content);
        },

        onSelectionChange() {
            // Dismiss ghost text when selection changes (user clicked elsewhere)
            if (stream.isActive()) {
                cancelGhost();
            }
        },

        keybindings: [
            {
                id: "ghostText.accept",
                label: "Accept Ghost Text",
                keys: "Tab",
                handler: (e) => {
                    if (ghostTextStore.getState().visible) {
                        e.preventDefault();
                        acceptGhost();
                    }
                },
                when: "editor",
                category: "AI Ghost Text",
            },
            {
                id: "ghostText.dismiss",
                label: "Dismiss Ghost Text",
                keys: "Escape",
                handler: (e) => {
                    if (ghostTextStore.getState().visible) {
                        e.preventDefault();
                        cancelGhost();
                    }
                },
                when: "editor",
                category: "AI Ghost Text",
            },
            {
                id: "ghostText.trigger",
                label: "Trigger Ghost Text",
                keys: "Ctrl+]",
                handler: (e) => {
                    if (api) {
                        e.preventDefault();
                        api.executeCommand("ghostText.trigger");
                    }
                },
                when: "editor",
                category: "AI Ghost Text",
            },
        ],
    };
}
