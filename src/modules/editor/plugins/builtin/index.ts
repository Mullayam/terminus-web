/**
 * @module editor/plugins/builtin
 *
 * Barrel export for all built-in plugins.
 * Each plugin is a factory function that returns an ExtendedEditorPlugin.
 */

// ── Original 13 plugins ──────────────────────────────────────
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

// ── Editing plugins ──────────────────────────────────────────
export { createTrimWhitespacePlugin } from "./trim-whitespace";
export { createFinalNewlinePlugin } from "./final-newline";
export { createSortLinesPlugin } from "./sort-lines";
export { createDuplicateLinesPlugin } from "./duplicate-lines";
export { createMoveLinesPlugin } from "./move-lines";
export { createJoinLinesPlugin } from "./join-lines";
export { createToggleCommentPlugin } from "./toggle-comment";
export { createWrapSelectionPlugin } from "./wrap-selection";
export { createSmartSelectPlugin } from "./smart-select";
export { createTransformCasePlugin } from "./transform-case";
export { createAutoCloseTagsPlugin } from "./auto-close-tags";
export { createAutoCloseBracketsPlugin } from "./auto-close-brackets";
export { createDeleteLinePlugin } from "./delete-line";
export { createIndentWithTabPlugin } from "./indent-with-tab";
export { createSelectOccurrencesPlugin } from "./select-occurrences";

// ── Navigation plugins ───────────────────────────────────────
export { createGoToLinePlugin } from "./go-to-line";
export { createBookmarksPlugin } from "./bookmarks";
export { createBreadcrumbsPlugin } from "./breadcrumbs";
export { createSymbolOutlinePlugin } from "./symbol-outline";
export { createMatchingBracketsPlugin } from "./matching-brackets";
export { createCursorHistoryPlugin } from "./cursor-history";
export { createQuickJumpPlugin } from "./quick-jump";
export { createCodeFoldingPlugin } from "./code-folding";

// ── Visual / UI plugins ──────────────────────────────────────
export { createIndentGuidesPlugin } from "./indent-guides";
export { createColorPreviewPlugin } from "./color-preview";
export { createBracketPairColorizerPlugin } from "./bracket-pair-colorizer";
export { createRelativeLineNumbersPlugin } from "./relative-line-numbers";
export { createHighlightCurrentLinePlugin } from "./highlight-current-line";
export { createMinimapHighlightsPlugin } from "./minimap-highlights";
export { createWordCountPlugin } from "./word-count";
export { createSmoothCaretPlugin } from "./smooth-caret";
export { createWhitespaceVisualizerPlugin } from "./whitespace-visualizer";
export { createStickyScrollPlugin } from "./sticky-scroll";
export { createZenModePlugin } from "./zen-mode";

// ── Language plugins ─────────────────────────────────────────
export { createEmmetPlugin } from "./emmet-abbreviation";
export { createJsonFormatterPlugin } from "./json-formatter";
export { createJsonPathPlugin } from "./json-path";
export { createCssColorPreviewPlugin } from "./css-color-preview";
export { createSqlFormatterPlugin } from "./sql-formatter";
export { createRegexTesterPlugin } from "./regex-tester";
export { createHtmlTagRenamePlugin } from "./html-tag-rename";
export { createImportSorterPlugin } from "./import-sorter";
export { createCssUnitConverterPlugin } from "./css-unit-converter";
export { createYamlPathPlugin } from "./yaml-path";
export { createTypescriptHelpersPlugin } from "./typescript-helpers";
export { createPythonHelpersPlugin } from "./python-helpers";
export { createGoHelpersPlugin } from "./go-helpers";
export { createRustHelpersPlugin } from "./rust-helpers";

