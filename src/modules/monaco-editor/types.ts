/**
 * @module monaco-editor/types
 *
 * Centralized type definitions for the Monaco Editor module.
 *
 * Architecture:
 * - MonacoPlugin uses the **Observer + Registry Pattern** for lifecycle hooks
 * - MonacoThemeDef uses the **Factory Pattern** for theme registration
 * - MonacoEditorConfig is the **Options Bag** for component configuration
 * - PluginContext provides the **Facade Pattern** over Monaco internals
 */

import type * as monacoNs from "monaco-editor";
import type { ReactNode } from "react";

// Re-export monaco namespace for convenience
export type Monaco = typeof monacoNs;
export type MonacoEditorInstance = monacoNs.editor.IStandaloneCodeEditor;
export type MonacoDiffEditorInstance = monacoNs.editor.IStandaloneDiffEditor;
export type IDisposable = monacoNs.IDisposable;

// ═══════════════════════════════════════════════════════════════
//  PLUGIN SYSTEM
// ═══════════════════════════════════════════════════════════════

/**
 * Context provided to every plugin during its lifecycle.
 * This is the primary API surface plugins interact with.
 */
export interface PluginContext {
  /** The raw Monaco namespace (for direct API access) */
  monaco: Monaco;
  /** The editor instance (available after mount) */
  editor: MonacoEditorInstance;
  /** Register a disposable that will be cleaned up on plugin deactivation */
  addDisposable(disposable: IDisposable): void;
  /** Get the current editor value */
  getContent(): string;
  /** Set the editor value */
  setContent(value: string): void;
  /** Get the current language ID */
  getLanguage(): string;
  /** Set the editor language */
  setLanguage(languageId: string): void;
  /** Get current file path (if provided) */
  getFilePath(): string | undefined;
  /** Insert text at the current cursor position */
  insertTextAtCursor(text: string): void;
  /** Get the currently selected text */
  getSelectedText(): string;
  /** Replace the current selection */
  replaceSelection(text: string): void;
  /** Show a notification (integrates with host app) */
  notify(message: string, type?: "info" | "success" | "warning" | "error"): void;
  /** Register a keybinding scoped to this plugin */
  addKeybinding(
    keybinding: number,
    handler: () => void,
    label?: string,
  ): void;
  /** Add an editor action (appears in command palette) */
  addAction(action: monacoNs.editor.IActionDescriptor): void;
  /** Register a completion provider for specific languages */
  registerCompletionProvider(
    languageSelector: string | string[],
    provider: monacoNs.languages.CompletionItemProvider,
  ): void;
  /** Register a hover provider for specific languages */
  registerHoverProvider(
    languageSelector: string | string[],
    provider: monacoNs.languages.HoverProvider,
  ): void;
  /** Register a code action provider */
  registerCodeActionProvider(
    languageSelector: string | string[],
    provider: monacoNs.languages.CodeActionProvider,
  ): void;
  /** Register a code lens provider */
  registerCodeLensProvider(
    languageSelector: string | string[],
    provider: monacoNs.languages.CodeLensProvider,
  ): void;
  /** Register a document formatting provider */
  registerDocumentFormattingProvider(
    languageSelector: string | string[],
    provider: monacoNs.languages.DocumentFormattingEditProvider,
  ): void;
  /** Register inline completions (ghost text / AI suggestions) */
  registerInlineCompletionsProvider(
    languageSelector: string | string[],
    provider: monacoNs.languages.InlineCompletionsProvider,
  ): void;
  /** Set model markers (diagnostics / squiggles) */
  setModelMarkers(
    owner: string,
    markers: monacoNs.editor.IMarkerData[],
  ): void;
  /** Apply decorations to the editor */
  applyDecorations(
    decorations: monacoNs.editor.IModelDeltaDecoration[],
  ): string[];
  /** Remove decorations by their IDs */
  removeDecorations(decorationIds: string[]): void;
  /** Emit a custom event plugins can listen to */
  emit(event: string, data?: unknown): void;
  /** Listen for a custom event from other plugins */
  on(event: string, handler: (data?: unknown) => void): IDisposable;
}

/**
 * The plugin interface. Implement this to create a Monaco Editor plugin.
 *
 * Lifecycle:
 *  1. `onBeforeMount(monaco)` — Monaco loaded, before editor creation
 *  2. `onMount(context)` — Editor created, plugin receives full context
 *  3. `onLanguageChange(lang, context)` — Language changed
 *  4. `onContentChange(content, context)` — Content changed
 *  5. `onDispose()` — Cleanup before plugin removal
 */
