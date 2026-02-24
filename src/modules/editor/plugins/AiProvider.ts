/**
 * @module editor/plugins/AiProvider
 *
 * User-configurable AI provider system.
 * No API keys or credentials stored in the frontend.
 *
 * Two approaches:
 *   1. **Async function** — user provides a `(request) => Promise<response>` function
 *   2. **Backend route** — user sets a URL; the provider POSTs to it
 *
 * Request shape (sent to the function or backend):
 * ```ts
 * {
 *   content: string;        // full file content
 *   line: number;           // cursor line (1-based)
 *   col: number;            // cursor column (0-based)
 *   lineText: string;       // text of the current line
 *   language: string;       // file language id
 *   fileName: string;       // file name
 *   prefix: string;         // lines before cursor
 *   suffix: string;         // lines after cursor
 *   type: "ghost-text" | "completion" | "intellisense" | "codelens";
 * }
 * ```
 *
 * Expected response shape:
 * ```ts
 * { text: string }          // for non-streaming
 * // or SSE stream of: data: {"text":"chunk"}\n\n
 * // final: data: [DONE]\n\n
 * ```
 *
 * Usage:
 * ```ts
 * // Option 1: async function
 * AiProviderManager.setHandler(async (req) => {
 *   const res = await myBackendCall(req);
 *   return { text: res.suggestion };
 * });
 *
 * // Option 2: backend route
 * AiProviderManager.setRoute("/api/ai/suggest");
 *
 * // Option 3: streaming via backend route
 * AiProviderManager.setRoute("/api/ai/suggest", { streaming: true });
 * ```
 */

// ═══════════════════════════════════════════════════════════════
//  TYPES
// ═══════════════════════════════════════════════════════════════

export interface AiSuggestionRequest {
    /** The full file content */
    content: string;
    /** Current cursor line (1-based) */
    line: number;
    /** Current cursor column (0-based) */
    col: number;
    /** Text of the current line */
    lineText: string;
    /** File language */
    language: string;
    /** File name */
    fileName: string;
    /** Context before cursor (few lines) */
    prefix: string;
    /** Context after cursor (few lines) */
    suffix: string;
    /** What kind of suggestion */
    type: "ghost-text" | "completion" | "intellisense" | "codelens";
}

export interface AiSuggestionResponse {
    /** The suggestion text */
    text: string;
}

export type AiStreamCallback = (chunk: string, done: boolean) => void;

/**
 * User-provided async function that returns a suggestion.
 */
export type AiHandlerFn = (request: AiSuggestionRequest) => Promise<AiSuggestionResponse | null>;

/**
 * User-provided async function for streaming responses.
 * Must call `onChunk` for each piece of text and `onChunk("", true)` when done.
 */
export type AiStreamHandlerFn = (
    request: AiSuggestionRequest,
    onChunk: AiStreamCallback,
) => Promise<void>;

interface AiRouteConfig {
    /** Backend route URL (e.g. "/api/ai/suggest") */
    url: string;
    /** Extra headers to send */
    headers?: Record<string, string>;
    /** Whether the route supports SSE streaming */
    streaming?: boolean;
}

type AiProviderListener = () => void;

// ═══════════════════════════════════════════════════════════════
//  AI PROVIDER MANAGER (Singleton)
// ═══════════════════════════════════════════════════════════════

class AiProviderManagerImpl {
    private handler: AiHandlerFn | null = null;
    private streamHandler: AiStreamHandlerFn | null = null;
    private routeConfig: AiRouteConfig | null = null;
    private listeners = new Set<AiProviderListener>();
    private abortController: AbortController | null = null;

    // ── Configuration ────────────────────────────────────────

    /**
     * Set an async function handler for AI suggestions.
     *
     * @example
     * ```ts
     * AiProviderManager.setHandler(async (req) => {
     *   const res = await fetch("/my-api", { method: "POST", body: JSON.stringify(req) });
     *   const data = await res.json();
     *   return { text: data.suggestion };
     * });
     * ```
     */
    setHandler(handler: AiHandlerFn): void {
        this.handler = handler;
        this.routeConfig = null;
        this.notify();
    }

    /**
     * Set a streaming handler for AI suggestions.
     *
     * @example
     * ```ts
     * AiProviderManager.setStreamHandler(async (req, onChunk) => {
     *   const stream = await myStreamingAPI(req);
     *   for await (const chunk of stream) {
     *     onChunk(chunk.text, false);
     *   }
     *   onChunk("", true);
     * });
     * ```
     */
    setStreamHandler(handler: AiStreamHandlerFn): void {
        this.streamHandler = handler;
        this.notify();
    }

