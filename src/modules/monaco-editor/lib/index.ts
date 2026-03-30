/**
 * @module monaco-editor/lib
 *
 * Internal barrel for Monaco utility libraries.
 *
 * Organised into categorised subdirectories:
 *
 *   ai/           – AI completions (endpoint, IDB cache)
 *   context-engine/ – Context-engine Monaco provider registration
 *   editor/       – Editor feature registrations (auto-close, copilot)
 *   extensions/   – Open VSX extension system (search, install, storage)
 *   filesystem/   – Pluggable file-system provider abstraction
 *   hover/        – Custom hover providers
 *   language/     – Language config, groups, symbol patterns
 *   lsp/          – LSP client, built-in providers, converters
 *   providers/    – Remote JSON → Monaco provider adapters
 *   snippets/     – Snippet loading
 *   themes/       – Custom theme loading, xterm conversion
 */

// ── Themes ──────────────────────────────────────────────────
export { loadCustomTheme, preloadThemes, isThemeLoaded } from "./themes/loadCustomTheme";

// ── Snippets ────────────────────────────────────────────────
export { loadSnippets, unloadSnippets, preloadSnippets } from "./snippets/loadSnippets";

// ── Editor Features ─────────────────────────────────────────
export { registerAutoClose } from "./editor/registerAutoClose";
export { registerCopilot, detectTechnologies, type CopilotOptions } from "./editor/registerCopilot";

// ── Language ────────────────────────────────────────────────
export { configureLanguageDefaults } from "./language/configureLanguageDefaults";

// ── LSP ─────────────────────────────────────────────────────
export {
  connectLanguageServer,
  buildLSPWebSocketUrl,
  hasLSPSupport,
  LSP_LANGUAGES,
  type LSPConnectionOptions,
  type LSPConnection,
} from "./lsp/connectLanguageServer";

// ── Extensions (Open VSX) ───────────────────────────────────
export { searchExtensions, getExtension, getExtensionVersion, downloadVSIX } from "./extensions/openVSX";
export type { OpenVSXExtension, OpenVSXSearchResult } from "./extensions/openVSX";
export { extractVSIX } from "./extensions/extractVSIX";
export type {
  VSIXContents, ExtTheme, ExtGrammar, ExtSnippet, ExtLanguage,
  ExtCommand, ExtKeybinding, ExtConfiguration, ExtConfigurationProperty,
  ExtColor, ExtIcon, ExtJsonValidation,
} from "./extensions/extractVSIX";
export {
  saveExtension,
  uninstallExtension,
  getInstalledExtensions,
  getEnabledExtensions,
  isExtensionInstalled,
  getAllThemes,
  getThemeById,
  getAllGrammars,
  getSnippetsByLanguage,
  getAllSnippets,
  getAllCommands,
  getAllKeybindings,
  getAllConfigurations,
  getAllColors,
  getAllIcons,
  getAllJsonValidation,
  clearAllExtensions,
  toggleExtension,
} from "./extensions/extensionStorage";
export type {
  InstalledExtension, StoredTheme, StoredGrammar, StoredSnippet,
  StoredCommand, StoredKeybinding, StoredConfiguration, StoredColor,
  StoredIcon, StoredJsonValidation,
  ExtStatusBarItem, ExtMenuContribution, ExtViewContainer, ExtView,
} from "./extensions/extensionStorage";
export {
  installExtensionFromOpenVSX,
  installExtensionFromVSIX,
  uninstallExtensionFull,
  loadAllExtensions,
  loadAllExtensionThemes,
  loadAllExtensionGrammars,
  loadExtensionSnippets,
  loadAllExtensionSnippets,
  loadExtensionCommands,
  loadExtensionKeybindings,
  loadExtensionConfigurations,
  getExtensionColorDefaults,
  loadExtensionIcons,
  loadExtensionJsonValidation,
  registerExtensionTheme,
  registerExtensionGrammar,
  getAvailableExtensionThemes,
} from "./extensions/extensionLoader";
export type { InstallProgress } from "./extensions/extensionLoader";

// ── AI Completions ──────────────────────────────────────────
export {
  registerAICompletions,
  resolveKind,
  type AICompletionConfig,
  type AICompletionItem,
  type AICompletionResponse,
  type AICompletionRegistration,
  type CustomContextMenuItem,
} from "./ai/aiCompletions";

