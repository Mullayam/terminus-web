/**
 * @module monaco-editor/plugins
 * Barrel export for all built-in plugins.
 *
 * Usage:
 *   import { saveStatePlugin, todoHighlightPlugin, ALL_BUILTIN_PLUGINS } from "@/modules/monaco-editor";
 */

export { saveStatePlugin } from "./save-state-plugin";
export { bracketColorizerPlugin } from "./bracket-colorizer-plugin";
export { wordHighlightPlugin } from "./word-highlight-plugin";
export { todoHighlightPlugin } from "./todo-highlight-plugin";
export { minimapColorsPlugin } from "./minimap-colors-plugin";
export { vscodeClipboardPlugin } from "./vscode-clipboard-plugin";

// Convenience array of all built-in plugins
import { saveStatePlugin } from "./save-state-plugin";
import { bracketColorizerPlugin } from "./bracket-colorizer-plugin";
import { wordHighlightPlugin } from "./word-highlight-plugin";
import { todoHighlightPlugin } from "./todo-highlight-plugin";
import { minimapColorsPlugin } from "./minimap-colors-plugin";
import { vscodeClipboardPlugin } from "./vscode-clipboard-plugin";

export const ALL_BUILTIN_PLUGINS = [
  vscodeClipboardPlugin,
  saveStatePlugin,
  bracketColorizerPlugin,
  wordHighlightPlugin,
  todoHighlightPlugin,
  minimapColorsPlugin,
];