// ── Productivity / Tools plugins ─────────────────────────────
export { createTodoHighlighterPlugin } from "./todo-highlighter";
export { createSnippetManagerPlugin } from "./snippet-manager";
export { createLoremIpsumPlugin } from "./lorem-ipsum";
export { createTimestampInsertPlugin } from "./timestamp-insert";
export { createBase64Plugin } from "./base64-encode-decode";
export { createUrlEncodeDecodePlugin } from "./url-encode-decode";
export { createHashGeneratorPlugin } from "./hash-generator";
export { createUuidGeneratorPlugin } from "./uuid-generator";
export { createSearchReplaceRegexPlugin } from "./search-replace-regex";
export { createMultiCursorPlugin } from "./multi-cursor-support";
export { createTextStatisticsPlugin } from "./text-statistics";
export { createEncodeSpecialCharsPlugin } from "./encode-special-chars";
export { createNumberConverterPlugin } from "./number-converter";

// ── Validation plugins ───────────────────────────────────────
export { createJsonLintPlugin } from "./json-lint";
export { createBracketValidatorPlugin } from "./bracket-validator";
export { createTrailingCommaPlugin } from "./trailing-comma";
export { createDuplicateLineDetectorPlugin } from "./duplicate-line-detector";
export { createLineLengthRulerPlugin } from "./line-length-ruler";
export { createSpellCheckPlugin } from "./spell-check";
export { createUnusedVariableDetectorPlugin } from "./unused-variable-detector";
export { createConsoleLogDetectorPlugin } from "./console-log-detector";

// ── Tools / AI / Git plugins ─────────────────────────────────
export { createClipboardHistoryPlugin } from "./clipboard-history";
export { createFileSizeIndicatorPlugin } from "./file-size-indicator";
export { createFormatOnSavePlugin } from "./format-on-save";
export { createGitChangeIndicatorsPlugin } from "./git-change-indicators";
export { createMergeConflictHighlighterPlugin } from "./merge-conflict-highlighter";
export { createAiRefactorPlugin } from "./ai-refactor-suggestions";
export { createAiCodeExplainPlugin } from "./ai-code-explain";
export { createAiCodeActionsPlugin } from "./ai-code-actions";
export { createEditorConfigPlugin } from "./editorconfig-support";
export { createSelectionInfoPlugin } from "./selection-info";
export { createKeyboardShortcutsHelperPlugin } from "./keyboard-shortcuts-helper";
export { createEncodingIndicatorPlugin } from "./encoding-indicator";
export { createAutoSavePlugin } from "./auto-save";

// ── Additional utility plugins ───────────────────────────────
export { createMarkdownTableFormatterPlugin } from "./markdown-table-formatter";
export { createColorPickerPlugin } from "./color-picker";
export { createMinimapOverviewPlugin } from "./minimap-overview";
export { createPairProgrammingPlugin } from "./pair-programming-mode";
export { createCodeMetricsPlugin } from "./code-metrics";
export { createQuickFixPlugin } from "./quick-fix";
export { createLineEndingConverterPlugin } from "./line-ending-converter";
export { createColumnSelectPlugin } from "./column-select";
export { createLinkedEditingPlugin } from "./linked-editing";
export { createParameterHintsPlugin } from "./parameter-hints";
export { createDiffStatsPlugin } from "./diff-stats";
export { createMacroRecorderPlugin } from "./macro-recorder";
export { createTemplateLiteralsPlugin } from "./template-literals";
export { createSurroundWithPlugin } from "./surround-with";
export { createLineSorterAdvancedPlugin } from "./line-sorter-advanced";
export { createStringEscapePlugin } from "./string-escape";
export { createEnvFileSupportPlugin } from "./env-file-support";
export { createCopyWithSyntaxPlugin } from "./copy-with-syntax";
export { createScopeHighlighterPlugin } from "./scope-highlighter";
export { createDateFormatterPlugin } from "./date-formatter";
export { createOpenLinksPlugin } from "./open-links";
export { createCommandPalettePlugin } from "./command-palette";

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

