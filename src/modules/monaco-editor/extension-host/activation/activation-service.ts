/**
 * @module extension-host/activation/activation-service
 *
 * Manages extension activation via activation events.
 * Extensions are lazily activated when a matching event fires.
 */

import type {
    ActivationEvent,
    Disposable,
    ExtensionHostEvent,
    ExtensionHostEventListener,
    ExtensionInfo,
} from "../types";

/** Callback to activate an extension by id. Returns a promise that resolves when done. */
export type ActivateExtensionFn = (extensionId: string) => Promise<void>;

export class ActivationService implements Disposable {
    /** Map from activation event → set of extension IDs that want it. */
    private eventToExtensions = new Map<string, Set<string>>();
    /** Extensions already activated (avoid double activation). */
    private activated = new Set<string>();
    private listeners = new Set<ExtensionHostEventListener>();

    constructor(private activateFn: ActivateExtensionFn) {}

    /** Register an extension's activation events. */
    registerExtension(ext: ExtensionInfo): void {
        const events = ext.manifest.activationEvents ?? [];
        for (const event of events) {
            if (!this.eventToExtensions.has(event)) {
                this.eventToExtensions.set(event, new Set());
            }
            this.eventToExtensions.get(event)!.add(ext.id);
        }
    }

    /** Unregister an extension (on uninstall). */
    unregisterExtension(extensionId: string): void {
        for (const [, ids] of this.eventToExtensions) {
            ids.delete(extensionId);
        }
        this.activated.delete(extensionId);
    }

    /** Fire an activation event. Activates all matching extensions. */
    async fireEvent(event: ActivationEvent): Promise<void> {
        const toActivate = this.collectExtensions(event);
        await Promise.allSettled(
            toActivate.map((id) => this.activateIfNeeded(id)),
        );
    }

    /** Fire onStartup — activates extensions with `onStartup` or `*`. */
    async fireOnStartup(): Promise<void> {
        await this.fireEvent("onStartup");
        await this.fireEvent("*");
    }

    /** Fire onCommand:<command>. */
    async fireOnCommand(command: string): Promise<void> {
        await this.fireEvent(`onCommand:${command}`);
    }

    /** Fire onLanguage:<languageId>. */
    async fireOnLanguage(languageId: string): Promise<void> {
        await this.fireEvent(`onLanguage:${languageId}`);
    }

    /** Fire onFileOpen. */
    async fireOnFileOpen(): Promise<void> {
        await this.fireEvent("onFileOpen");
    }

    /** Check if an extension has been activated. */
    isActivated(extensionId: string): boolean {
        return this.activated.has(extensionId);
    }

    /** Mark extension as deactivated (called after deactivation). */
    markDeactivated(extensionId: string): void {
        this.activated.delete(extensionId);
    }

    onEvent(listener: ExtensionHostEventListener): Disposable {
        this.listeners.add(listener);
        return { dispose: () => this.listeners.delete(listener) };
    }

    // ─── Internal ────────────────────────────────────────────

    private collectExtensions(event: string): string[] {
        const ids = new Set<string>();

        // Exact match
        const exact = this.eventToExtensions.get(event);
        if (exact) for (const id of exact) ids.add(id);

        return [...ids];
    }

    private async activateIfNeeded(extensionId: string): Promise<void> {
        if (this.activated.has(extensionId)) return;
        this.activated.add(extensionId);

        try {
            await this.activateFn(extensionId);
            this.emit({ type: "extension:activated", extensionId });
        } catch (err) {
            this.activated.delete(extensionId);
            this.emit({
                type: "extension:error",
                extensionId,
                error: err instanceof Error ? err.message : String(err),
            });
        }
    }

    private emit(event: ExtensionHostEvent): void {
        for (const listener of this.listeners) {
            try {
                listener(event);
            } catch (err) {
                console.error(
                    "[ActivationService] Event listener error:",
                    err,
                );
            }
        }
    }

    dispose(): void {
        this.eventToExtensions.clear();
        this.activated.clear();
        this.listeners.clear();
    }
}
