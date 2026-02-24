/**
 * @module editor/api/providers
 *
 * Strategy Pattern: ContentProvider interface with concrete implementations.
 *
 * The editor module is a **pure consumer** — it defines the interface and
 * base utilities, but never owns implementation-specific code (API clients,
 * config constants, etc.). Consumers create their own providers externally.
 *
 * Built-in providers:
 *  - SocketContentProvider → Socket.IO real-time (user supplies socket OR url + events)
 *  - NoopContentProvider   → In-memory / offline / demo
 *
 * Creating providers (pick any approach):
 *
 * 1. **Extend BaseContentProvider:**
 *    ```ts
 *    class MyApiProvider extends BaseContentProvider {
 *      async fetchContent(sid, path) { ... }
 *      async saveContent(sid, path, content) { ... }
 *    }
 *    <FileEditor provider={new MyApiProvider()} ... />
 *    ```
 *
 * 2. **Use defineContentProvider (functional):**
 *    ```ts
 *    const provider = defineContentProvider({
 *      fetchContent: async (sid, path) => ({ content: "..." }),
 *      saveContent:  async (sid, path, c) => ({ success: true }),
 *    });
 *    ```
 *
 * 3. **Factory with raw functions:**
 *    ```ts
 *    const provider = createContentProvider(myFetchFn, mySaveFn);
 *    ```
 *
 * 4. **Factory for socket:**
 *    ```ts
 *    const provider = createContentProvider("socket", {
 *      url: "http://localhost:3000",
 *      events: { fetchRequest: "file:read", fetchResponse: "file:read:res", ... },
 *    });
 *    ```
 */
import type { ContentProvider } from "../types";
import { io, type Socket } from "socket.io-client";

// ═══════════════════════════════════════════════════════════════
//  Socket Provider Options
// ═══════════════════════════════════════════════════════════════

/** Event name mapping for SocketContentProvider */
export interface SocketProviderEvents {
    /** Event emitted to request file content */
    fetchRequest: string;
    /** Event listened for to receive file content */
    fetchResponse: string;
    /** Event emitted to save file content */
    saveRequest: string;
    /** Event listened for to confirm save */
    saveResponse: string;
    /** Event listened for to receive errors (optional) */
    error?: string;
    /** Event listened for to receive real-time content pushes (optional) */
    contentUpdate?: string;
}

/** Configuration for SocketContentProvider */
export interface SocketProviderOptions {
    /** Pre-existing Socket.IO instance — if provided, `url` is ignored */
    socket?: Socket;
    /** Socket.IO server URL — used only when `socket` is not provided */
    url?: string;
    /** Mapping of event names for file operations */
    events: SocketProviderEvents;
    /** Extra query params sent on connect (e.g. `{ sessionId: "abc" }`) */
    query?: Record<string, string>;
    /** Timeout in ms for request/response operations (default 15 000) */
    timeout?: number;
    /** Enable automatic reconnection (default true) */
    reconnection?: boolean;
    /** Max reconnection attempts (default 5) */
    reconnectionAttempts?: number;
}

// ═══════════════════════════════════════════════════════════════
//  Base Content Provider (abstract class for extension)
// ═══════════════════════════════════════════════════════════════

/**
 * Abstract base class that consumers can extend to build their own providers.
 * Provides a default no-op `onContentUpdate` and `dispose`, so subclasses
 * only need to implement `fetchContent` and `saveContent`.
 *
 * @example
 * ```ts
 * class S3ContentProvider extends BaseContentProvider {
 *   async fetchContent(sessionId, filePath) {
 *     const res = await s3.getObject({ Bucket: sessionId, Key: filePath });
 *     return { content: await res.Body.transformToString() };
 *   }
 *   async saveContent(sessionId, filePath, content) {
 *     await s3.putObject({ Bucket: sessionId, Key: filePath, Body: content });
 *     return { success: true };
 *   }
 * }
 * ```
 */
export abstract class BaseContentProvider implements ContentProvider {
    abstract fetchContent(
        sessionId: string,
        filePath: string,
    ): Promise<{ content: string; error?: string }>;

    abstract saveContent(
        sessionId: string,
        filePath: string,
        content: string,
    ): Promise<{ success: boolean; error?: string }>;

    /** Override to receive real-time content pushes. Default: no-op. */
    onContentUpdate(_callback: (content: string) => void): () => void {
        return () => { };
    }

    /** Override to clean up resources. Default: no-op. */
    dispose(): void { }
}

// ═══════════════════════════════════════════════════════════════
//  defineContentProvider helper
// ═══════════════════════════════════════════════════════════════