// Editing
import { createTrimWhitespacePlugin } from "./trim-whitespace";
import { createFinalNewlinePlugin } from "./final-newline";
import { createSortLinesPlugin } from "./sort-lines";
import { createDuplicateLinesPlugin } from "./duplicate-lines";
import { createMoveLinesPlugin } from "./move-lines";
import { createJoinLinesPlugin } from "./join-lines";
import { createToggleCommentPlugin } from "./toggle-comment";
import { createWrapSelectionPlugin } from "./wrap-selection";
import { createSmartSelectPlugin } from "./smart-select";
import { createTransformCasePlugin } from "./transform-case";
import { createAutoCloseTagsPlugin } from "./auto-close-tags";
import { createAutoCloseBracketsPlugin } from "./auto-close-brackets";
import { createDeleteLinePlugin } from "./delete-line";
import { createIndentWithTabPlugin } from "./indent-with-tab";
import { createSelectOccurrencesPlugin } from "./select-occurrences";

// Navigation
import { createGoToLinePlugin } from "./go-to-line";
import { createBookmarksPlugin } from "./bookmarks";
import { createBreadcrumbsPlugin } from "./breadcrumbs";
import { createSymbolOutlinePlugin } from "./symbol-outline";
import { createMatchingBracketsPlugin } from "./matching-brackets";
import { createCursorHistoryPlugin } from "./cursor-history";
import { createQuickJumpPlugin } from "./quick-jump";
import { createCodeFoldingPlugin } from "./code-folding";

// Visual / UI
import { createIndentGuidesPlugin } from "./indent-guides";
import { createColorPreviewPlugin } from "./color-preview";
import { createBracketPairColorizerPlugin } from "./bracket-pair-colorizer";
import { createRelativeLineNumbersPlugin } from "./relative-line-numbers";
import { createHighlightCurrentLinePlugin } from "./highlight-current-line";
import { createMinimapHighlightsPlugin } from "./minimap-highlights";
import { createWordCountPlugin } from "./word-count";
import { createSmoothCaretPlugin } from "./smooth-caret";
import { createWhitespaceVisualizerPlugin } from "./whitespace-visualizer";
import { createStickyScrollPlugin } from "./sticky-scroll";
import { createZenModePlugin } from "./zen-mode";

// Language
import { createEmmetPlugin } from "./emmet-abbreviation";
import { createJsonFormatterPlugin } from "./json-formatter";
import { createJsonPathPlugin } from "./json-path";
import { createCssColorPreviewPlugin } from "./css-color-preview";
import { createSqlFormatterPlugin } from "./sql-formatter";
import { createRegexTesterPlugin } from "./regex-tester";
import { createHtmlTagRenamePlugin } from "./html-tag-rename";
import { createImportSorterPlugin } from "./import-sorter";
import { createCssUnitConverterPlugin } from "./css-unit-converter";
import { createYamlPathPlugin } from "./yaml-path";
import { createTypescriptHelpersPlugin } from "./typescript-helpers";
import { createPythonHelpersPlugin } from "./python-helpers";
import { createGoHelpersPlugin } from "./go-helpers";
import { createRustHelpersPlugin } from "./rust-helpers";

// Productivity / Tools
import { createTodoHighlighterPlugin } from "./todo-highlighter";
import { createSnippetManagerPlugin } from "./snippet-manager";
import { createLoremIpsumPlugin } from "./lorem-ipsum";
import { createTimestampInsertPlugin } from "./timestamp-insert";
import { createBase64Plugin } from "./base64-encode-decode";
import { createUrlEncodeDecodePlugin } from "./url-encode-decode";
import { createHashGeneratorPlugin } from "./hash-generator";
import { createUuidGeneratorPlugin } from "./uuid-generator";
import { createSearchReplaceRegexPlugin } from "./search-replace-regex";
import { createMultiCursorPlugin } from "./multi-cursor-support";
import { createTextStatisticsPlugin } from "./text-statistics";
import { createEncodeSpecialCharsPlugin } from "./encode-special-chars";
import { createNumberConverterPlugin } from "./number-converter";