export interface MonacoPlugin {
  /** Unique plugin identifier (kebab-case) */
  id: string;
  /** Human-readable name */
  name: string;
  /** Semver version string */
  version: string;
  /** Plugin description */
  description?: string;
  /** IDs of other plugins this depends on */
  dependencies?: string[];
  /** Priority for load ordering (higher = loads first, default 0) */
  priority?: number;
  /** Whether the plugin is enabled by default */
  defaultEnabled?: boolean;

  /**
   * Called when Monaco is loaded but before the editor is created.
   * Use this for registering languages, themes, etc.
   */
  onBeforeMount?(monaco: Monaco): void | Promise<void>;

  /**
   * Called when the editor instance is created.
   * The primary lifecycle hook — register providers, keybindings, etc.
   */
  onMount?(context: PluginContext): void | Promise<void>;

  /**
   * Called when the editor language changes.
   */
  onLanguageChange?(language: string, context: PluginContext): void;

  /**
   * Called on content change (debounced by the host).
   */
  onContentChange?(content: string, context: PluginContext): void;

  /**
   * Called when the editor configuration changes.
   */
  onConfigChange?(config: Partial<MonacoEditorConfig>, context: PluginContext): void;

  /**
   * Cleanup. Remove any side effects not tracked via addDisposable.
   */
  onDispose?(): void;
}

// ═══════════════════════════════════════════════════════════════
//  THEME
// ═══════════════════════════════════════════════════════════════

/** A Monaco theme definition, ready to be registered via `monaco.editor.defineTheme` */
export interface MonacoThemeDef {
  /** Unique ID (kebab-case) used in `editor.updateOptions({ theme })` */
  id: string;
  /** Display name */
  name: string;
  /** Base theme to inherit from */
  base: "vs" | "vs-dark" | "hc-black" | "hc-light";
  /** Whether this theme inherits the base theme's rules */
  inherit: boolean;
  /** Token color rules */
  rules: monacoNs.editor.ITokenThemeRule[];
  /** Editor colors (workbench-style keys) */
  colors: Record<string, string>;
}

// ═══════════════════════════════════════════════════════════════
//  EDITOR CONFIGURATION
// ═══════════════════════════════════════════════════════════════

/** Notification handler signature (provided by host app) */
export type NotifyFn = (
  message: string,
  type?: "info" | "success" | "warning" | "error",
) => void;

/** Configuration for the MonacoEditor component */
export interface MonacoEditorConfig {
  /** Initial / controlled value */
  value?: string;
  /** Default value (only on first mount) */
  defaultValue?: string;
  /** Language ID (e.g. "typescript", "python", "json") */
  language?: string;
  /** File path (used for language detection and model URI) */
  filePath?: string;
  /** Theme ID (must be registered) */
  theme?: string;
  /** Read-only mode */
  readOnly?: boolean;
  /** Line numbers display */
  lineNumbers?: "on" | "off" | "relative" | "interval";
  /** Word wrap mode */
  wordWrap?: "off" | "on" | "wordWrapColumn" | "bounded";
  /** Font size in pixels */
  fontSize?: number;
  /** Font family */
  fontFamily?: string;
  /** Tab size */
  tabSize?: number;
  /** Show minimap */
  minimap?: boolean;
  /** Editor height (CSS value) */
  height?: string | number;
  /** Editor width (CSS value) */
  width?: string | number;
  /** Additional Monaco editor options (escape hatch) */
  options?: monacoNs.editor.IStandaloneEditorConstructionOptions;
  /** Plugins to activate for this editor instance */
  plugins?: MonacoPlugin[];
  /** Content change debounce delay for plugins (ms, default 300) */
  pluginDebounceMs?: number;
  /** Notification handler from host app */
  onNotify?: NotifyFn;
  /** Called when content changes */
  onChange?: (value: string) => void;
  /** Called when the editor is mounted */
  onMount?: (editor: MonacoEditorInstance, monaco: Monaco) => void;
  /** Called before the editor mounts (for pre-configuration) */
  onBeforeMount?: (monaco: Monaco) => void;
  /** Called when the editor is about to be disposed */
  onDispose?: () => void;
  /** Called when save is triggered (Ctrl+S) */
  onSave?: (content: string) => void | Promise<void>;

