/**
 * @module extension-host/types
 *
 * Core type definitions for the custom extension host system.
 *
 * Architecture:
 *   Main Thread  <──JSON-RPC──>  Extension Host (Worker)
 *        │                              │
 *   Monaco Editor                  Sandboxed runtime
 *   Command Palette                vscode API shim
 *   Context Menus                  Extension code
 *   File System                    activate/deactivate
 */

// ═══════════════════════════════════════════════════════════════
//  EXTENSION MANIFEST (package.json)
// ═══════════════════════════════════════════════════════════════

/** Activation event strings supported by the host. */
export type ActivationEvent =
    | "onStartup"
    | `onCommand:${string}`
    | `onLanguage:${string}`
    | "onFileOpen"
    | `onView:${string}`
    | "*";

/** A contributed command declared in package.json. */
export interface ContributedCommand {
    command: string;
    title: string;
    category?: string;
    icon?: string;
    /** When clause for enablement (simplified). */
    enablement?: string;
}

/** A contributed keybinding. */
export interface ContributedKeybinding {
    command: string;
    key: string;
    mac?: string;
    when?: string;
}

/** Menu location identifiers. */
export type MenuLocation =
    | "commandPalette"
    | "editor/context"
    | "explorer/context"
    | "editor/title"
    | "view/title";

/** A contributed menu item. */
export interface ContributedMenuItem {
    command: string;
    when?: string;
    group?: string;
}

/** The `contributes` section of the extension manifest. */
export interface ExtensionContributions {
    commands?: ContributedCommand[];
    menus?: Partial<Record<MenuLocation, ContributedMenuItem[]>>;
    keybindings?: ContributedKeybinding[];
    languages?: ContributedLanguage[];
    configuration?: Record<string, unknown>;
}

/** A contributed language declaration. */
export interface ContributedLanguage {
    id: string;
    aliases?: string[];
    extensions?: string[];
    filenames?: string[];
    configuration?: string;
}

/** Parsed extension package.json. */
export interface ExtensionManifest {
    name: string;
    displayName?: string;
    version: string;
    description?: string;
    publisher?: string;
    main: string;
    activationEvents?: ActivationEvent[];
    contributes?: ExtensionContributions;
    dependencies?: Record<string, string>;
    engines?: { terminus?: string };
}

// ═══════════════════════════════════════════════════════════════
//  EXTENSION METADATA & LIFECYCLE
// ═══════════════════════════════════════════════════════════════

/** Runtime status of an extension. */
export type ExtensionStatus =
    | "installed"
    | "activating"
    | "active"
    | "deactivating"
    | "inactive"
    | "error";

/** Full runtime state of a loaded extension. */
export interface ExtensionInfo {
    id: string;
    manifest: ExtensionManifest;
    status: ExtensionStatus;
    /** Installation path (virtual or real). */
    installPath: string;
    /** Error message if status === "error". */
    error?: string;
    /** Activation timestamp (ms). */
    activatedAt?: number;
}

/** Extension context passed to `activate(context)`. */
export interface ExtensionContext {
    /** Unique extension ID. */
    extensionId: string;
    /** Subscriptions — disposed on deactivate. */
    subscriptions: Disposable[];
    /** Per-extension persistent storage. */
    globalState: Memento;
    /** Per-workspace storage. */
    workspaceState: Memento;
    /** Absolute path to the extension directory. */
    extensionPath: string;
    /** Log output channel for this extension. */
    log: LogOutputChannel;
}

/** Simple key-value store interface. */
export interface Memento {
    get<T>(key: string, defaultValue?: T): T | undefined;
    update(key: string, value: unknown): Promise<void>;
    keys(): readonly string[];
}

/** Disposable pattern. */
export interface Disposable {
    dispose(): void;
}

/** Log output channel. */
export interface LogOutputChannel {
    info(message: string): void;
    warn(message: string): void;
    error(message: string): void;
    debug(message: string): void;
}

// ═══════════════════════════════════════════════════════════════
//  RPC PROTOCOL
// ═══════════════════════════════════════════════════════════════

/** JSON-RPC 2.0 request. */
export interface RPCRequest {
    jsonrpc: "2.0";
    id: number;
    method: string;
    params?: unknown[];
}

/** JSON-RPC 2.0 successful response. */
export interface RPCResponse {
    jsonrpc: "2.0";
    id: number;
    result?: unknown;
    error?: RPCError;
}

/** JSON-RPC 2.0 notification (no id, no response expected). */
export interface RPCNotification {
    jsonrpc: "2.0";
    method: string;
    params?: unknown[];
}

/** JSON-RPC 2.0 error. */
export interface RPCError {
    code: number;
    message: string;
    data?: unknown;
}

export type RPCMessage = RPCRequest | RPCResponse | RPCNotification;

// ═══════════════════════════════════════════════════════════════
//  COMMAND SYSTEM
// ═══════════════════════════════════════════════════════════════

/** A registered command. */
export interface RegisteredCommand {
    id: string;
    title: string;
    category?: string;
    /** The extension that registered this command (undefined = built-in). */
    extensionId?: string;
    handler: (...args: unknown[]) => unknown | Promise<unknown>;
}

// ═══════════════════════════════════════════════════════════════
//  MENU SYSTEM
// ═══════════════════════════════════════════════════════════════

/** Resolved menu item with command metadata. */
export interface ResolvedMenuItem {
    command: string;
    title: string;
    category?: string;
    icon?: string;
    group?: string;
    when?: string;
    extensionId: string;
}

// ═══════════════════════════════════════════════════════════════
//  EVENTS
// ═══════════════════════════════════════════════════════════════

/** Events emitted by the extension host system. */
export type ExtensionHostEvent =
    | { type: "extension:activated"; extensionId: string }
    | { type: "extension:deactivated"; extensionId: string }
    | { type: "extension:error"; extensionId: string; error: string }
    | { type: "command:registered"; commandId: string }
    | { type: "command:executed"; commandId: string }
    | { type: "menu:changed"; location: MenuLocation };

export type ExtensionHostEventListener = (event: ExtensionHostEvent) => void;