// Validation
import { createJsonLintPlugin } from "./json-lint";
import { createBracketValidatorPlugin } from "./bracket-validator";
import { createTrailingCommaPlugin } from "./trailing-comma";
import { createDuplicateLineDetectorPlugin } from "./duplicate-line-detector";
import { createLineLengthRulerPlugin } from "./line-length-ruler";
import { createSpellCheckPlugin } from "./spell-check";
import { createUnusedVariableDetectorPlugin } from "./unused-variable-detector";
import { createConsoleLogDetectorPlugin } from "./console-log-detector";

// Tools / AI / Git
import { createClipboardHistoryPlugin } from "./clipboard-history";
import { createFileSizeIndicatorPlugin } from "./file-size-indicator";
import { createFormatOnSavePlugin } from "./format-on-save";
import { createGitChangeIndicatorsPlugin } from "./git-change-indicators";
import { createMergeConflictHighlighterPlugin } from "./merge-conflict-highlighter";
import { createAiRefactorPlugin } from "./ai-refactor-suggestions";
import { createAiCodeExplainPlugin } from "./ai-code-explain";
import { createAiCodeActionsPlugin } from "./ai-code-actions";
import { createEditorConfigPlugin } from "./editorconfig-support";
import { createSelectionInfoPlugin } from "./selection-info";
import { createKeyboardShortcutsHelperPlugin } from "./keyboard-shortcuts-helper";
import { createEncodingIndicatorPlugin } from "./encoding-indicator";
import { createAutoSavePlugin } from "./auto-save";

// Additional utility
import { createMarkdownTableFormatterPlugin } from "./markdown-table-formatter";
import { createColorPickerPlugin } from "./color-picker";
import { createMinimapOverviewPlugin } from "./minimap-overview";
import { createPairProgrammingPlugin } from "./pair-programming-mode";
import { createCodeMetricsPlugin } from "./code-metrics";
import { createQuickFixPlugin } from "./quick-fix";
import { createLineEndingConverterPlugin } from "./line-ending-converter";
import { createColumnSelectPlugin } from "./column-select";
import { createLinkedEditingPlugin } from "./linked-editing";
import { createParameterHintsPlugin } from "./parameter-hints";
import { createDiffStatsPlugin } from "./diff-stats";
import { createMacroRecorderPlugin } from "./macro-recorder";
import { createTemplateLiteralsPlugin } from "./template-literals";
import { createSurroundWithPlugin } from "./surround-with";
import { createLineSorterAdvancedPlugin } from "./line-sorter-advanced";
import { createStringEscapePlugin } from "./string-escape";
import { createEnvFileSupportPlugin } from "./env-file-support";
import { createCopyWithSyntaxPlugin } from "./copy-with-syntax";
import { createScopeHighlighterPlugin } from "./scope-highlighter";
import { createDateFormatterPlugin } from "./date-formatter";
import { createOpenLinksPlugin } from "./open-links";
import { createCommandPalettePlugin } from "./command-palette";

import type { ExtendedEditorPlugin } from "../types";

/**
 * Create all built-in plugins with default configuration.
 * Pass to <FileEditor plugins={createAllBuiltinPlugins()} />
 *
 * Total: 102 plugins (13 original + 89 new)
 */
