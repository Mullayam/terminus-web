/**
 * @module extension-host/commands/command-registry
 *
 * Central command registry — extensions register commands here,
 * the command palette and context menus query it.
 */

import type {
    Disposable,
    ExtensionHostEvent,
    ExtensionHostEventListener,
    RegisteredCommand,
} from "../types";

export class CommandRegistry implements Disposable {
    private commands = new Map<string, RegisteredCommand>();
    private listeners = new Set<ExtensionHostEventListener>();

    /** Register a command. Overwrites if same id exists. */
    register(
        id: string,
        handler: (...args: unknown[]) => unknown | Promise<unknown>,
        meta?: { title?: string; category?: string; extensionId?: string },
    ): Disposable {
        const cmd: RegisteredCommand = {
            id,
            title: meta?.title ?? id,
            category: meta?.category,
            extensionId: meta?.extensionId,
            handler,
        };
        this.commands.set(id, cmd);
        this.emit({ type: "command:registered", commandId: id });

        return {
            dispose: () => {
                if (this.commands.get(id) === cmd) {
                    this.commands.delete(id);
                }
            },
        };
    }

    /** Execute a command by id. */
    async execute(id: string, ...args: unknown[]): Promise<unknown> {
        const cmd = this.commands.get(id);
        if (!cmd) {
            throw new Error(`Command not found: ${id}`);
        }
        const result = await cmd.handler(...args);
        this.emit({ type: "command:executed", commandId: id });
        return result;
    }

    /** Check if a command is registered. */
    has(id: string): boolean {
        return this.commands.has(id);
    }

    /** Get metadata for a registered command. */
    get(id: string): RegisteredCommand | undefined {
        return this.commands.get(id);
    }

    /** List all registered commands (for the palette). */
    getAll(): RegisteredCommand[] {
        return [...this.commands.values()];
    }

    /** List commands from a specific extension. */
    getByExtension(extensionId: string): RegisteredCommand[] {
        return [...this.commands.values()].filter(
            (c) => c.extensionId === extensionId,
        );
    }

    /** Unregister all commands from a specific extension. */
    unregisterExtension(extensionId: string): void {
        for (const [id, cmd] of this.commands) {
            if (cmd.extensionId === extensionId) {
                this.commands.delete(id);
            }
        }
    }

    /** Subscribe to command events. */
    onEvent(listener: ExtensionHostEventListener): Disposable {
        this.listeners.add(listener);
        return {
            dispose: () => {
                this.listeners.delete(listener);
            },
        };
    }

    private emit(event: ExtensionHostEvent): void {
        for (const listener of this.listeners) {
            try {
                listener(event);
            } catch (err) {
                console.error("[CommandRegistry] Event listener error:", err);
            }
        }
    }

    dispose(): void {
        this.commands.clear();
        this.listeners.clear();
    }
}
