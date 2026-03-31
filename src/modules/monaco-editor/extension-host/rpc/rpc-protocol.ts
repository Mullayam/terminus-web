/**
 * @module extension-host/rpc/rpc-protocol
 *
 * Bi-directional JSON-RPC 2.0 protocol over MessagePort / Worker postMessage.
 * Supports request–response and one-way notifications.
 */

import type {
    Disposable,
    RPCError,
    RPCMessage,
    RPCNotification,
    RPCRequest,
    RPCResponse,
} from "../types";

// ─── Error codes (JSON-RPC standard + custom) ────────────────
export const RPC_PARSE_ERROR = -32700;
export const RPC_INVALID_REQUEST = -32600;
export const RPC_METHOD_NOT_FOUND = -32601;
export const RPC_INTERNAL_ERROR = -32603;
export const RPC_TIMEOUT = -32000;

// ─── Transport abstraction ───────────────────────────────────

/** Low-level message transport (Worker, MessagePort, etc). */
export interface RPCTransport {
    postMessage(message: RPCMessage): void;
    onMessage(handler: (message: RPCMessage) => void): Disposable;
    dispose?(): void;
}

// ─── Pending request tracker ─────────────────────────────────

interface PendingRequest {
    resolve: (result: unknown) => void;
    reject: (err: RPCError) => void;
    timer?: ReturnType<typeof setTimeout>;
}

// ─── RPC Channel ─────────────────────────────────────────────

export class RPCChannel implements Disposable {
    private nextId = 1;
    private pending = new Map<number, PendingRequest>();
    private methods = new Map<
        string,
        (...args: unknown[]) => unknown | Promise<unknown>
    >();
    private disposable: Disposable;
    private disposed = false;

    constructor(
        private transport: RPCTransport,
        private defaultTimeout = 30_000,
    ) {
        this.disposable = transport.onMessage((msg) => this.handleMessage(msg));
    }

    // ─── Outgoing ────────────────────────────────────────────

    /** Send a request and wait for a response. */
    call<T = unknown>(
        method: string,
        params?: unknown[],
        timeout?: number,
    ): Promise<T> {
        if (this.disposed) {
            return Promise.reject(
                rpcError(RPC_INTERNAL_ERROR, "RPC channel disposed"),
            );
        }

        const id = this.nextId++;
        const request: RPCRequest = { jsonrpc: "2.0", id, method, params };

        return new Promise<T>((resolve, reject) => {
            const pending: PendingRequest = {
                resolve: resolve as (v: unknown) => void,
                reject,
            };

            const ms = timeout ?? this.defaultTimeout;
            if (ms > 0) {
                pending.timer = setTimeout(() => {
                    this.pending.delete(id);
                    reject(
                        rpcError(
                            RPC_TIMEOUT,
                            `RPC call "${method}" timed out after ${ms}ms`,
                        ),
                    );
                }, ms);
            }

            this.pending.set(id, pending);
            this.transport.postMessage(request);
        });
    }

    /** Send a notification (fire-and-forget). */
    notify(method: string, params?: unknown[]): void {
        if (this.disposed) return;
        const notification: RPCNotification = {
            jsonrpc: "2.0",
            method,
            params,
        };
        this.transport.postMessage(notification);
    }

    // ─── Incoming ────────────────────────────────────────────

    /** Register a method handler for incoming requests. */
    onRequest(
        method: string,
        handler: (...args: unknown[]) => unknown | Promise<unknown>,
    ): Disposable {
        this.methods.set(method, handler);
        return {
            dispose: () => {
                this.methods.delete(method);
            },
        };
    }

    // ─── Internal ────────────────────────────────────────────

    private handleMessage(msg: RPCMessage): void {
        if (isResponse(msg)) {
            this.handleResponse(msg);
        } else if (isRequest(msg)) {
            this.handleRequest(msg);
        } else if (isNotification(msg)) {
            this.handleNotification(msg);
        }
    }

    private handleResponse(msg: RPCResponse): void {
        const pending = this.pending.get(msg.id);
        if (!pending) return;
        this.pending.delete(msg.id);
        if (pending.timer) clearTimeout(pending.timer);

        if (msg.error) {
            pending.reject(msg.error);
        } else {
            pending.resolve(msg.result);
        }
    }

    private async handleRequest(msg: RPCRequest): Promise<void> {
        const handler = this.methods.get(msg.method);
        if (!handler) {
            this.sendResponse(
                msg.id,
                undefined,
                rpcError(
                    RPC_METHOD_NOT_FOUND,
                    `Method not found: ${msg.method}`,
                ),
            );
            return;
        }

        try {
            const result = await handler(...(msg.params ?? []));
            this.sendResponse(msg.id, result);
        } catch (err) {
            this.sendResponse(
                msg.id,
                undefined,
                rpcError(
                    RPC_INTERNAL_ERROR,
                    err instanceof Error ? err.message : String(err),
                ),
            );
        }
    }

    private handleNotification(msg: RPCNotification): void {
        const handler = this.methods.get(msg.method);
        if (!handler) return;
        try {
            handler(...(msg.params ?? []));
        } catch (err) {
            console.error(
                `[RPCChannel] Error in notification handler "${msg.method}":`,
                err,
            );
        }
    }

    private sendResponse(id: number, result?: unknown, error?: RPCError): void {
        const response: RPCResponse = { jsonrpc: "2.0", id };
        if (error) {
            response.error = error;
        } else {
            response.result = result;
        }
        this.transport.postMessage(response);
    }

    // ─── Disposal ────────────────────────────────────────────

    dispose(): void {
        if (this.disposed) return;
        this.disposed = true;

        // Reject all pending requests
        for (const [, pending] of this.pending) {
            if (pending.timer) clearTimeout(pending.timer);
            pending.reject(
                rpcError(RPC_INTERNAL_ERROR, "RPC channel disposed"),
            );
        }
        this.pending.clear();
        this.methods.clear();
        this.disposable.dispose();
        this.transport.dispose?.();
    }
}

// ─── Helpers ─────────────────────────────────────────────────

function rpcError(code: number, message: string): RPCError {
    return { code, message };
}

function isRequest(msg: RPCMessage): msg is RPCRequest {
    return "id" in msg && "method" in msg;
}

function isResponse(msg: RPCMessage): msg is RPCResponse {
    return "id" in msg && !("method" in msg);
}

function isNotification(msg: RPCMessage): msg is RPCNotification {
    return !("id" in msg) && "method" in msg;
}
