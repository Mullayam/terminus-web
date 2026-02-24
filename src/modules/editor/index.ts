/**
 * @module editor
 *
 * Public API for the File Editor module.
 *
 * Usage:
 *   import { FileEditor, ThemeManager, FormatterRegistry, ApiContentProvider } from "@/modules/editor";
 *
 *   <FileEditor
 *     sessionId={sessionId}
 *     remotePath={remotePath}
 *     provider={new ApiContentProvider()}
 *   />
 */

// ── Main component ──────────────────────────────────────────
export { FileEditor, type FileEditorProps } from "./FileEditor";

// ── Components (for advanced composition) ───────────────────
export { CommandPalette } from "./components/CommandPalette";

// ── Theme management ────────────────────────────────────────
export { ThemeManager } from "./themes/manager";
export { BUILT_IN_THEMES, dracula, vsDark, monokai, oneDark, darcula, solarizedDark, githubDark } from "./themes/defaults";

// ── Content providers ───────────────────────────────────────
export { ApiContentProvider, SocketContentProvider, createContentProvider } from "./api/providers";

// ── Formatters ──────────────────────────────────────────────
export { FormatterRegistry } from "./formatters";

// ── Core utilities ──────────────────────────────────────────
export { detectLanguage, detectPrismLanguage } from "./core/detect-lang";
export { highlightCode } from "./core/syntax";
export { SnippetEngine } from "./core/snippets";
export { colorizeBrackets } from "./core/bracket-colorizer";

// ── State (for advanced / embed use cases) ──────────────────
export { EditorProvider, useEditorStore, useEditorStoreApi, useEditorRefs } from "./state/context";
export { createEditorStore } from "./state/store";

// ── Hooks ───────────────────────────────────────────────────
export { useEditor } from "./hooks/useEditor";
export { useTheme } from "./hooks/useTheme";
export { useKeybindings } from "./hooks/useKeybindings";
export { useContentProvider } from "./hooks/useContentProvider";

// ── Types ───────────────────────────────────────────────────
export type {
    EditorTheme,
    PartialTheme,
    ThemeColors,
    ThemeSyntax,
    ThemeFont,
    EditorConfig,
    ContentProvider,
    FormatterFn,
    FormatterDefinition,
    KeyBinding,
    ContextMenuItem,
    EditorPlugin,
    EditorPluginAPI,
    EditorState,
    EditorActions,
    EditorStoreType,
} from "./types";

// ── Plugin system ───────────────────────────────────────────
export { PluginHost } from "./plugins/PluginHost";
export { usePluginHost } from "./plugins/usePluginHost";
export { definePlugin, mergePlugins, checkPlugin } from "./plugins/definePlugin";
export { validatePlugin, validatePlugins, logValidationResults } from "./plugins/validatePlugin";
export { AiProviderManager } from "./plugins/AiProvider";
export type { AiSuggestionRequest, AiSuggestionResponse, AiHandlerFn, AiStreamHandlerFn, AiStreamCallback } from "./plugins/AiProvider";
export type { PluginValidationResult, PluginValidationIssue } from "./plugins/validatePlugin";
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
    createAiGhostTextPlugin,
    ghostTextStore,
} from "./plugins/builtin";
export type {
    ExtendedEditorPlugin,
    ExtendedPluginAPI,
    PluginHostState,
    CompletionItem,
    CompletionProvider,
    CompletionContext,
    CodeLensItem,
    InlineAnnotation,
    InlineDecoration,
    GutterDecoration,
    Diagnostic,
    DiagnosticFix,
    PanelDescriptor,
    DiffHunk,
    FoldingRange,
} from "./plugins/types";
export type { AiAdapter, AiContext, AiBugReport } from "./plugins/builtin/ai-suite";
export type { GhostTextState } from "./plugins/builtin/ai-ghost-text";
export { DemoAiAdapter } from "./plugins/builtin/ai-suite";

// ── Plugin UI components ────────────────────────────────────
export { CompletionWidget } from "./plugins/components/CompletionWidget";
export { CodeLensOverlay } from "./plugins/components/CodeLensOverlay";
export { InlineAnnotationsOverlay } from "./plugins/components/InlineAnnotationsOverlay";
export { DiagnosticsOverlay } from "./plugins/components/DiagnosticsOverlay";
export { FoldingOverlay } from "./plugins/components/FoldingOverlay";
export { SplitPane } from "./plugins/components/SplitPane";
export { PluginStatusBar } from "./plugins/components/PluginStatusBar";
export { PluginPanelRenderer } from "./plugins/components/PluginPanelRenderer";
