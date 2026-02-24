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

function pickSuggestion(lineText: string): string {
    const trimmed = lineText.trimStart();
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

            const suggestion = pickSuggestion(lineText);
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
