/**
 * @module editor/plugins/builtin
 *
 * Barrel export for all built-in plugins.
 * Each plugin is a factory function that returns an ExtendedEditorPlugin.
 */
export { createAutoCompletionPlugin } from "./auto-completion";
export { createMarkdownPreviewPlugin } from "./markdown-preview";
export { createJsonSchemaValidationPlugin } from "./json-schema-validation";
export { createYamlSchemaValidationPlugin } from "./yaml-schema-validation";
export { createIntelliSensePlugin } from "./intellisense";
export { createCodeLensPlugin } from "./codelens";
export { createInlineAnnotationsPlugin } from "./inline-annotations";
export { createAiSuitePlugin, DemoAiAdapter, type AiAdapter } from "./ai-suite";
export { createDiffViewerPlugin } from "./diff-viewer";
export { createFileMetadataPlugin } from "./file-metadata";
export { createAutoDetectIndentPlugin } from "./auto-detect-indent";
export { createFocusModePlugin } from "./focus-mode";
export { createAiGhostTextPlugin, ghostTextStore } from "./ai-ghost-text";
export type { GhostTextState } from "./ai-ghost-text";

// ── Convenience: create all built-in plugins at once ─────────

import { createAutoCompletionPlugin } from "./auto-completion";
import { createMarkdownPreviewPlugin } from "./markdown-preview";
import { createJsonSchemaValidationPlugin } from "./json-schema-validation";
import { createYamlSchemaValidationPlugin } from "./yaml-schema-validation";
import { createIntelliSensePlugin } from "./intellisense";
import { createCodeLensPlugin } from "./codelens";
import { createInlineAnnotationsPlugin } from "./inline-annotations";
import { createAiSuitePlugin } from "./ai-suite";
import { createDiffViewerPlugin } from "./diff-viewer";
import { createFileMetadataPlugin } from "./file-metadata";
import { createAutoDetectIndentPlugin } from "./auto-detect-indent";
import { createFocusModePlugin } from "./focus-mode";
import { createAiGhostTextPlugin } from "./ai-ghost-text";
import type { ExtendedEditorPlugin } from "../types";

/**
 * Create all built-in plugins with default configuration.
 * Pass to <FileEditor plugins={createAllBuiltinPlugins()} />
 */
export function createAllBuiltinPlugins(): ExtendedEditorPlugin[] {
    return [
        createAutoCompletionPlugin(),
        createMarkdownPreviewPlugin(),
        createJsonSchemaValidationPlugin(),
        createYamlSchemaValidationPlugin(),
        createIntelliSensePlugin(),
        createCodeLensPlugin(),
        createInlineAnnotationsPlugin(),
        createAiSuitePlugin(),
        createDiffViewerPlugin(),
        createFileMetadataPlugin(),
        createAutoDetectIndentPlugin(),
        createFocusModePlugin(),
        createAiGhostTextPlugin(),
    ];
}