/**
 * Shorthand functional helper to build a ContentProvider from plain functions.
 * No class required – just pass an object with the methods you need.
 *
 * @example
 * ```ts
 * const myProvider = defineContentProvider({
 *   fetchContent: async (sid, path) => {
 *     const res = await fetch(`/api/files/${sid}/${path}`);
 *     const json = await res.json();
 *     return { content: json.data };
 *   },
 *   saveContent: async (sid, path, content) => {
 *     await fetch(`/api/files/${sid}/${path}`, { method: "PUT", body: content });
 *     return { success: true };
 *   },
 * });
 * ```
 */
export function defineContentProvider(
    impl: Pick<ContentProvider, "fetchContent" | "saveContent"> &
        Partial<Pick<ContentProvider, "onContentUpdate">> &
    { dispose?: () => void },
): ContentProvider & { dispose: () => void } {
    return {
        fetchContent: impl.fetchContent.bind(impl),
        saveContent: impl.saveContent.bind(impl),
        onContentUpdate: impl.onContentUpdate?.bind(impl) ?? (() => () => { }),
        dispose: impl.dispose?.bind(impl) ?? (() => { }),
    };
}

// ═══════════════════════════════════════════════════════════════
//  Socket Content Provider  (real-time via Socket.IO)
// ═══════════════════════════════════════════════════════════════

/**
 * SocketContentProvider uses Socket.IO for both fetching and saving file
 * content, enabling real-time collaborative editing.
 *
 * The consumer **must** supply either an existing Socket.IO instance or a
 * server URL together with an event-name mapping — the module never imports
 * any app-specific config or event constants.
 *
 * @example
 * ```ts
 * // Pass an existing socket
 * const provider = new SocketContentProvider({
 *   socket: mySocket,
 *   events: {
 *     fetchRequest:  "sftp:edit:file:request",
 *     fetchResponse: "sftp:edit:file:request:response",
 *     saveRequest:   "sftp:edit:file:done",
 *     saveResponse:  "sftp:edit:file:done",
 *     error:         "sftp:error",
 *   },
 * });
 *
 * // Or provide a URL and let the provider connect
 * const provider = new SocketContentProvider({
 *   url: "http://localhost:4000",
 *   events: { ... },
 *   query: { sessionId: "abc" },
 * });
 * ```
 */
export class SocketContentProvider extends BaseContentProvider {
    private socket: Socket | null = null;
    private ownsSocket = false;
    private contentUpdateListeners = new Set<(content: string) => void>();
    private readonly options: Required<Pick<SocketProviderOptions, "events" | "timeout">> &
        Omit<SocketProviderOptions, "events" | "timeout">;

    constructor(options: SocketProviderOptions) {
        super();
        this.options = {
            ...options,
            timeout: options.timeout ?? 15_000,
        };
    }

    /** Get or create the socket connection for the given session */
    private getSocket(sessionId: string): Socket {
        // Reuse external socket if provided
        if (this.options.socket) {
            this.socket = this.options.socket;
            return this.socket;
        }

        // Reuse existing internal socket if still connected
        if (this.socket?.connected) return this.socket;

        if (!this.options.url) {
            throw new Error(
                "SocketContentProvider: either `socket` or `url` must be provided in options",
            );
        }

        // Create a new dedicated socket connection
        this.socket = io(this.options.url, {
            query: { sessionId, ...this.options.query },
            autoConnect: true,
            reconnection: this.options.reconnection ?? true,
            reconnectionAttempts: this.options.reconnectionAttempts ?? 5,
            reconnectionDelay: 1000,
        });
        this.ownsSocket = true;

        // Wire up real-time content update broadcasts (if event configured)
        const updateEvent = this.options.events.contentUpdate;
        if (updateEvent) {
            this.socket.on(updateEvent, (data: { content: string }) => {
                this.contentUpdateListeners.forEach((cb) => cb(data.content));
            });
        }

        return this.socket;
    }

    async fetchContent(
        sessionId: string,
        filePath: string,
    ): Promise<{ content: string; error?: string }> {
        return new Promise((resolve) => {
            const socket = this.getSocket(sessionId);
            const { events, timeout } = this.options;

            const timer = setTimeout(() => {
                resolve({ content: "", error: "Socket fetch timed out" });
            }, timeout);

            // Emit file read request; listen for the one-time response
            socket.emit(events.fetchRequest, { sessionId, filePath });

            socket.once(events.fetchResponse, (data: { status: boolean; content: string; message?: string }) => {
                clearTimeout(timer);
                if (!data.status) {
                    resolve({ content: "", error: data.message || "Failed to load file via socket" });
                } else {
                    resolve({ content: data.content });
                }
            });

            if (events.error) {
                socket.once(events.error, (error: string) => {
                    clearTimeout(timer);
                    resolve({ content: "", error: error || "Socket error while fetching file" });
                });
            }
        });
    }

