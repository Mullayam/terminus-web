/**
 * @module extension-host/api/vscode-api
 *
 * `vscode`-compatible API shim passed to extensions.
 * All calls are proxied through RPC to the main thread — extensions
 * NEVER have direct access to Monaco, DOM, or the file system.
 */

import type { RPCChannel } from "../rpc/rpc-protocol";
import type { Disposable, LogOutputChannel } from "../types";

// ═══════════════════════════════════════════════════════════════
//  vscode.commands
// ═══════════════════════════════════════════════════════════════

export interface CommandsAPI {
    registerCommand(
        command: string,
        callback: (...args: unknown[]) => unknown | Promise<unknown>,
    ): Disposable;
    executeCommand<T = unknown>(
        command: string,
        ...args: unknown[]
    ): Promise<T>;
    getCommands(filterInternal?: boolean): Promise<string[]>;
}

function createCommandsAPI(
    rpc: RPCChannel,
    extensionId: string,
): CommandsAPI {
    /** Local handlers registered by this extension (executed in worker). */
    const localHandlers = new Map<
        string,
        (...args: unknown[]) => unknown | Promise<unknown>
    >();

    // Listen for main thread invoking commands that live in the worker
    rpc.onRequest("commands/invoke", async (command: unknown, ...args: unknown[]) => {
        const handler = localHandlers.get(command as string);
        if (handler) return handler(...args);
        throw new Error(`No local handler for command: ${command}`);
    });

    return {
        registerCommand(command, callback) {
            localHandlers.set(command, callback);
            // Notify main thread about registration
            rpc.notify("commands/register", [command, extensionId]);
            return {
                dispose: () => {
                    localHandlers.delete(command);
                    rpc.notify("commands/unregister", [command]);
                },
            };
        },

        async executeCommand<T = unknown>(
            command: string,
            ...args: unknown[]
        ): Promise<T> {
            // Try local first, then delegate to main thread
            const local = localHandlers.get(command);
            if (local) return (await local(...args)) as T;
            return rpc.call<T>("commands/execute", [command, ...args]);
        },

        async getCommands(filterInternal = false): Promise<string[]> {
            return rpc.call<string[]>("commands/list", [filterInternal]);
        },
    };
}

// ═══════════════════════════════════════════════════════════════
//  vscode.window
// ═══════════════════════════════════════════════════════════════

export interface WindowAPI {
    showInformationMessage(message: string, ...items: string[]): Promise<string | undefined>;
    showWarningMessage(message: string, ...items: string[]): Promise<string | undefined>;
    showErrorMessage(message: string, ...items: string[]): Promise<string | undefined>;
    showInputBox(options?: InputBoxOptions): Promise<string | undefined>;
    showQuickPick(items: string[], options?: QuickPickOptions): Promise<string | undefined>;
    createOutputChannel(name: string): LogOutputChannel;
}

export interface InputBoxOptions {
    prompt?: string;
    value?: string;
    placeHolder?: string;
    password?: boolean;
}

export interface QuickPickOptions {
    placeHolder?: string;
    canPickMany?: boolean;
}

function createWindowAPI(rpc: RPCChannel): WindowAPI {
    return {
        showInformationMessage(message, ...items) {
            return rpc.call("window/showMessage", ["info", message, items]);
        },
        showWarningMessage(message, ...items) {
            return rpc.call("window/showMessage", ["warning", message, items]);
        },
        showErrorMessage(message, ...items) {
            return rpc.call("window/showMessage", ["error", message, items]);
        },
        showInputBox(options) {
            return rpc.call("window/showInputBox", [options]);
        },
        showQuickPick(items, options) {
            return rpc.call("window/showQuickPick", [items, options]);
        },
        createOutputChannel(name) {
            return createLogChannel(rpc, name);
        },
    };
}

// ═══════════════════════════════════════════════════════════════
//  vscode.workspace
// ═══════════════════════════════════════════════════════════════

export interface WorkspaceAPI {
    /** Read a file's text content. */
    readFile(uri: string): Promise<string>;
    /** Write text content to a file. */
    writeFile(uri: string, content: string): Promise<void>;
    /** List directory entries. */
    readDirectory(uri: string): Promise<Array<[string, "file" | "directory"]>>;
    /** Delete a file or directory. */
    deleteFile(uri: string, options?: { recursive?: boolean }): Promise<void>;
    /** Rename / move a file. */
    rename(oldUri: string, newUri: string): Promise<void>;
    /** Get the current workspace root. */
    getWorkspaceFolder(): Promise<string | undefined>;
    /** Register a file system watcher callback. */
    onDidChangeFile(
        callback: (changes: FileChange[]) => void,
    ): Disposable;
}

export interface FileChange {
    type: "created" | "changed" | "deleted";
    uri: string;
}

