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
