/**
 * @module monaco-editor/utils/create-plugin
 *
 * Helper factory for creating plugins with sensible defaults.
 *
 * Usage:
 *   const myPlugin = createPlugin({
 *     id: "my-plugin",
 *     name: "My Plugin",
 *     onMount(ctx) { ... },
 *   });
 */

import type { MonacoPlugin, BasePluginOptions, Monaco, PluginContext } from "../types";

type PluginHooks = {
  onBeforeMount?: (monaco: Monaco) => void | Promise<void>;
  onMount?: (context: PluginContext) => void | Promise<void>;
  onLanguageChange?: (language: string, context: PluginContext) => void;
  onContentChange?: (content: string, context: PluginContext) => void;
  onDispose?: () => void;
};

/**
 * Factory function for creating a MonacoPlugin with defaults.
 */
export function createPlugin(
  options: BasePluginOptions & PluginHooks,
): MonacoPlugin {
  return {
    id: options.id,
    name: options.name,
    version: options.version ?? "1.0.0",
    description: options.description,
    dependencies: options.dependencies,
    priority: options.priority ?? 0,
    defaultEnabled: options.defaultEnabled ?? true,
    onBeforeMount: options.onBeforeMount,
    onMount: options.onMount,
    onLanguageChange: options.onLanguageChange,
    onContentChange: options.onContentChange,
    onDispose: options.onDispose,
  };
}