function createWorkspaceAPI(rpc: RPCChannel): WorkspaceAPI {
    return {
        readFile(uri) {
            return rpc.call("workspace/readFile", [uri]);
        },
        writeFile(uri, content) {
            return rpc.call("workspace/writeFile", [uri, content]);
        },
        readDirectory(uri) {
            return rpc.call("workspace/readDirectory", [uri]);
        },
        deleteFile(uri, options) {
            return rpc.call("workspace/deleteFile", [uri, options]);
        },
        rename(oldUri, newUri) {
            return rpc.call("workspace/rename", [oldUri, newUri]);
        },
        getWorkspaceFolder() {
            return rpc.call("workspace/getWorkspaceFolder", []);
        },
        onDidChangeFile(callback) {
            return rpc.onRequest("workspace/fileChanged", (changes: unknown) => {
                callback(changes as FileChange[]);
            });
        },
    };
}

// ═══════════════════════════════════════════════════════════════
//  vscode.languages
// ═══════════════════════════════════════════════════════════════

export interface LanguagesAPI {
    registerCompletionItemProvider(
        languageId: string,
        provider: CompletionItemProvider,
    ): Disposable;
    registerHoverProvider(
        languageId: string,
        provider: HoverProvider,
    ): Disposable;
    setDiagnostics(uri: string, diagnostics: Diagnostic[]): void;
}

export interface CompletionItemProvider {
    provideCompletionItems(
        uri: string,
        position: { line: number; column: number },
    ): Promise<CompletionItem[]>;
}

export interface CompletionItem {
    label: string;
    kind?: number;
    detail?: string;
    insertText?: string;
    documentation?: string;
}

export interface HoverProvider {
    provideHover(
        uri: string,
        position: { line: number; column: number },
    ): Promise<HoverResult | null>;
}

export interface HoverResult {
    contents: string[];
}

export interface Diagnostic {
    range: { startLine: number; startCol: number; endLine: number; endCol: number };
    message: string;
    severity: "error" | "warning" | "info" | "hint";
}

function createLanguagesAPI(
    rpc: RPCChannel,
    extensionId: string,
): LanguagesAPI {
    let providerIdCounter = 0;

    return {
        registerCompletionItemProvider(languageId, provider) {
            const providerId = `${extensionId}:completion:${providerIdCounter++}`;

            // Register a handler for when main thread asks for completions
            const sub = rpc.onRequest(
                `languages/completion/${providerId}`,
                async (uri: unknown, position: unknown) => {
                    return provider.provideCompletionItems(
                        uri as string,
                        position as { line: number; column: number },
                    );
                },
            );

            rpc.notify("languages/registerCompletionProvider", [
                languageId,
                providerId,
            ]);

            return {
                dispose: () => {
                    sub.dispose();
                    rpc.notify("languages/unregisterProvider", [providerId]);
                },
            };
        },

        registerHoverProvider(languageId, provider) {
            const providerId = `${extensionId}:hover:${providerIdCounter++}`;

            const sub = rpc.onRequest(
                `languages/hover/${providerId}`,
                async (uri: unknown, position: unknown) => {
                    return provider.provideHover(
                        uri as string,
                        position as { line: number; column: number },
                    );
                },
            );

            rpc.notify("languages/registerHoverProvider", [
                languageId,
                providerId,
            ]);

            return {
                dispose: () => {
                    sub.dispose();
                    rpc.notify("languages/unregisterProvider", [providerId]);
                },
            };
        },

        setDiagnostics(uri, diagnostics) {
            rpc.notify("languages/setDiagnostics", [
                uri,
                diagnostics,
                extensionId,
            ]);
        },
    };
}

// ═══════════════════════════════════════════════════════════════
//  Factory — creates the full `vscode` namespace
// ═══════════════════════════════════════════════════════════════

export interface VSCodeAPI {
    commands: CommandsAPI;
    window: WindowAPI;
    workspace: WorkspaceAPI;
    languages: LanguagesAPI;
}

/** Create a sandboxed vscode API for a specific extension. */
export function createVSCodeAPI(
    rpc: RPCChannel,
    extensionId: string,
): VSCodeAPI {
    return {
        commands: createCommandsAPI(rpc, extensionId),
        window: createWindowAPI(rpc),
        workspace: createWorkspaceAPI(rpc),
        languages: createLanguagesAPI(rpc, extensionId),
    };
}

// ─── Helpers ─────────────────────────────────────────────────

function createLogChannel(rpc: RPCChannel, name: string): LogOutputChannel {
    const log = (level: string, message: string) => {
        rpc.notify("window/log", [name, level, message]);
    };
    return {
        info: (msg) => log("info", msg),
        warn: (msg) => log("warn", msg),
        error: (msg) => log("error", msg),
        debug: (msg) => log("debug", msg),
    };
}
