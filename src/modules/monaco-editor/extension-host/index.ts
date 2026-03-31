/**
 * @module extension-host
 *
 * Custom Extension Host — a VS Code-like extension system for Terminus.
 *
 * Architecture:
 *   ┌──────────────────────┐         ┌──────────────────────────┐
 *   │    Main Thread        │  RPC   │   Extension Host Worker   │
 *   │                       │◄──────►│                           │
 *   │  ExtensionHostMain    │        │  ext-host-worker          │
 *   │  CommandRegistry      │        │  vscode API shim          │
 *   │  MenuRegistry         │        │  Extension modules        │
 *   │  ActivationService    │        │  Sandboxed require        │
 *   │  ExtensionInstaller   │        │                           │
 *   │  WorkspaceBridge      │        │                           │
 *   └──────────────────────┘         └──────────────────────────┘
 */

// ─── Core types ──────────────────────────────────────────────
export type {
    ActivationEvent,
    ContributedCommand,
    ContributedKeybinding,
    ContributedLanguage,
    ContributedMenuItem,
    Disposable,
    ExtensionContributions,
    ExtensionContext,
    ExtensionHostEvent,
    ExtensionHostEventListener,
    ExtensionInfo,
    ExtensionManifest,
    ExtensionStatus,
    LogOutputChannel,
    Memento,
    MenuLocation,
    RegisteredCommand,
    ResolvedMenuItem,
    RPCError,
    RPCMessage,
    RPCNotification,
    RPCRequest,
    RPCResponse,
} from "./types";

// ─── RPC ─────────────────────────────────────────────────────
export { RPCChannel, WorkerTransport, WorkerSelfTransport } from "./rpc";
export type { RPCTransport } from "./rpc";

// ─── Runtime ─────────────────────────────────────────────────
export { ExtensionHostMain } from "./runtime";
export type { ExtensionHostOptions } from "./runtime";

// ─── Commands ────────────────────────────────────────────────
export { CommandRegistry } from "./commands";

// ─── Menus ───────────────────────────────────────────────────
export { MenuRegistry } from "./menus";
export type { MenuContext } from "./menus";

// ─── Activation ──────────────────────────────────────────────
export { ActivationService } from "./activation";

// ─── Installer ───────────────────────────────────────────────
export { ExtensionInstaller, validateManifest } from "./installer";
export type { ValidationResult } from "./installer";
export { ExtensionOPFS } from "./installer";
export {
    getExtensionDB,
    searchExtensions,
    listExtensions,
    listExtensionFiles,
} from "./installer";
export type {
    ExtensionRecord,
    CommandRecord,
    FileRecord,
    SearchResult,
} from "./installer";

// ─── Workspace ───────────────────────────────────────────────
export { WorkspaceBridge } from "./workspace";
export type { WorkspaceFileSystem } from "./workspace";

// ─── API shim ────────────────────────────────────────────────
export {
    createVSCodeAPI,
    dialogService,
    notificationService,
    ExtensionDialogHost,
    useDialog,
} from "./api";
export type {
    VSCodeAPI,
    CommandsAPI,
    WindowAPI,
    WorkspaceAPI,
    LanguagesAPI,
    DialogRequest,
    DialogAPI,
    MessageSeverity,
    NotificationSeverity,
    NotificationOptions,
    ShowNotificationFn,
} from "./api";
