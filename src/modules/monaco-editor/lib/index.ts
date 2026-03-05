/**
 * @module monaco-editor/lib
 *
 * Internal barrel for Monaco utility libraries.
 * These provide themes, snippets, auto-close, copilot, LSP,
 * and the Open VSX extension system.
 */

export { loadCustomTheme, preloadThemes, isThemeLoaded } from "./loadCustomTheme";
export { loadSnippets, unloadSnippets, preloadSnippets } from "./loadSnippets";
export { registerAutoClose } from "./registerAutoClose";
export { registerCopilot, detectTechnologies, type CopilotOptions } from "./registerCopilot";
export { configureLanguageDefaults } from "./configureLanguageDefaults";
export {
  connectLanguageServer,
  buildLSPWebSocketUrl,
  hasLSPSupport,
  LSP_LANGUAGES,
  type LSPConnectionOptions,
  type LSPConnection,
} from "./connectLanguageServer";

// Open VSX extension system
export { searchExtensions, getExtension, getExtensionVersion, downloadVSIX } from "./openVSX";
export type { OpenVSXExtension, OpenVSXSearchResult } from "./openVSX";
export { extractVSIX } from "./extractVSIX";
export type {
  VSIXContents, ExtTheme, ExtGrammar, ExtSnippet, ExtLanguage,
  ExtCommand, ExtKeybinding, ExtConfiguration, ExtConfigurationProperty,
  ExtColor, ExtIcon, ExtJsonValidation,
} from "./extractVSIX";
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
} from "./extensionStorage";
export type {
  InstalledExtension, StoredTheme, StoredGrammar, StoredSnippet,
  StoredCommand, StoredKeybinding, StoredConfiguration, StoredColor,
  StoredIcon, StoredJsonValidation,
  ExtStatusBarItem, ExtMenuContribution, ExtViewContainer, ExtView,
} from "./extensionStorage";
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
} from "./extensionLoader";
export type { InstallProgress } from "./extensionLoader";

// AI Completions (dynamic endpoint, IDB-cached, fetch-on-mount)
export {
  registerAICompletions,
  resolveKind,
  type AICompletionConfig,
  type AICompletionItem,
  type AICompletionResponse,
  type AICompletionRegistration,
  type CustomContextMenuItem,
} from "./aiCompletions";

// Custom Hover Providers (user-defined word → Markdown per language)
export {
  registerCustomHoverProviders,
  parseHovers,
  getGoHoverDemoJson,
  type CustomHoverEntry,
} from "./hoverProvider";

// Context Engine Providers (completions, hover, definitions from IndexedDB)
export {
  registerContextEngineProviders,
  registerContextEngineForLanguage,
  disposeContextEngineProviders,
} from "./contextEngineProviders";

// Remote Providers (fetch manifest + JSON data from a BASE_URL → register Monaco providers)
export {
  registerRemoteProviders,
  registerProviderFromData,
  fetchManifest,
  disposeAllRemoteProviders,
  // Individual adapter functions (manual mode)
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
} from "./remote-providers";
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
} from "./remote-providers";