    /**
     * Set a backend route for AI suggestions.
     * The provider will POST `AiSuggestionRequest` as JSON.
     * Expected response: `{ text: string }` or SSE stream.
     *
     * @example
     * ```ts
     * AiProviderManager.setRoute("/api/ai/suggest");
     * AiProviderManager.setRoute("/api/ai/suggest", { streaming: true });
     * AiProviderManager.setRoute("https://my-server.com/ai", {
     *   headers: { "X-Session": sessionId },
     *   streaming: true,
     * });
     * ```
     */
    setRoute(url: string, options?: { headers?: Record<string, string>; streaming?: boolean }): void {
        this.routeConfig = { url, ...options };
        this.handler = null;
        this.notify();
    }

    /** Check if the AI provider is configured */
    isActive(): boolean {
        return !!(this.handler || this.routeConfig);
    }

    /** Check if streaming is available */
    isStreamingAvailable(): boolean {
        return !!(this.streamHandler || this.routeConfig?.streaming);
    }

    /** Remove all handlers and routes */
    clear(): void {
        this.handler = null;
        this.streamHandler = null;
        this.routeConfig = null;
        this.notify();
    }

    // ── Suggestion API ───────────────────────────────────────

    /**
     * Get a suggestion (non-streaming).
     * Returns null if provider is not configured.
     */
    async getSuggestion(request: AiSuggestionRequest): Promise<AiSuggestionResponse | null> {
        if (!this.isActive()) return null;

        try {
            this.abortController?.abort();
            this.abortController = new AbortController();

            // Prefer user-provided handler
            if (this.handler) {
                return await this.handler(request);
            }

            // Fall back to backend route
            if (this.routeConfig) {
                const headers: Record<string, string> = {
                    "Content-Type": "application/json",
                    ...this.routeConfig.headers,
                };

                const response = await fetch(this.routeConfig.url, {
                    method: "POST",
                    headers,
                    body: JSON.stringify(request),
                    signal: this.abortController.signal,
                });

                if (!response.ok) {
                    console.warn(`[AiProvider] HTTP ${response.status}: ${response.statusText}`);
                    return null;
                }

                const data = await response.json();
                return data?.text ? { text: data.text } : null;
            }

            return null;
        } catch (err) {
            if ((err as Error).name === "AbortError") return null;
            console.warn("[AiProvider] Request failed:", err);
            return null;
        }
    }

    /**
     * Get a streaming suggestion.
     * Calls onChunk for each piece, and onChunk("", true) when done.
     */
    async streamSuggestion(
        request: AiSuggestionRequest,
        onChunk: AiStreamCallback,
    ): Promise<void> {
        if (!this.isActive()) return;

        try {
            this.abortController?.abort();
            this.abortController = new AbortController();

            // Prefer user-provided stream handler
            if (this.streamHandler) {
                await this.streamHandler(request, onChunk);
                return;
            }

            // Fall back to backend SSE route
            if (this.routeConfig?.streaming) {
                const headers: Record<string, string> = {
                    "Content-Type": "application/json",
                    ...this.routeConfig.headers,
                };

                const response = await fetch(this.routeConfig.url, {
                    method: "POST",
                    headers,
                    body: JSON.stringify(request),
                    signal: this.abortController.signal,
                });

                if (!response.ok || !response.body) {
                    console.warn(`[AiProvider] Stream failed: HTTP ${response.status}`);
                    onChunk("", true);
                    return;
                }

                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let buffer = "";

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split("\n");
                    buffer = lines.pop() ?? "";

                    for (const line of lines) {
                        if (line.startsWith("data: ")) {
                            const data = line.slice(6).trim();
                            if (data === "[DONE]") {
                                onChunk("", true);
                                return;
                            }
                            try {
                                const parsed = JSON.parse(data);
                                if (parsed.text) onChunk(parsed.text, false);
                            } catch { /* ignore malformed chunks */ }
                        }
                    }
                }
                onChunk("", true);
                return;
            }

            // No streaming available — fall back to non-streaming
            const result = await this.getSuggestion(request);
            if (result?.text) {
                onChunk(result.text, false);
            }
            onChunk("", true);
        } catch (err) {
            if ((err as Error).name !== "AbortError") {
                console.warn("[AiProvider] Stream error:", err);
            }
            onChunk("", true);
        }
    }

    /** Abort any in-flight request */
    abort(): void {
        this.abortController?.abort();
        this.abortController = null;
    }

    // ── Subscription ─────────────────────────────────────────

    subscribe(listener: AiProviderListener): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private notify(): void {
        this.listeners.forEach((l) => l());
    }
}

/** Singleton AI provider manager */
export const AiProviderManager = new AiProviderManagerImpl();
