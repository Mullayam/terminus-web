/**
 * @module monaco-editor/view-panel/api
 *
 * Public API for creating / managing view panels.
 * Plugins and commands call these functions to open React components as editor tabs.
 */
import { useViewPanelStore } from "./store";
import type { ViewPanelDescriptor } from "./types";

/**
 * Register a view panel so it can be opened later.
 * Typically called once during plugin initialization.
 */
export function registerViewPanel(descriptor: ViewPanelDescriptor): void {
  useViewPanelStore.getState().registerPanel(descriptor);
}

/**
 * Unregister a previously registered view panel.
 * Also closes any open tabs for it.
 */
export function unregisterViewPanel(id: string): void {
  useViewPanelStore.getState().unregisterPanel(id);
}

/**
 * Open a view panel as a tab in the editor area.
 * If the panel is singleton and already open, it simply focuses the existing tab.
 *
 * @returns The tab instance ID (or "" if the panel is not registered).
 *
 * @example
 * ```ts
 * // In a plugin's onMount:
 * registerViewPanel({
 *   id: "npm-manager",
 *   title: "NPM Packages",
 *   component: NpmManagerPanel,
 *   singleton: true,
 * });
 *
 * // Later (command palette, sidebar button, etc.):
 * openViewPanel("npm-manager");
 * ```
 */
export function openViewPanel(id: string, props?: Record<string, unknown>): string {
  return useViewPanelStore.getState().openPanel(id, props);
}

/**
 * Close a view panel tab by its instance ID.
 */
export function closeViewPanel(tabId: string): void {
  useViewPanelStore.getState().closePanel(tabId);
}

/**
 * Close all open view panel tabs.
 */
export function closeAllViewPanels(): void {
  useViewPanelStore.getState().closeAll();
}

/**
 * Get all registered view panel descriptors.
 */
export function getRegisteredViewPanels(): ViewPanelDescriptor[] {
  return Array.from(useViewPanelStore.getState().registry.values());
}
