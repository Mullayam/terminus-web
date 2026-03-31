/**
 * @module extension-host/runtime/ext-host-worker
 *
 * Code that runs INSIDE the Web Worker.
 * Loads extensions, creates sandboxed vscode APIs, manages lifecycle.
 */

import { RPCChannel } from "../rpc/rpc-protocol";
import { WorkerSelfTransport } from "../rpc/worker-transport";
import { createVSCodeAPI } from "../api/vscode-api";
import type { Disposable, ExtensionContext, Memento } from "../types";

// ─── Extension module shape ──────────────────────────────────

interface ExtensionModule {
    activate(context: ExtensionContext): void | Promise<void>;
    deactivate?(): void | Promise<void>;
}

// ─── State ───────────────────────────────────────────────────

const rpc = new RPCChannel(new WorkerSelfTransport());
const activeExtensions = new Map<
    string,
    { module: ExtensionModule; context: ExtensionContext }
>();

// ─── RPC handlers (invoked by main thread) ───────────────────

rpc.onRequest(
    "runtime/activate",
    async (extensionId: unknown, source: unknown, extensionPath: unknown) => {
        const id = extensionId as string;
        const code = source as string;
        const path = extensionPath as string;

        if (activeExtensions.has(id)) {
            throw new Error(`Extension already active: ${id}`);
        }

        // Create the extension module from source
        const module = loadExtensionModule(code);

        // Build context
        const context = createExtensionContext(id, path);

        // Build vscode API
        const vscode = createVSCodeAPI(rpc, id);

        // Inject `vscode` into the module's scope via a wrapper.
        // The module's `activate(context)` can use `require('vscode')` or
        // the injected global.
        injectVSCodeGlobal(vscode);

        // Call activate
        await module.activate(context);

        activeExtensions.set(id, { module, context });
    },
);

rpc.onRequest("runtime/deactivate", async (extensionId: unknown) => {
    const id = extensionId as string;
    const entry = activeExtensions.get(id);
    if (!entry) return;

    // Call deactivate if defined
    await entry.module.deactivate?.();

    // Dispose all subscriptions
    for (const sub of entry.context.subscriptions) {
        try {
            sub.dispose();
        } catch (err) {
            console.error(`[ExtHost] Error disposing sub for ${id}:`, err);
        }
    }

    activeExtensions.delete(id);
});

rpc.onRequest("runtime/ping", () => "pong");

// ─── Module loading ──────────────────────────────────────────

function loadExtensionModule(source: string): ExtensionModule {
    // Construct a module-like environment.
    // Extensions are bundled as CommonJS or UMD.
    const exports: Record<string, unknown> = {};
    const module = { exports };

    // Create a sandboxed function. We intentionally restrict globals.
    // eslint-disable-next-line no-new-func
    const factory = new Function(
        "module",
        "exports",
        "require",
        source,
    );

    factory(module, exports, sandboxedRequire);

    const mod = (module.exports as unknown as ExtensionModule) ?? (exports as unknown as ExtensionModule);

    if (typeof mod.activate !== "function") {
        throw new Error("Extension must export an activate() function");
    }

    return mod;
}

/**
 * Sandboxed require — only allows `vscode`.
 * Everything else is denied for security.
 */
function sandboxedRequire(id: string): unknown {
    if (id === "vscode") {
        return (globalThis as Record<string, unknown>).__vscode;
    }
    throw new Error(`Cannot require "${id}" — only "vscode" is allowed in extensions`);
}

function injectVSCodeGlobal(api: ReturnType<typeof createVSCodeAPI>): void {
    (globalThis as Record<string, unknown>).__vscode = api;
}

// ─── Context factory ─────────────────────────────────────────

function createExtensionContext(
    extensionId: string,
    extensionPath: string,
): ExtensionContext {
    return {
        extensionId,
        extensionPath,
        subscriptions: [],
        globalState: createMemento(`global:${extensionId}`),
        workspaceState: createMemento(`workspace:${extensionId}`),
        log: {
            info: (msg) => rpc.notify("window/log", [extensionId, "info", msg]),
            warn: (msg) => rpc.notify("window/log", [extensionId, "warn", msg]),
            error: (msg) =>
                rpc.notify("window/log", [extensionId, "error", msg]),
            debug: (msg) =>
                rpc.notify("window/log", [extensionId, "debug", msg]),
        },
    };
}

function createMemento(prefix: string): Memento {
    const cache = new Map<string, unknown>();

    return {
        get<T>(key: string, defaultValue?: T): T | undefined {
            const v = cache.get(`${prefix}:${key}`);
            return (v as T) ?? defaultValue;
        },
        async update(key: string, value: unknown): Promise<void> {
            cache.set(`${prefix}:${key}`, value);
            // Persist to main thread
            await rpc.call("memento/update", [prefix, key, value]);
        },
        keys(): readonly string[] {
            return [...cache.keys()]
                .filter((k) => k.startsWith(`${prefix}:`))
                .map((k) => k.slice(prefix.length + 1));
        },
    };
}
