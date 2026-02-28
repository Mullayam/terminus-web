/**
 * @module monaco-editor
 *
 * Public API for the Monaco Editor module.
 *
 * A fully extensible, plugin-driven Monaco Editor wrapper for React.
 * Designed to be used alongside (not replacing) the existing custom editor module.
 *
 * ────────────────────────────────────────────────────────────────
 * QUICK START
 * ────────────────────────────────────────────────────────────────
 *
 *   import {
 *     MonacoEditor,
 *     todoHighlightPlugin,
 *     bracketColorizerPlugin,
 *   } from "@/modules/monaco-editor";
 *
 *   <MonacoEditor
 *     value={code}
 *     language="typescript"
 *     theme="one-dark"
 *     plugins={[todoHighlightPlugin, bracketColorizerPlugin]}
 *     onChange={setCode}
 *     onSave={handleSave}
 *   />
 *
 * ────────────────────────────────────────────────────────────────
 * CREATING A CUSTOM PLUGIN
 * ────────────────────────────────────────────────────────────────
 *
 *   import { createPlugin } from "@/modules/monaco-editor";
 *
 *   const myPlugin = createPlugin({
 *     id: "my-awesome-plugin",
 *     name: "My Awesome Plugin",
 *     onMount(ctx) {
 *       ctx.addAction({
 *         id: "my-action",
 *         label: "Do Something Cool",
 *         keybindings: [ctx.monaco.KeyMod.CtrlCmd | ctx.monaco.KeyCode.KeyM],
 *         run: () => ctx.notify("Hello from my plugin!", "success"),
 *       });
 *
 *       ctx.registerCompletionProvider("javascript", {
 *         provideCompletionItems: (model, position) => {
 *           return { suggestions: [{ label: "mySnippet", kind: 15, insertText: "console.log($0)" }] };
 *         },
 *       });
 *     },
 *   });
 *
 * ────────────────────────────────────────────────────────────────
 * GLOBAL PLUGIN REGISTRY
 * ────────────────────────────────────────────────────────────────
 *
 *   import { pluginRegistry } from "@/modules/monaco-editor";
 *
 *   pluginRegistry.register(myPlugin);         // All editor instances pick it up
 *   pluginRegistry.disable("my-awesome-plugin"); // Temporarily disable
 *   pluginRegistry.unregister("my-awesome-plugin"); // Remove entirely
 */

// ── Main Components ─────────────────────────────────────────
export { MonacoEditor } from "./MonacoEditor";
export { MonacoDiffEditor } from "./MonacoDiffEditor";

// ── Types ───────────────────────────────────────────────────
export type {
  Monaco,
  MonacoEditorInstance,
  MonacoDiffEditorInstance,
  IDisposable,
  PluginContext,
  MonacoPlugin,
  MonacoThemeDef,
  MonacoEditorConfig,
  MonacoDiffEditorConfig,
  NotifyFn,
  BasePluginOptions,
  CustomLanguageDef,
  PluginRegistryEvent,
  PluginRegistryListener,
} from "./types";

// ── Core ────────────────────────────────────────────────────
export { pluginRegistry } from "./core/plugin-registry";
export { EventBus } from "./core/event-bus";
export {
  registerTheme,
  registerThemes,
  getTheme,
  getAllThemes,
  hasTheme,
} from "./core/theme-registry";
export {
  registerLanguage,
  registerLanguages,
  isLanguageRegistered,
} from "./core/language-registry";

// ── Hooks ───────────────────────────────────────────────────
export { useMonacoEditor } from "./hooks/useMonacoEditor";
export { useMonacoPlugins } from "./hooks/useMonacoPlugins";

// ── Utils ───────────────────────────────────────────────────
export { createPlugin } from "./utils/create-plugin";
export { detectLanguage, initMonacoLanguages, refreshLanguageCache } from "./utils/language-detect";

// ── Built-in Plugins ────────────────────────────────────────
export {
  saveStatePlugin,
  bracketColorizerPlugin,
  wordHighlightPlugin,
  todoHighlightPlugin,
  minimapColorsPlugin,
  vscodeClipboardPlugin,
  createGhostTextPlugin,
  createNotificationPlugin,
  setNotificationsHandle,
  getNotificationsHandle,
  showEditorNotification,
  NOTIFICATION_EVENTS,
  ALL_BUILTIN_PLUGINS,
} from "./plugins";
export type { GhostTextPluginOptions, NotificationPluginOptions, BackendNotification } from "./plugins";

// ── Built-in Themes ─────────────────────────────────────────
export {
  oneDark,
  dracula,
  githubDark,
  monokai,
  nord,
  BUILT_IN_THEMES,
} from "./themes";

// ── Lib Utilities (Themes, Snippets, Copilot, LSP, Extensions) ──
export {
  // Custom themes
  loadCustomTheme,
  preloadThemes,
  isThemeLoaded,
  // Language defaults (built-in IntelliSense)
  configureLanguageDefaults,
  // Snippets
  loadSnippets,
  unloadSnippets,
  preloadSnippets,
  // Auto-close tags
  registerAutoClose,
  // Copilot AI
  registerCopilot,
  detectTechnologies,
  // LSP
  connectLanguageServer,
  buildLSPWebSocketUrl,
  hasLSPSupport,
  LSP_LANGUAGES,
  // Open VSX
  searchExtensions,
  getExtension,
  getExtensionVersion,
  downloadVSIX,
  extractVSIX,
  // Extension storage
  saveExtension,
  uninstallExtension,
  getInstalledExtensions,
  getEnabledExtensions,
  isExtensionInstalled,
  getAllThemes as getAllExtensionThemes,
  getThemeById,
  getAllGrammars,
  getSnippetsByLanguage,
  clearAllExtensions,
  toggleExtension,
  // Extension loader
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
} from "./lib";

export type {
  CopilotOptions,
  LSPConnectionOptions,
  LSPConnection,
  OpenVSXExtension,
  OpenVSXSearchResult,
  VSIXContents,
  ExtTheme,
  ExtGrammar,
  ExtSnippet,
  ExtLanguage,
  InstalledExtension,
  StoredTheme,
  StoredGrammar,
  StoredSnippet,
  ExtStatusBarItem,
  ExtMenuContribution,
  ExtViewContainer,
  ExtView,
  InstallProgress,
} from "./lib";

// ── Sidebar Components ──────────────────────────────────────
export { EditorRightSidebar } from "./components/EditorRightSidebar";
export type { DocumentSymbolItem, SidebarTab, EditorRightSidebarProps } from "./components/EditorRightSidebar";
export { ExtensionPanel } from "./components/ExtensionPanel";
export type { ExtensionPanelProps } from "./components/ExtensionPanel";

// ── New UI Components ───────────────────────────────────────
export { ExtensionDetailPage } from "./components/ExtensionDetailPage";
export type { ExtensionDetailPageProps } from "./components/ExtensionDetailPage";
export { ThemeSidebar } from "./components/ThemeSidebar";
export type { ThemeSidebarProps } from "./components/ThemeSidebar";
export { ExtensionStatusBar } from "./components/ExtensionStatusBar";
export type { ExtensionStatusBarProps, StatusBarItemDef } from "./components/ExtensionStatusBar";
export { EditorTerminalPanel } from "./components/EditorTerminalPanel";
export type { EditorTerminalPanelProps } from "./components/EditorTerminalPanel";
export { VsixDropZone } from "./components/VsixDropZone";
