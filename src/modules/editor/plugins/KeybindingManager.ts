/**
 * @module editor/plugins/KeybindingManager
 *
 * Conflict-aware keybinding manager for plugins.
 * Detects and resolves conflicts between plugin keybindings,
 * supports user customization, and provides a registry.
 *
 * Features:
 *   - Register / unregister keybindings per-plugin
 *   - Detect conflicts (same key combo, same context)
 *   - User overrides stored in localStorage
 *   - Priority-based resolution (user > later > earlier)
 */
import type { KeyBinding } from "../types";

// ═══════════════════════════════════════════════════════════════
//  TYPES
// ═══════════════════════════════════════════════════════════════

export interface KeybindingEntry {
    pluginId: string;
    binding: KeyBinding;
    /** Whether this binding has a conflict with another */
    hasConflict: boolean;
    /** Whether the user has overridden this binding */
    isUserOverride: boolean;
    /** Whether this binding is currently active (wins conflict) */
    active: boolean;
}

export interface KeybindingConflict {
    keys: string;
    when: string;
    entries: KeybindingEntry[];
}

export interface UserKeybindingOverride {
    bindingId: string;
    newKeys: string | null; // null = disabled
}

type KBListener = () => void;

const STORAGE_KEY = "editor-plugin-keybinding-overrides";

// ═══════════════════════════════════════════════════════════════
//  NORMALIZE KEY COMBO
// ═══════════════════════════════════════════════════════════════

/** Normalize a key combo string for comparison: "ctrl+shift+s" => "Ctrl+S+Shift" */
export function normalizeKeys(keys: string): string {
    return keys
        .split("+")
        .map((k) => k.trim().toLowerCase())
        .sort()
        .map((k) => k.charAt(0).toUpperCase() + k.slice(1))
        .join("+");
}

/** Check if a keyboard event matches a normalized key combo */
export function matchesKeyEvent(normalizedKeys: string, e: KeyboardEvent): boolean {
    const parts: string[] = [];
    if (e.ctrlKey || e.metaKey) parts.push("ctrl");
    if (e.shiftKey) parts.push("shift");
    if (e.altKey) parts.push("alt");

    let key = e.key.toLowerCase();
    // Normalize common key names
    if (key === "escape") key = "escape";
    else if (key === " ") key = "space";
    else if (key === "arrowright") key = "arrowright";
    else if (key === "arrowleft") key = "arrowleft";
    else if (key === "arrowup") key = "arrowup";
    else if (key === "arrowdown") key = "arrowdown";
    else if (key === "enter") key = "enter";
    else if (key === "backspace") key = "backspace";
    else if (key === "delete") key = "delete";
    else if (key === "tab") key = "tab";

    // Don't double-add modifier keys
    if (!["control", "shift", "alt", "meta"].includes(key)) {
        parts.push(key);
    }

    const eventNorm = parts
        .sort()
        .map((k) => k.charAt(0).toUpperCase() + k.slice(1))
        .join("+");

    return eventNorm === normalizedKeys;
}

// ═══════════════════════════════════════════════════════════════
//  KEYBINDING MANAGER
// ═══════════════════════════════════════════════════════════════

export class KeybindingManager {
    /** All registered bindings: Map<pluginId, KeyBinding[]> */
    private bindings = new Map<string, KeyBinding[]>();
    /** User overrides: Map<bindingId, newKeys | null> */
    private overrides = new Map<string, string | null>();
    /** Listeners for state changes */
    private listeners = new Set<KBListener>();

    constructor() {
        this.loadOverrides();
    }

    // ── Registration ─────────────────────────────────────────

    registerPluginBindings(pluginId: string, bindings: KeyBinding[]): void {
        this.bindings.set(pluginId, [...bindings]);
        this.emit();
    }

    unregisterPluginBindings(pluginId: string): void {
        this.bindings.delete(pluginId);
        this.emit();
    }

    // ── User overrides ───────────────────────────────────────

    setUserOverride(bindingId: string, newKeys: string | null): void {
        this.overrides.set(bindingId, newKeys);
        this.saveOverrides();
        this.emit();
    }