  // ── Advanced / Full-featured options ───────────────────────

  /** Enable TextMate grammar loading for richer syntax highlighting (default: true) */
  enableTextMate?: boolean;
  /** Enable snippet loading for the detected language (default: true) */
  enableSnippets?: boolean;
  /** Enable auto-close HTML/JSX tags (default: true) */
  enableAutoClose?: boolean;
  /** Enable monacopilot AI completions (default: false) */
  enableCopilot?: boolean;
  /** Copilot API endpoint (default: "/api/complete") */
  copilotEndpoint?: string;
  /** Enable LSP over WebSocket (default: false) */
  enableLSP?: boolean;
  /** LSP base WebSocket URL */
  lspBaseUrl?: string;
  /** Document URI for LSP */
  documentUri?: string;
  /** Custom theme to load from /public/themes/ */
  customTheme?: string;
  /** Whether to show the VS Code-like right sidebar (default: false) */
  showSidebar?: boolean;
  /** Called when the cursor position changes */
  onCursorChange?: (line: number, col: number) => void;
  /** Called when a theme is applied from the sidebar extensions */
  onThemeApply?: (themeId: string) => void;
  /** Enable loading installed extensions from IDB on mount (default: true when showSidebar is true) */
  enableExtensions?: boolean;

  // ── Terminal integration ───────────────────────────────────

  /** Enable integrated terminal panel (default: false) */
  enableTerminal?: boolean;
  /** Socket.IO URL for the terminal backend */
  terminalUrl?: string;
  /** Session ID for the terminal connection */
  terminalSessionId?: string;
  /** Working directory for the terminal */
  terminalCwd?: string;

  // ── Extension-contributed UI ───────────────────────────────

  /** Show extension-contributed status bar (default: false) */
  showStatusBar?: boolean;
  /** Extra status bar items from the host app */
  statusBarItems?: Array<{
    id: string;
    text: string;
    tooltip?: string;
    alignment?: "left" | "right";
    priority?: number;
    color?: string;
    onClick?: () => void;
  }>;

  // ── VSIX drag-and-drop ────────────────────────────────────

  /** Enable drag-and-drop .vsix file install (default: true when showSidebar is true) */
  enableVsixDrop?: boolean;
  /** Called after a VSIX extension is installed via drag-drop */
  onExtensionInstalled?: () => void;
}

// ═══════════════════════════════════════════════════════════════
//  DIFF EDITOR CONFIG
// ═══════════════════════════════════════════════════════════════

export interface MonacoDiffEditorConfig {
  /** Original (left side) content */
  original: string;
  /** Modified (right side) content */
  modified: string;
  /** Language for both sides */
  language?: string;
  /** Theme ID */
  theme?: string;
  /** Render side by side (true) or inline (false) */
  renderSideBySide?: boolean;
  /** Height */
  height?: string | number;
  /** Width */
  width?: string | number;
  /** Additional diff editor options */
  options?: monacoNs.editor.IDiffEditorConstructionOptions;
  /** Called on mount */
  onMount?: (editor: MonacoDiffEditorInstance, monaco: Monaco) => void;
}

// ═══════════════════════════════════════════════════════════════
//  PLUGIN REGISTRY EVENTS
// ═══════════════════════════════════════════════════════════════

export type PluginRegistryEvent =
  | { type: "registered"; pluginId: string }
  | { type: "unregistered"; pluginId: string }
  | { type: "enabled"; pluginId: string }
  | { type: "disabled"; pluginId: string }
  | { type: "error"; pluginId: string; error: Error };

export type PluginRegistryListener = (event: PluginRegistryEvent) => void;

// ═══════════════════════════════════════════════════════════════
//  UTILITY TYPES
// ═══════════════════════════════════════════════════════════════

/** Options for creating a base plugin using the helper */
export interface BasePluginOptions {
  id: string;
  name: string;
  version?: string;
  description?: string;
  dependencies?: string[];
  priority?: number;
  defaultEnabled?: boolean;
}

/** Language definition for registering custom languages */
export interface CustomLanguageDef {
  id: string;
  extensions: string[];
  aliases?: string[];
  mimetypes?: string[];
  /** Monarch tokenizer definition */
  monarchTokens?: monacoNs.languages.IMonarchLanguage;
  /** Language configuration (brackets, comments, etc.) */
  languageConfig?: monacoNs.languages.LanguageConfiguration;
}
