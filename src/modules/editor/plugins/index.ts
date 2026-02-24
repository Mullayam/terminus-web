/**
 * @module editor/plugins
 *
 * Public barrel export for the plugin system.
 */

// ── Core ─────────────────────────────────────────────────────
export { PluginHost } from "./PluginHost";
export { usePluginHost } from "./usePluginHost";

// ── Plugin helpers (for custom plugin creation) ──────────────
export { definePlugin, mergePlugins, checkPlugin } from "./definePlugin";
export { validatePlugin, validatePlugins, logValidationResults } from "./validatePlugin";
export type { PluginValidationResult, PluginValidationIssue } from "./validatePlugin";

// ── AI Provider ──────────────────────────────────────────────
export { AiProviderManager } from "./AiProvider";
export type {
    AiSuggestionRequest,
    AiSuggestionResponse,
    AiHandlerFn,
    AiStreamHandlerFn,
    AiStreamCallback,
} from "./AiProvider";

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
    FoldingRange,
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
export { GhostTextOverlay } from "./components/GhostTextOverlay";
export { FoldingOverlay } from "./components/FoldingOverlay";
export { SplitPane } from "./components/SplitPane";
export { PluginManagerPopover } from "./components/PluginManagerPopover";
