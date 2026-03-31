/**
 * @module extension-host/rpc/worker-transport
 *
 * RPCTransport implementation for Web Worker communication.
 * Used on both main thread (talking to a Worker) and worker side (talking to main).
 */

import type { Disposable, RPCMessage } from "../types";
import type { RPCTransport } from "./rpc-protocol";

/** Transport for the main thread side — wraps a Worker instance. */
export class WorkerTransport implements RPCTransport {
    private handler: ((msg: RPCMessage) => void) | null = null;
    private listener: ((ev: MessageEvent) => void) | null = null;

    constructor(private worker: Worker) {}

    postMessage(message: RPCMessage): void {
        this.worker.postMessage(message);
    }

    onMessage(handler: (message: RPCMessage) => void): Disposable {
        this.handler = handler;
        this.listener = (ev: MessageEvent) => {
            if (ev.data && ev.data.jsonrpc === "2.0") {
                handler(ev.data as RPCMessage);
            }
        };
        this.worker.addEventListener("message", this.listener);
        return {
            dispose: () => {
                if (this.listener) {
                    this.worker.removeEventListener("message", this.listener);
                    this.listener = null;
                    this.handler = null;
                }
            },
        };
    }

    dispose(): void {
        if (this.listener) {
            this.worker.removeEventListener("message", this.listener);
            this.listener = null;
            this.handler = null;
        }
    }
}

/** Minimal worker global scope interface (avoids needing webworker lib). */
interface WorkerGlobalScope {
    postMessage(message: unknown): void;
    addEventListener(type: string, listener: (ev: MessageEvent) => void): void;
    removeEventListener(type: string, listener: (ev: MessageEvent) => void): void;
}

/**
 * Transport for the worker side — wraps `self` (DedicatedWorkerGlobalScope).
 * Used inside the extension host worker.
 */
export class WorkerSelfTransport implements RPCTransport {
    private handler: ((msg: RPCMessage) => void) | null = null;
    private listener: ((ev: MessageEvent) => void) | null = null;

    /* eslint-disable-next-line no-restricted-globals */
    private scope: WorkerGlobalScope;

    constructor() {
        /* eslint-disable-next-line no-restricted-globals */
        this.scope = self as unknown as WorkerGlobalScope;
    }

    postMessage(message: RPCMessage): void {
        this.scope.postMessage(message);
    }

    onMessage(handler: (message: RPCMessage) => void): Disposable {
        this.handler = handler;
        this.listener = (ev: MessageEvent) => {
            if (ev.data && ev.data.jsonrpc === "2.0") {
                handler(ev.data as RPCMessage);
            }
        };
        this.scope.addEventListener("message", this.listener);
        return {
            dispose: () => {
                if (this.listener) {
                    this.scope.removeEventListener("message", this.listener);
                    this.listener = null;
                    this.handler = null;
                }
            },
        };
    }

    dispose(): void {
        if (this.listener) {
            this.scope.removeEventListener("message", this.listener);
            this.listener = null;
            this.handler = null;
        }
    }
}
