/**
 * @module monaco-editor/core/plugin-registry
 *
 * Global plugin registry — singleton that manages plugin registration,
 * enabling/disabling, and lifecycle notifications.
 *
 * Usage:
 *   import { pluginRegistry } from "@/modules/monaco-editor";
 *
 *   pluginRegistry.register(myPlugin);
 *   pluginRegistry.enable("my-plugin");
 *   pluginRegistry.unregister("my-plugin");
 */

import type {
  MonacoPlugin,
  PluginRegistryEvent,
  PluginRegistryListener,
} from "../types";

interface PluginEntry {
  plugin: MonacoPlugin;
  enabled: boolean;
}

class PluginRegistry {
  private plugins = new Map<string, PluginEntry>();
  private listeners = new Set<PluginRegistryListener>();

  // ── Registration ────────────────────────────────────────────

  /**
   * Register a plugin. If a plugin with the same ID already exists,
   * it is replaced (the old one is unregistered first).
   */
  register(plugin: MonacoPlugin): void {
    if (this.plugins.has(plugin.id)) {
      this.unregister(plugin.id);
    }

    this.plugins.set(plugin.id, {
      plugin,
      enabled: plugin.defaultEnabled !== false,
    });

    this.emit({ type: "registered", pluginId: plugin.id });
  }

  /**
   * Register multiple plugins at once.
   */
  registerAll(plugins: MonacoPlugin[]): void {
    for (const plugin of plugins) {
      this.register(plugin);
    }
  }

  /**
   * Unregister a plugin by ID.
   */
  unregister(pluginId: string): void {
    const entry = this.plugins.get(pluginId);
    if (!entry) return;

    try {
      entry.plugin.onDispose?.();
    } catch {
      // Swallow disposal errors
    }

    this.plugins.delete(pluginId);
    this.emit({ type: "unregistered", pluginId });
  }

  /**
   * Unregister all plugins.
   */
  clear(): void {
    for (const [id] of this.plugins) {
      this.unregister(id);
    }
  }

  // ── Enable / Disable ───────────────────────────────────────

  enable(pluginId: string): void {
    const entry = this.plugins.get(pluginId);
    if (!entry || entry.enabled) return;
    entry.enabled = true;
    this.emit({ type: "enabled", pluginId });
  }

  disable(pluginId: string): void {
    const entry = this.plugins.get(pluginId);
    if (!entry || !entry.enabled) return;
    entry.enabled = false;
    this.emit({ type: "disabled", pluginId });
  }

  toggle(pluginId: string): boolean {
    const entry = this.plugins.get(pluginId);
    if (!entry) return false;
    entry.enabled = !entry.enabled;
    this.emit({
      type: entry.enabled ? "enabled" : "disabled",
      pluginId,
    });
    return entry.enabled;
  }

  isEnabled(pluginId: string): boolean {
    return this.plugins.get(pluginId)?.enabled ?? false;
  }

  // ── Queries ────────────────────────────────────────────────

  get(pluginId: string): MonacoPlugin | undefined {
    return this.plugins.get(pluginId)?.plugin;
  }

  has(pluginId: string): boolean {
    return this.plugins.has(pluginId);
  }

  /** Returns all registered plugins (enabled + disabled) */
  getAll(): MonacoPlugin[] {
    return Array.from(this.plugins.values()).map((e) => e.plugin);
  }

  /** Returns only enabled plugins, sorted by priority (desc) */
  getEnabled(): MonacoPlugin[] {
    return Array.from(this.plugins.values())
      .filter((e) => e.enabled)
      .sort((a, b) => (b.plugin.priority ?? 0) - (a.plugin.priority ?? 0))
      .map((e) => e.plugin);
  }

  /** Returns only disabled plugins */
  getDisabled(): MonacoPlugin[] {
    return Array.from(this.plugins.values())
      .filter((e) => !e.enabled)
      .map((e) => e.plugin);
  }

  /** Returns a snapshot of all plugin states */
  getSnapshot(): Array<{ id: string; name: string; enabled: boolean; version: string }> {
    return Array.from(this.plugins.values()).map((e) => ({
      id: e.plugin.id,
      name: e.plugin.name,
      enabled: e.enabled,
      version: e.plugin.version,
    }));
  }

  // ── Event system ───────────────────────────────────────────

  subscribe(listener: PluginRegistryListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: PluginRegistryEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // Swallow listener errors to prevent cascade
      }
    }
  }

  // ── Dependency resolution ──────────────────────────────────

  /**
   * Validate that all plugin dependencies are satisfied.
   * Returns an array of error messages (empty = all OK).
   */
  validateDependencies(): string[] {
    const errors: string[] = [];
    for (const entry of this.plugins.values()) {
      const deps = entry.plugin.dependencies ?? [];
      for (const dep of deps) {
        if (!this.plugins.has(dep)) {
          errors.push(
            `Plugin "${entry.plugin.id}" depends on "${dep}" which is not registered.`,
          );
        }
      }
    }
    return errors;
  }
}

/** Singleton plugin registry */
export const pluginRegistry = new PluginRegistry();
