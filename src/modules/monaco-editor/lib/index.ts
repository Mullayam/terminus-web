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
export type { VSIXContents, ExtTheme, ExtGrammar, ExtSnippet, ExtLanguage } from "./extractVSIX";
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
  clearAllExtensions,
  toggleExtension,
} from "./extensionStorage";
export type { InstalledExtension, StoredTheme, StoredGrammar, StoredSnippet, ExtStatusBarItem, ExtMenuContribution, ExtViewContainer, ExtView } from "./extensionStorage";
export {
  installExtensionFromOpenVSX,
  installExtensionFromVSIX,
  uninstallExtensionFull,
  loadAllExtensions,
  loadAllExtensionThemes,
  loadAllExtensionGrammars,
  loadExtensionSnippets,
  registerExtensionTheme,
  registerExtensionGrammar,
  getAvailableExtensionThemes,
} from "./extensionLoader";
export type { InstallProgress } from "./extensionLoader";
