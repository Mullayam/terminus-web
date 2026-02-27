/**
 * @module monaco-editor/core
 * Barrel export for core utilities.
 */

export { pluginRegistry } from "./plugin-registry";
export { createPluginContext } from "./plugin-context";
export { EventBus } from "./event-bus";
export {
  registerTheme,
  registerThemes,
  getTheme,
  getAllThemes,
  hasTheme,
} from "./theme-registry";
export {
  registerLanguage,
  registerLanguages,
  isLanguageRegistered,
} from "./language-registry";