    async saveContent(
        sessionId: string,
        filePath: string,
        content: string,
    ): Promise<{ success: boolean; error?: string }> {
        return new Promise((resolve) => {
            const socket = this.getSocket(sessionId);
            const { events, timeout } = this.options;

            const timer = setTimeout(() => {
                resolve({ success: false, error: "Socket save timed out" });
            }, timeout);

            socket.emit(events.saveRequest, { sessionId, filePath, content });

            socket.once(events.saveResponse, (data: { status: boolean; message?: string }) => {
                clearTimeout(timer);
                if (!data.status) {
                    resolve({ success: false, error: data.message || "Failed to save file via socket" });
                } else {
                    resolve({ success: true });
                }
            });

            if (events.error) {
                socket.once(events.error, (error: string) => {
                    clearTimeout(timer);
                    resolve({ success: false, error: error || "Socket error while saving file" });
                });
            }
        });
    }

    /**
     * Subscribe to real-time content updates from other collaborators.
     * Returns an unsubscribe function.
     */
    override onContentUpdate(callback: (content: string) => void): () => void {
        this.contentUpdateListeners.add(callback);
        return () => {
            this.contentUpdateListeners.delete(callback);
        };
    }

    /** Clean up the socket connection (call when editor unmounts) */
    override dispose() {
        if (this.socket && this.ownsSocket) {
            this.socket.removeAllListeners();
            this.socket.disconnect();
        }
        this.socket = null;
        this.ownsSocket = false;
        this.contentUpdateListeners.clear();
    }
}

// ═══════════════════════════════════════════════════════════════
//  Noop Content Provider  (in-memory / offline / demo)
// ═══════════════════════════════════════════════════════════════

/**
 * In-memory provider useful for demos, tests, or offline editing.
 * Content lives only in the browser – nothing hits the network.
 *
 * @example
 * ```ts
 * const demo = new NoopContentProvider("// Hello World!");
 * <FileEditor provider={demo} sessionId="demo" remotePath="demo.ts" />
 * ```
 */
export class NoopContentProvider extends BaseContentProvider {
    private store = new Map<string, string>();

    /**
     * @param initialContent - Optional content to pre-load for any file path
     */
    constructor(initialContent?: string) {
        super();
        if (initialContent !== undefined) {
            this.store.set("__default__", initialContent);
        }
    }

    async fetchContent(
        _sessionId: string,
        filePath: string,
    ): Promise<{ content: string; error?: string }> {
        return { content: this.store.get(filePath) ?? this.store.get("__default__") ?? "" };
    }

    async saveContent(
        _sessionId: string,
        filePath: string,
        content: string,
    ): Promise<{ success: boolean; error?: string }> {
        this.store.set(filePath, content);
        return { success: true };
    }
}

// ═══════════════════════════════════════════════════════════════
//  Factory function  (overloaded)
// ═══════════════════════════════════════════════════════════════

/**
 * Convenience factory to create a ContentProvider.
 *
 * @example
 * ```ts
 * // From raw fetch / save functions
 * const api = createContentProvider(myFetchFn, mySaveFn);
 *
 * // Socket provider — pass existing socket or URL + events
 * const sock = createContentProvider("socket", {
 *   socket: mySocket,
 *   events: { fetchRequest: "file:read", fetchResponse: "file:read:res",
 *             saveRequest: "file:write", saveResponse: "file:write:res" },
 * });
 *
 * // In-memory / demo
 * const noop = createContentProvider("noop");
 * const noop2 = createContentProvider("noop", "// initial content");
 * ```
 */

/* ── overload signatures ─────────────────────────────────── */

/** Create a provider from raw fetch/save functions */
export function createContentProvider(
    fetchFn: ContentProvider["fetchContent"],
    saveFn: ContentProvider["saveContent"],
    onUpdate?: ContentProvider["onContentUpdate"],
): ContentProvider & { dispose: () => void };

/** Create a Socket.IO provider */
export function createContentProvider(
    type: "socket",
    options: SocketProviderOptions,
): SocketContentProvider;

/** Create an in-memory / noop provider */
export function createContentProvider(
    type: "noop",
    initialContent?: string,
): NoopContentProvider;

/* ── implementation ──────────────────────────────────────── */

export function createContentProvider(
    typeOrFetch: "socket" | "noop" | ContentProvider["fetchContent"],
    optionsOrSave?: SocketProviderOptions | string | ContentProvider["saveContent"],
    onUpdate?: ContentProvider["onContentUpdate"],
): ContentProvider & { dispose: () => void } {
    // Overload 1: raw functions
    if (typeof typeOrFetch === "function") {
        return defineContentProvider({
            fetchContent: typeOrFetch,
            saveContent: optionsOrSave as ContentProvider["saveContent"],
            onContentUpdate: onUpdate,
        });
    }

    // Overload 2: socket
    if (typeOrFetch === "socket") {
        return new SocketContentProvider(optionsOrSave as SocketProviderOptions);
    }

    // Overload 3: noop
    return new NoopContentProvider(optionsOrSave as string | undefined);
}

 