export function createAllBuiltinPlugins(): ExtendedEditorPlugin[] {
    return [
        // Original 13
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

        // Editing (15)
        createTrimWhitespacePlugin(),
        createFinalNewlinePlugin(),
        createSortLinesPlugin(),
        createDuplicateLinesPlugin(),
        createMoveLinesPlugin(),
        createJoinLinesPlugin(),
        createToggleCommentPlugin(),
        createWrapSelectionPlugin(),
        createSmartSelectPlugin(),
        createTransformCasePlugin(),
        createAutoCloseTagsPlugin(),
        createAutoCloseBracketsPlugin(),
        createDeleteLinePlugin(),
        createIndentWithTabPlugin(),
        createSelectOccurrencesPlugin(),

        // Navigation (8)
        createGoToLinePlugin(),
        createBookmarksPlugin(),
        createBreadcrumbsPlugin(),
        createSymbolOutlinePlugin(),
        createMatchingBracketsPlugin(),
        createCursorHistoryPlugin(),
        createQuickJumpPlugin(),
        createCodeFoldingPlugin(),

        // Visual / UI (11)
        createIndentGuidesPlugin(),
        createColorPreviewPlugin(),
        createBracketPairColorizerPlugin(),
        createRelativeLineNumbersPlugin(),
        createHighlightCurrentLinePlugin(),
        createMinimapHighlightsPlugin(),
        createWordCountPlugin(),
        createSmoothCaretPlugin(),
        createWhitespaceVisualizerPlugin(),
        createStickyScrollPlugin(),
        createZenModePlugin(),

        // Language (14)
        createEmmetPlugin(),
        createJsonFormatterPlugin(),
        createJsonPathPlugin(),
        createCssColorPreviewPlugin(),
        createSqlFormatterPlugin(),
        createRegexTesterPlugin(),
        createHtmlTagRenamePlugin(),
        createImportSorterPlugin(),
        createCssUnitConverterPlugin(),
        createYamlPathPlugin(),
        createTypescriptHelpersPlugin(),
        createPythonHelpersPlugin(),
        createGoHelpersPlugin(),
        createRustHelpersPlugin(),

        // Productivity / Tools (13)
        createTodoHighlighterPlugin(),
        createSnippetManagerPlugin(),
        createLoremIpsumPlugin(),
        createTimestampInsertPlugin(),
        createBase64Plugin(),
        createUrlEncodeDecodePlugin(),
        createHashGeneratorPlugin(),
        createUuidGeneratorPlugin(),
        createSearchReplaceRegexPlugin(),
        createMultiCursorPlugin(),
        createTextStatisticsPlugin(),
        createEncodeSpecialCharsPlugin(),
        createNumberConverterPlugin(),

        // Validation (8)
        createJsonLintPlugin(),
        createBracketValidatorPlugin(),
        createTrailingCommaPlugin(),
        createDuplicateLineDetectorPlugin(),
        createLineLengthRulerPlugin(),
        createSpellCheckPlugin(),
        createUnusedVariableDetectorPlugin(),
        createConsoleLogDetectorPlugin(),

        // Tools / AI / Git (13)
        createClipboardHistoryPlugin(),
        createFileSizeIndicatorPlugin(),
        createFormatOnSavePlugin(),
        createGitChangeIndicatorsPlugin(),
        createMergeConflictHighlighterPlugin(),
        createAiRefactorPlugin(),
        createAiCodeExplainPlugin(),
        createAiCodeActionsPlugin(),
        createEditorConfigPlugin(),
        createSelectionInfoPlugin(),
        createKeyboardShortcutsHelperPlugin(),
        createEncodingIndicatorPlugin(),
        createAutoSavePlugin(),

        // Additional utility (22)
        createMarkdownTableFormatterPlugin(),
        createColorPickerPlugin(),
        createMinimapOverviewPlugin(),
        createPairProgrammingPlugin(),
        createCodeMetricsPlugin(),
        createQuickFixPlugin(),
        createLineEndingConverterPlugin(),
        createColumnSelectPlugin(),
        createLinkedEditingPlugin(),
        createParameterHintsPlugin(),
        createDiffStatsPlugin(),
        createMacroRecorderPlugin(),
        createTemplateLiteralsPlugin(),
        createSurroundWithPlugin(),
        createLineSorterAdvancedPlugin(),
        createStringEscapePlugin(),
        createEnvFileSupportPlugin(),
        createCopyWithSyntaxPlugin(),
        createScopeHighlighterPlugin(),
        createDateFormatterPlugin(),
        createOpenLinksPlugin(),
        createCommandPalettePlugin(),
    ];
}
