/**
 * @module extension-host/runtime/ext-host-main
 *
 * Main-thread coordinator for the extension host.
 * Spawns the worker, wires up RPC, manages activation/deactivation,
 * and bridges commands, menus, and workspace calls.
 */

import { RPCChannel } from "../rpc/rpc-protocol";
import { WorkerTransport } from "../rpc/worker-transport";
import { CommandRegistry } from "../commands/command-registry";
import { MenuRegistry } from "../menus/menu-registry";
import { ActivationService } from "../activation/activation-service";
import { ExtensionInstaller } from "../installer/extension-installer";
import { WorkspaceBridge } from "../workspace/workspace-bridge";
import type { WorkspaceFileSystem } from "../workspace/workspace-bridge";
import type { Disposable, ExtensionInfo } from "../types";

export interface ExtensionHostOptions {
    /** URL of the extension host worker script. */
    workerUrl: string | URL;
    /** Workspace file system implementation. */
    fileSystem?: WorkspaceFileSystem;
    /** Workspace root path. */
    workspaceRoot?: string;
}

/**
 * The ExtensionHostMain is the single orchestrator.
 * Instantiate once per editor session.
 */
export class ExtensionHostMain implements Disposable {
    readonly commands: CommandRegistry;
    readonly menus: MenuRegistry;
    readonly activation: ActivationService;
    readonly installer: ExtensionInstaller;

    private worker: Worker | null = null;
    private rpc: RPCChannel | null = null;
    private workspaceBridge: WorkspaceBridge | null = null;
    private disposables: Disposable[] = [];
    private options: ExtensionHostOptions;

    constructor(options: ExtensionHostOptions) {
        this.options = options;
        this.commands = new CommandRegistry();
        this.menus = new MenuRegistry(this.commands);
        this.installer = new ExtensionInstaller();
        this.activation = new ActivationService((id) => this.activateExtension(id));
    }

    /** Start the extension host worker and load installed extensions. */
    async start(): Promise<void> {
        // 1. Spawn worker
        this.worker = new Worker(this.options.workerUrl, { type: "module" });
        const transport = new WorkerTransport(this.worker);
        this.rpc = new RPCChannel(transport);

        // 2. Wire up main-thread RPC handlers
        this.registerMainThreadHandlers();

        // 3. Set up workspace bridge
        if (this.options.fileSystem) {
            this.workspaceBridge = new WorkspaceBridge(
                this.rpc,
                this.options.fileSystem,
                this.options.workspaceRoot,
            );
            this.disposables.push(this.workspaceBridge);
        }

        // 4. Load installed extensions from IDB
        await this.installer.init();

        // 5. Register activation events for all installed extensions
        for (const ext of this.installer.getAll()) {
            this.activation.registerExtension(ext);
            // Register contributed menus
            if (ext.manifest.contributes?.menus) {
                this.menus.registerMenus(ext.id, ext.manifest.contributes.menus);
            }
        }

        // 6. Fire onStartup
        await this.activation.fireOnStartup();

        // 7. Verify worker is alive
        const pong = await this.rpc.call("runtime/ping");
        if (pong !== "pong") {
            throw new Error("Extension host worker did not respond to ping");
        }
    }

    /** Install and optionally activate an extension. */
    async installExtension(
        manifest: import("../types").ExtensionManifest,
        source: string,
        activateNow = false,
    ): Promise<ExtensionInfo> {
        const info = await this.installer.install(manifest, source);
        this.activation.registerExtension(info);

        if (info.manifest.contributes?.menus) {
            this.menus.registerMenus(info.id, info.manifest.contributes.menus);
        }

        if (activateNow) {
            await this.activateExtension(info.id);
        }
        return info;
    }

    /** Uninstall an extension. */
    async uninstallExtension(id: string): Promise<void> {
        await this.deactivateExtension(id);
        this.commands.unregisterExtension(id);
        this.menus.unregisterExtension(id);
        this.activation.unregisterExtension(id);
        await this.installer.uninstall(id);
    }

