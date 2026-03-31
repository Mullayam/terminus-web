/**
 * @module extension-host/menus/menu-registry
 *
 * Menu contribution system. Extensions declare menu items in their manifest,
 * and this registry resolves them at runtime with `when` clause evaluation.
 */

import type {
    ContributedMenuItem,
    Disposable,
    ExtensionHostEvent,
    ExtensionHostEventListener,
    MenuLocation,
    ResolvedMenuItem,
} from "../types";
import type { CommandRegistry } from "../commands/command-registry";

/** Context keys used for `when` clause evaluation. */
export interface MenuContext {
    /** Active file language ID. */
    editorLangId?: string;
    /** Whether a file is open. */
    editorIsOpen?: boolean;
    /** Path of the focused explorer item. */
    explorerResourcePath?: string;
    /** Custom context keys from extensions. */
    [key: string]: unknown;
}

interface MenuEntry {
    extensionId: string;
    location: MenuLocation;
    item: ContributedMenuItem;
}

export class MenuRegistry implements Disposable {
    private entries: MenuEntry[] = [];
    private listeners = new Set<ExtensionHostEventListener>();

    constructor(private commandRegistry: CommandRegistry) {}

    /** Register menu contributions from an extension manifest. */
    registerMenus(
        extensionId: string,
        menus: Partial<Record<MenuLocation, ContributedMenuItem[]>>,
    ): Disposable {
        const newEntries: MenuEntry[] = [];

        for (const [loc, items] of Object.entries(menus)) {
            if (!items) continue;
            for (const item of items) {
                const entry: MenuEntry = {
                    extensionId,
                    location: loc as MenuLocation,
                    item,
                };
                newEntries.push(entry);
                this.entries.push(entry);
            }
        }

        for (const loc of new Set(newEntries.map((e) => e.location))) {
            this.emit({ type: "menu:changed", location: loc });
        }

        return {
            dispose: () => {
                this.unregisterExtension(extensionId);
            },
        };
    }

    /** Get resolved menu items for a specific location, filtered by context. */
    getMenuItems(
        location: MenuLocation,
        context: MenuContext = {},
    ): ResolvedMenuItem[] {
        const result: ResolvedMenuItem[] = [];

        for (const entry of this.entries) {
            if (entry.location !== location) continue;
            if (entry.item.when && !evaluateWhen(entry.item.when, context))
                continue;

            const cmd = this.commandRegistry.get(entry.item.command);
            if (!cmd) continue;

            result.push({
                command: entry.item.command,
                title: cmd.title,
                category: cmd.category,
                group: entry.item.group,
                when: entry.item.when,
                extensionId: entry.extensionId,
            });
        }

        // Sort by group then title
        result.sort((a, b) => {
            const ga = a.group ?? "";
            const gb = b.group ?? "";
            if (ga !== gb) return ga.localeCompare(gb);
            return a.title.localeCompare(b.title);
        });

        return result;
    }

    /** Remove all menu contributions from an extension. */
    unregisterExtension(extensionId: string): void {
        const locations = new Set<MenuLocation>();
        this.entries = this.entries.filter((e) => {
            if (e.extensionId === extensionId) {
                locations.add(e.location);
                return false;
            }
            return true;
        });
        for (const loc of locations) {
            this.emit({ type: "menu:changed", location: loc });
        }
    }

    onEvent(listener: ExtensionHostEventListener): Disposable {
        this.listeners.add(listener);
        return { dispose: () => this.listeners.delete(listener) };
    }

    private emit(event: ExtensionHostEvent): void {
        for (const listener of this.listeners) {
            try {
                listener(event);
            } catch (err) {
                console.error("[MenuRegistry] Event listener error:", err);
            }
        }
    }

    dispose(): void {
        this.entries = [];
        this.listeners.clear();
    }
}

// ─── Simple `when` clause evaluator ─────────────────────────

/**
 * Evaluates a simplified `when` clause.
 * Supports: `key`, `key == value`, `key != value`, `!key`, `a && b`
 * Does NOT support `||` or nested parens (keep it simple for now).
 */
function evaluateWhen(when: string, context: MenuContext): boolean {
    const parts = when.split("&&").map((s) => s.trim());
    return parts.every((part) => evaluateCondition(part, context));
}

function evaluateCondition(expr: string, context: MenuContext): boolean {
    // Negation: !key
    if (expr.startsWith("!")) {
        return !context[expr.slice(1).trim()];
    }

    // Equality: key == value
    if (expr.includes("==")) {
        const [key, val] = expr.split("==").map((s) => s.trim());
        const ctxVal = String(context[key] ?? "");
        return ctxVal === unquote(val);
    }

    // Inequality: key != value
    if (expr.includes("!=")) {
        const [key, val] = expr.split("!=").map((s) => s.trim());
        const ctxVal = String(context[key] ?? "");
        return ctxVal !== unquote(val);
    }

    // Truthy check: key
    return !!context[expr];
}

function unquote(s: string): string {
    if ((s.startsWith("'") && s.endsWith("'")) || (s.startsWith('"') && s.endsWith('"'))) {
        return s.slice(1, -1);
    }
    return s;
}