// ── Custom Hover Providers ──────────────────────────────────
export {
  registerCustomHoverProviders,
  parseHovers,
  getGoHoverDemoJson,
  type CustomHoverEntry,
} from "./hover/hoverProvider";

// ── Context Engine Providers ────────────────────────────────
export {
  registerContextEngineProviders,
  registerContextEngineForLanguage,
  disposeContextEngineProviders,
} from "./context-engine/contextEngineProviders";

// ── Remote Providers ────────────────────────────────────────
export {
  registerRemoteProviders,
  registerProviderFromData,
  fetchManifest,
  disposeAllRemoteProviders,
  createCompletionProvider,
  createDefinitionProvider,
  createHoverProvider,
  createCodeActionProvider,
  createDocumentHighlightProvider,
  createDocumentSymbolProvider,
  createLinkProvider,
  createTypeDefinitionProvider,
  createReferenceProvider,
  createImplementationProvider,
  createInlineCompletionsProvider,
  createFormattingProvider,
  createCodeLensProvider,
  createColorProvider,
  createDeclarationProvider,
  createInlayHintsProvider,
  createSignatureHelpProvider,
  createLinkedEditingRangeProvider,
  createRangeFormattingProvider,
  createOnTypeFormattingProvider,
  createFoldingRangeProvider,
  createRenameProvider,
  createNewSymbolNamesProvider,
  createSelectionRangeProvider,
  createSemanticTokensProvider,
  createRangeSemanticTokensProvider,
} from "./providers";
export type {
  RemoteProviderManifest,
  RemoteProviderConfig,
  RemoteProviderRegistration,
  ProviderKey,
  ProviderDataMap,
  CompletionData,
  CompletionItemData,
  DefinitionData,
  HoverData,
  CodeActionData,
  CodeActionItemData,
  DocumentHighlightData,
  DocumentSymbolData,
  DocumentSymbolPattern,
  LinkData,
  LinkPatternData,
  TypeDefinitionData,
  ReferenceData,
  ImplementationData,
  InlineCompletionData,
  InlineCompletionItemData,
  FormattingData,
  FormattingRuleData,
  CodeLensData,
  CodeLensPattern,
  ColorData,
  ColorPatternData,
  DeclarationData,
  InlayHintData,
  InlayHintPattern,
  SignatureHelpData,
  SignatureData,
  SignatureParameterData,
  LinkedEditingRangeData,
  RangeFormattingData,
  OnTypeFormattingData,
  OnTypeFormattingRule,
  FoldingRangeData,
  FoldingRangePattern,
  RenameData,
  NewSymbolNamesData,
  NewSymbolNameSuggestion,
  SelectionRangeData,
  SelectionRangePattern,
  SemanticTokensData,
  SemanticTokenPattern,
  RangeSemanticTokensData,
  JsonRange,
  JsonLocation,
  JsonMarkdownString,
  JsonCommand,
} from "./providers";

// ── File System Provider ────────────────────────────────────
export type {
  FileSystemProvider,
  FileEntry,
  FsProviderStatus,
  FsStatusListener,
  FileOperationHandlers,
  ReaddirOptions,
  IgnoreConfig,
} from "./filesystem/file-system-types";
export { DEFAULT_IGNORED_NAMES } from "./filesystem/file-system-types";
export { SftpFileSystemProvider } from "./filesystem/sftp-fs-provider";
export {
  registerFsProvider,
  unregisterFsProvider,
  createFsProvider,
  hasFsProvider,
  listFsProviders,
  type FsProviderFactory,
} from "./filesystem/fsProviderRegistry";
export { useFileSystemTree, type UseFileSystemTreeOptions } from "./filesystem/useFileSystemTree";
export {
  createSftpHandlers,
  createApiHandlers,
  composeHandlers,
  type SftpHandlerOptions,
  type ApiHandlerOptions,
} from "./filesystem/fs-handler-factories";
export { DirCache, type DirCacheOptions } from "./filesystem/DirCache";
export { filterEntries, paginateEntries } from "./filesystem/filterEntries";