    removeUserOverride(bindingId: string): void {
        this.overrides.delete(bindingId);
        this.saveOverrides();
        this.emit();
    }

    resetAllOverrides(): void {
        this.overrides.clear();
        this.saveOverrides();
        this.emit();
    }

    // ── Query ────────────────────────────────────────────────

    /** Get all entries, resolved with conflicts and overrides */
    getAllEntries(): KeybindingEntry[] {
        const entries: KeybindingEntry[] = [];

        for (const [pluginId, bindings] of this.bindings) {
            for (const binding of bindings) {
                const override = this.overrides.get(binding.id);
                const effectiveKeys = override !== undefined
                    ? (override ?? binding.keys) // null override = disabled (keep original for display)
                    : binding.keys;
                const isDisabled = override === null;

                entries.push({
                    pluginId,
                    binding: { ...binding, keys: effectiveKeys },
                    hasConflict: false,
                    isUserOverride: override !== undefined,
                    active: !isDisabled,
                });
            }
        }

        // Detect conflicts
        const keyMap = new Map<string, KeybindingEntry[]>();
        for (const entry of entries) {
            if (!entry.active) continue;
            const norm = normalizeKeys(entry.binding.keys);
            const ctx = entry.binding.when ?? "editor";
            const key = `${norm}::${ctx}`;
            if (!keyMap.has(key)) keyMap.set(key, []);
            keyMap.get(key)!.push(entry);
        }

        for (const [, group] of keyMap) {
            if (group.length > 1) {
                group.forEach((e) => { e.hasConflict = true; });
                // Last registered wins (can be overridden by user)
                for (let i = 0; i < group.length - 1; i++) {
                    group[i].active = false;
                }
            }
        }

        return entries;
    }

    /** Get conflicts only */
    getConflicts(): KeybindingConflict[] {
        const entries = this.getAllEntries();
        const keyMap = new Map<string, KeybindingEntry[]>();

        for (const entry of entries) {
            if (!entry.active && !entry.hasConflict) continue;
            const norm = normalizeKeys(entry.binding.keys);
            const ctx = entry.binding.when ?? "editor";
            const key = `${norm}::${ctx}`;
            if (!keyMap.has(key)) keyMap.set(key, []);
            keyMap.get(key)!.push(entry);
        }

        const conflicts: KeybindingConflict[] = [];
        for (const [key, group] of keyMap) {
            if (group.length > 1) {
                const [keys, when] = key.split("::");
                conflicts.push({ keys, when, entries: group });
            }
        }
        return conflicts;
    }

    /** Get the active handler for a key event */
    getHandler(e: KeyboardEvent, context: "editor" | "find" | "always" = "editor"): ((e: KeyboardEvent | React.KeyboardEvent) => void) | null {
        const entries = this.getAllEntries().filter((en) => en.active);

        for (let i = entries.length - 1; i >= 0; i--) {
            const entry = entries[i];
            const when = entry.binding.when ?? "editor";
            if (when !== "always" && when !== context) continue;

            const norm = normalizeKeys(entry.binding.keys);
            if (matchesKeyEvent(norm, e)) {
                return entry.binding.handler;
            }
        }
        return null;
    }

    // ── Subscription ─────────────────────────────────────────

    subscribe(listener: KBListener): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private emit(): void {
        this.listeners.forEach((l) => l());
    }

    // ── Persistence ──────────────────────────────────────────

    private loadOverrides(): void {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const arr: UserKeybindingOverride[] = JSON.parse(raw);
                for (const o of arr) {
                    this.overrides.set(o.bindingId, o.newKeys);
                }
            }
        } catch {
            // ignore
        }
    }

    private saveOverrides(): void {
        try {
            const arr: UserKeybindingOverride[] = [];
            for (const [bindingId, newKeys] of this.overrides) {
                arr.push({ bindingId, newKeys });
            }
            localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
        } catch {
            // ignore
        }
    }

    // ── Cleanup ──────────────────────────────────────────────

    destroy(): void {
        this.bindings.clear();
        this.listeners.clear();
    }
}
