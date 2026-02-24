/**
 * @module editor/plugins
 *
 * Public barrel export for the plugin system.
 */

// ── Core ─────────────────────────────────────────────────────
export { PluginHost } from "./PluginHost";
export { usePluginHost } from "./usePluginHost";

// ── Types ────────────────────────────────────────────────────
export type {
    ExtendedEditorPlugin,
    ExtendedPluginAPI,
    PluginHostState,
    InlineDecoration,
    GutterDecoration,
    CodeLensItem,
    InlineAnnotation,
    CompletionItem,
    CompletionProvider,
    CompletionContext,
    Diagnostic,
    DiagnosticFix,
    PanelDescriptor,
    DiffHunk,
} from "./types";

// ── Built-in plugins ─────────────────────────────────────────
export {
    createAllBuiltinPlugins,
    createAutoCompletionPlugin,
    createMarkdownPreviewPlugin,
    createJsonSchemaValidationPlugin,
    createYamlSchemaValidationPlugin,
    createIntelliSensePlugin,
    createCodeLensPlugin,
    createInlineAnnotationsPlugin,
    createAiSuitePlugin,
    createDiffViewerPlugin,
    createFileMetadataPlugin,
    createAutoDetectIndentPlugin,
    createFocusModePlugin,
    DemoAiAdapter,
    type AiAdapter,
} from "./builtin";

// ── UI Components ────────────────────────────────────────────
export { PluginPanelRenderer } from "./components/PluginPanelRenderer";
export { PluginStatusBar } from "./components/PluginStatusBar";

export { CompletionWidget } from "./components/CompletionWidget";
export { CodeLensOverlay } from "./components/CodeLensOverlay";
export { InlineAnnotationsOverlay } from "./components/InlineAnnotationsOverlay";
export { DiagnosticsOverlay } from "./components/DiagnosticsOverlay";