    /** Manually activate an extension. */
    async activateExtension(id: string): Promise<void> {
        if (!this.rpc) throw new Error("Extension host not started");

        const info = this.installer.get(id);
        if (!info) throw new Error(`Extension not installed: ${id}`);

        this.installer.setStatus(id, "activating");

        try {
            const source = await this.installer.loadSource(id);
            if (!source) throw new Error(`Source not found for: ${id}`);

            await this.rpc.call("runtime/activate", [
                id,
                source,
                info.installPath,
            ]);

            this.installer.setStatus(id, "active");
        } catch (err) {
            this.installer.setStatus(
                id,
                "error",
                err instanceof Error ? err.message : String(err),
            );
            throw err;
        }
    }

    /** Deactivate an extension. */
    async deactivateExtension(id: string): Promise<void> {
        if (!this.rpc) return;

        const info = this.installer.get(id);
        if (!info || info.status !== "active") return;

        this.installer.setStatus(id, "deactivating");
        try {
            await this.rpc.call("runtime/deactivate", [id]);
            this.installer.setStatus(id, "inactive");
            this.activation.markDeactivated(id);
        } catch (err) {
            this.installer.setStatus(
                id,
                "error",
                err instanceof Error ? err.message : String(err),
            );
        }
    }

    // ─── Main-thread RPC handlers ────────────────────────────

    private registerMainThreadHandlers(): void {
        if (!this.rpc) return;

        // Commands: worker → main
        this.disposables.push(
            this.rpc.onRequest("commands/execute", async (command: unknown, ...args: unknown[]) => {
                return this.commands.execute(command as string, ...args);
            }),
        );

        this.rpc.onRequest("commands/list", async (filterInternal: unknown) => {
            return this.commands.getAll()
                .filter((c) => !filterInternal || !c.id.startsWith("_"))
                .map((c) => c.id);
        });

        // Worker registers a command → register on main thread too
        this.rpc.onRequest("commands/register", (command: unknown, extensionId: unknown) => {
            const cmdId = command as string;
            const extId = extensionId as string;
            // Register a proxy command that calls into the worker
            this.commands.register(
                cmdId,
                async (...args: unknown[]) => {
                    return this.rpc!.call("commands/invoke", [cmdId, ...args]);
                },
                { extensionId: extId },
            );
        });

        // Window messages
        this.disposables.push(
            this.rpc.onRequest(
                "window/showMessage",
                async (level: unknown, message: unknown, _items: unknown) => {
                    const msg = message as string;
                    // Default implementation — log to console.
                    // The real editor will override this with toast/dialog.
                    switch (level) {
                        case "error":
                            console.error(`[Extension] ${msg}`);
                            break;
                        case "warning":
                            console.warn(`[Extension] ${msg}`);
                            break;
                        default:
                            console.info(`[Extension] ${msg}`);
                    }
                    return undefined;
                },
            ),
        );

        // Logging
        this.rpc.onRequest(
            "window/log",
            (channel: unknown, level: unknown, message: unknown) => {
                const prefix = `[${channel}]`;
                switch (level) {
                    case "error":
                        console.error(prefix, message);
                        break;
                    case "warn":
                        console.warn(prefix, message);
                        break;
                    case "debug":
                        console.debug(prefix, message);
                        break;
                    default:
                        console.log(prefix, message);
                }
            },
        );

        // Memento persistence (simple in-memory for now, can be IDB later)
        const mementoStore = new Map<string, unknown>();
        this.rpc.onRequest(
            "memento/update",
            (prefix: unknown, key: unknown, value: unknown) => {
                mementoStore.set(`${prefix}:${key}`, value);
            },
        );
    }

    // ─── Disposal ────────────────────────────────────────────

    dispose(): void {
        for (const sub of this.disposables) {
            sub.dispose();
        }
        this.disposables = [];
        this.rpc?.dispose();
        this.worker?.terminate();
        this.worker = null;
        this.rpc = null;
        this.commands.dispose();
        this.menus.dispose();
        this.activation.dispose();
        this.installer.dispose();
    }
}
