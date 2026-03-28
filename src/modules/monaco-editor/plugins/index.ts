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
export { createGhostTextPlugin } from "./ghost-text-plugin";
export type { GhostTextPluginOptions } from "./ghost-text-plugin";
export { createNotificationPlugin, setNotificationsHandle, getNotificationsHandle, showEditorNotification, NOTIFICATION_EVENTS } from "./notification-plugin";
export type { NotificationPluginOptions, BackendNotification, BackendNotificationUpdate } from "./notification-plugin";
export { createInlineCommandPlugin } from "./inline-command-plugin";
export type { InlineCommandPluginOptions } from "./inline-command-plugin";

// New plugins
export { breadcrumbsPlugin } from "./breadcrumbs-plugin";
export { focusModePlugin } from "./focus-mode-plugin";
export { autoIndentDetectPlugin } from "./auto-indent-detect-plugin";
export { markdownPreviewPlugin } from "./markdown-preview-plugin";
export { jsonSchemaPlugin } from "./json-schema-plugin";
export { fileMetadataPlugin } from "./file-metadata-plugin";
export { colorPickerPlugin } from "./color-picker-plugin";
export { gitDiffGutterPlugin } from "./git-diff-gutter-plugin";
export { emmetPlugin } from "./emmet-plugin";
export { linkedEditingPlugin } from "./linked-editing-plugin";
export { diagnosticsBridgePlugin } from "./diagnostics-bridge-plugin";
export type { DiagnosticsSummary } from "./diagnostics-bridge-plugin";
export { snippetManagerPlugin } from "./snippet-manager-plugin";
export { minimapSearchPlugin } from "./minimap-search-plugin";
export { foldingRegionsPlugin } from "./folding-regions-plugin";
export { imagePreviewPlugin } from "./image-preview-plugin";

// Convenience array of all built-in plugins
import { saveStatePlugin } from "./save-state-plugin";
import { bracketColorizerPlugin } from "./bracket-colorizer-plugin";
import { wordHighlightPlugin } from "./word-highlight-plugin";
import { todoHighlightPlugin } from "./todo-highlight-plugin";
import { minimapColorsPlugin } from "./minimap-colors-plugin";
import { vscodeClipboardPlugin } from "./vscode-clipboard-plugin";
import { breadcrumbsPlugin } from "./breadcrumbs-plugin";
import { focusModePlugin } from "./focus-mode-plugin";
import { autoIndentDetectPlugin } from "./auto-indent-detect-plugin";
import { markdownPreviewPlugin } from "./markdown-preview-plugin";
import { jsonSchemaPlugin } from "./json-schema-plugin";
import { fileMetadataPlugin } from "./file-metadata-plugin";
import { colorPickerPlugin } from "./color-picker-plugin";
import { gitDiffGutterPlugin } from "./git-diff-gutter-plugin";
import { emmetPlugin } from "./emmet-plugin";
import { linkedEditingPlugin } from "./linked-editing-plugin";
import { diagnosticsBridgePlugin } from "./diagnostics-bridge-plugin";
import { snippetManagerPlugin } from "./snippet-manager-plugin";
import { minimapSearchPlugin } from "./minimap-search-plugin";
import { foldingRegionsPlugin } from "./folding-regions-plugin";
import { imagePreviewPlugin } from "./image-preview-plugin";

export const ALL_BUILTIN_PLUGINS = [
  vscodeClipboardPlugin,
  saveStatePlugin,
  bracketColorizerPlugin,
  wordHighlightPlugin,
  todoHighlightPlugin,
  minimapColorsPlugin,
  breadcrumbsPlugin,
  focusModePlugin,
  autoIndentDetectPlugin,
  markdownPreviewPlugin,
  jsonSchemaPlugin,
  fileMetadataPlugin,
  colorPickerPlugin,
  gitDiffGutterPlugin,
  emmetPlugin,
  linkedEditingPlugin,
  diagnosticsBridgePlugin,
  snippetManagerPlugin,
  minimapSearchPlugin,
  foldingRegionsPlugin,
  imagePreviewPlugin,
];
