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
    // Original 13
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
    // Editing
    createTrimWhitespacePlugin,
    createFinalNewlinePlugin,
    createSortLinesPlugin,
    createDuplicateLinesPlugin,
    createMoveLinesPlugin,
    createJoinLinesPlugin,
    createToggleCommentPlugin,
    createWrapSelectionPlugin,
    createSmartSelectPlugin,
    createTransformCasePlugin,
    createAutoCloseTagsPlugin,
    createAutoCloseBracketsPlugin,
    createDeleteLinePlugin,
    createIndentWithTabPlugin,
    createSelectOccurrencesPlugin,
    // Navigation
    createGoToLinePlugin,
    createBookmarksPlugin,
    createBreadcrumbsPlugin,
    createSymbolOutlinePlugin,
    createMatchingBracketsPlugin,
    createCursorHistoryPlugin,
    createQuickJumpPlugin,
    createCodeFoldingPlugin,
    // Visual / UI
    createIndentGuidesPlugin,
    createColorPreviewPlugin,
    createBracketPairColorizerPlugin,
    createRelativeLineNumbersPlugin,
    createHighlightCurrentLinePlugin,
    createMinimapHighlightsPlugin,
    createWordCountPlugin,
    createSmoothCaretPlugin,
    createWhitespaceVisualizerPlugin,
    createStickyScrollPlugin,
    createZenModePlugin,
    // Language
    createEmmetPlugin,
    createJsonFormatterPlugin,
    createJsonPathPlugin,
    createCssColorPreviewPlugin,
    createSqlFormatterPlugin,
    createRegexTesterPlugin,
    createHtmlTagRenamePlugin,
    createImportSorterPlugin,
    createCssUnitConverterPlugin,
    createYamlPathPlugin,
    createTypescriptHelpersPlugin,
    createPythonHelpersPlugin,
    createGoHelpersPlugin,
    createRustHelpersPlugin,
    // Productivity / Tools
    createTodoHighlighterPlugin,
    createSnippetManagerPlugin,
    createLoremIpsumPlugin,
    createTimestampInsertPlugin,
    createBase64Plugin,
    createUrlEncodeDecodePlugin,
    createHashGeneratorPlugin,
    createUuidGeneratorPlugin,
    createSearchReplaceRegexPlugin,
    createMultiCursorPlugin,
    createTextStatisticsPlugin,
    createEncodeSpecialCharsPlugin,
    createNumberConverterPlugin,
    // Validation
    createJsonLintPlugin,
    createBracketValidatorPlugin,
    createTrailingCommaPlugin,
    createDuplicateLineDetectorPlugin,
    createLineLengthRulerPlugin,
    createSpellCheckPlugin,
    createUnusedVariableDetectorPlugin,
    createConsoleLogDetectorPlugin,
    // Tools / AI / Git
    createClipboardHistoryPlugin,
    createFileSizeIndicatorPlugin,
    createFormatOnSavePlugin,
    createGitChangeIndicatorsPlugin,
    createMergeConflictHighlighterPlugin,
    createAiRefactorPlugin,
    createAiCodeExplainPlugin,
    createAiCodeActionsPlugin,
    createEditorConfigPlugin,
    createSelectionInfoPlugin,
    createKeyboardShortcutsHelperPlugin,
    createEncodingIndicatorPlugin,
    createAutoSavePlugin,
    // Additional utility
    createMarkdownTableFormatterPlugin,
    createColorPickerPlugin,
    createMinimapOverviewPlugin,
    createPairProgrammingPlugin,
    createCodeMetricsPlugin,
    createQuickFixPlugin,
    createLineEndingConverterPlugin,
    createColumnSelectPlugin,
    createLinkedEditingPlugin,
    createParameterHintsPlugin,
    createDiffStatsPlugin,
    createMacroRecorderPlugin,
    createTemplateLiteralsPlugin,
    createSurroundWithPlugin,
    createLineSorterAdvancedPlugin,
    createStringEscapePlugin,
    createEnvFileSupportPlugin,
    createCopyWithSyntaxPlugin,
    createScopeHighlighterPlugin,
    createDateFormatterPlugin,
    createOpenLinksPlugin,
    createCommandPalettePlugin,
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
