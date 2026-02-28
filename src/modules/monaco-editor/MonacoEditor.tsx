/**
 * @module monaco-editor/MonacoEditor
 *
 * The main reusable Monaco Editor component.
 *
 * Features:
 * - Full plugin lifecycle management
 * - Theme registration & custom theme loading
 * - Language detection
 * - Snippet registration
 * - Auto-close HTML/JSX tags
 * - Monacopilot AI completions
 * - LSP over WebSocket
 * - VS Code-like right sidebar (Outline, Problems, Info, Extensions)
 * - Extension management (install/uninstall from Open VSX)
 * - Save handler (Ctrl+S)
 * - Content change debouncing for plugins
 * - Inter-plugin communication via EventBus
 *
 * Usage:
 *   import { MonacoEditor } from "@/modules/monaco-editor";
 *
 *   <MonacoEditor
 *     value={code}
 *     language="typescript"
 *     theme="one-dark"
 *     plugins={[myPlugin]}
 *     onChange={setCode}
 *     onSave={handleSave}
 *     showSidebar
 *     enableCopilot
 *   />
 */

import React, { useCallback, useRef, useEffect, useState, useMemo } from "react";
import Editor, { type OnMount, type BeforeMount } from "@monaco-editor/react";
import type * as monacoNs from "monaco-editor";
import type {
  Monaco,
  MonacoEditorInstance,
  MonacoEditorConfig,
  MonacoPlugin,
  PluginContext,
} from "./types";
import { createPluginContext } from "./core/plugin-context";
import { EventBus } from "./core/event-bus";
import { pluginRegistry } from "./core/plugin-registry";
import { registerThemes } from "./core/theme-registry";
import { BUILT_IN_THEMES } from "./themes";
import { detectLanguage, initMonacoLanguages } from "./utils/language-detect";

// Lib utilities (advanced features)
import {
  loadCustomTheme,
  loadSnippets,
  registerAutoClose,
  registerCopilot,
  connectLanguageServer,
  buildLSPWebSocketUrl,
  hasLSPSupport,
  loadAllExtensions,
} from "./lib";
import { detectTechnologies } from "./lib/registerCopilot";
import type { LSPConnection } from "./lib/connectLanguageServer";
import type { CompletionRegistration } from "monacopilot";

// Sidebar component
import {
  EditorRightSidebar,
  type DocumentSymbolItem,
} from "./components/EditorRightSidebar";

// New components
import { VsixDropZone } from "./components/VsixDropZone";
import { ExtensionStatusBar } from "./components/ExtensionStatusBar";
import { EditorTerminalPanel } from "./components/EditorTerminalPanel";
import {
  type EditorSettings,
  loadEditorSettings,
  saveEditorSettings,
} from "./components/EditorSettingsPanel";
import {
  EditorNotifications,
  type EditorNotificationsHandle,
} from "./components/EditorNotifications";
import { setNotificationsHandle } from "./plugins/notification-plugin";

// Disposable context with hidden __dispose
type DisposableContext = PluginContext & { __dispose: () => void };

interface PluginState {
  plugin: MonacoPlugin;
  context: DisposableContext | null;
}

/* ── Symbol extraction (fallback when LSP is unavailable) ──── */

function extractSymbolsFromContent(
  content: string,
  languageId: string,
): DocumentSymbolItem[] {
  const symbols: DocumentSymbolItem[] = [];
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;
    let match: RegExpMatchArray | null;

    // JS/TS
    if (["javascript", "typescript", "javascriptreact", "typescriptreact"].includes(languageId)) {
      match = line.match(/^\s*(?:export\s+)?(?:async\s+)?function\s+(\w+)/);
      if (match) { symbols.push({ name: match[1], kind: "function", line: lineNum, detail: "function" }); continue; }

      match = line.match(/^\s*(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[a-zA-Z_]\w*)\s*=>/);
      if (match) { symbols.push({ name: match[1], kind: "function", line: lineNum, detail: "arrow function" }); continue; }

      match = line.match(/^\s*(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/);
      if (match) { symbols.push({ name: match[1], kind: "class", line: lineNum, detail: "class" }); continue; }

      match = line.match(/^\s*(?:export\s+)?interface\s+(\w+)/);
      if (match) { symbols.push({ name: match[1], kind: "interface", line: lineNum, detail: "interface" }); continue; }

      match = line.match(/^\s*(?:export\s+)?type\s+(\w+)/);
      if (match) { symbols.push({ name: match[1], kind: "type", line: lineNum, detail: "type alias" }); continue; }

      match = line.match(/^\s*(?:export\s+)?enum\s+(\w+)/);
      if (match) { symbols.push({ name: match[1], kind: "enum", line: lineNum, detail: "enum" }); continue; }

      match = line.match(/^\s+(?:async\s+)?(\w+)\s*\([^)]*\)\s*[:{]/);
      if (match && !["if", "for", "while", "switch"].includes(match[1])) {
        symbols.push({ name: match[1], kind: "method", line: lineNum, detail: "method" }); continue;
      }
    }

    // Python
    if (languageId === "python") {
      match = line.match(/^\s*(?:async\s+)?def\s+(\w+)/);
      if (match) { symbols.push({ name: match[1], kind: "function", line: lineNum, detail: "def" }); continue; }
      match = line.match(/^\s*class\s+(\w+)/);
      if (match) { symbols.push({ name: match[1], kind: "class", line: lineNum, detail: "class" }); continue; }
    }

    // Go
    if (languageId === "go") {
      match = line.match(/^func\s+(?:\([^)]+\)\s+)?(\w+)/);
      if (match) { symbols.push({ name: match[1], kind: "function", line: lineNum, detail: "func" }); continue; }
      match = line.match(/^type\s+(\w+)\s+struct/);
      if (match) { symbols.push({ name: match[1], kind: "class", line: lineNum, detail: "struct" }); continue; }
      match = line.match(/^type\s+(\w+)\s+interface/);
      if (match) { symbols.push({ name: match[1], kind: "interface", line: lineNum, detail: "interface" }); continue; }
    }

    // Rust
    if (languageId === "rust") {
      match = line.match(/^\s*(?:pub\s+)?(?:async\s+)?fn\s+(\w+)/);
      if (match) { symbols.push({ name: match[1], kind: "function", line: lineNum, detail: "fn" }); continue; }
      match = line.match(/^\s*(?:pub\s+)?struct\s+(\w+)/);
      if (match) { symbols.push({ name: match[1], kind: "class", line: lineNum, detail: "struct" }); continue; }
      match = line.match(/^\s*(?:pub\s+)?enum\s+(\w+)/);
      if (match) { symbols.push({ name: match[1], kind: "enum", line: lineNum, detail: "enum" }); continue; }
      match = line.match(/^\s*(?:pub\s+)?trait\s+(\w+)/);
      if (match) { symbols.push({ name: match[1], kind: "interface", line: lineNum, detail: "trait" }); continue; }
    }

    // Java / Kotlin / C# / C++
    if (["java", "kotlin", "csharp", "cpp", "c"].includes(languageId)) {
      match = line.match(/^\s*(?:public|private|protected|static|abstract|final|virtual|override|\s)*\s*(?:class|struct)\s+(\w+)/);
      if (match) { symbols.push({ name: match[1], kind: "class", line: lineNum, detail: "class" }); continue; }
      match = line.match(/^\s*(?:public|private|protected|static|abstract|virtual|override|\s)*\s*\w+\s+(\w+)\s*\(/);
      if (match && !["if", "for", "while", "switch"].includes(match[1])) {
        symbols.push({ name: match[1], kind: "function", line: lineNum, detail: "method" }); continue;
      }
    }

    // Lua
    if (languageId === "lua") {
      match = line.match(/^\s*(?:local\s+)?function\s+([a-zA-Z_][\w.:]*)/);
      if (match) { symbols.push({ name: match[1], kind: "function", line: lineNum, detail: "function" }); continue; }
    }

    // PHP
    if (languageId === "php") {
      match = line.match(/^\s*(?:public|private|protected|static|\s)*function\s+(\w+)/);
      if (match) { symbols.push({ name: match[1], kind: "function", line: lineNum, detail: "function" }); continue; }
      match = line.match(/^\s*(?:abstract\s+)?class\s+(\w+)/);
      if (match) { symbols.push({ name: match[1], kind: "class", line: lineNum, detail: "class" }); continue; }
    }

    // Ruby
    if (languageId === "ruby") {
      match = line.match(/^\s*def\s+(\w+)/);
      if (match) { symbols.push({ name: match[1], kind: "function", line: lineNum, detail: "def" }); continue; }
      match = line.match(/^\s*class\s+(\w+)/);
      if (match) { symbols.push({ name: match[1], kind: "class", line: lineNum, detail: "class" }); continue; }
      match = line.match(/^\s*module\s+(\w+)/);
      if (match) { symbols.push({ name: match[1], kind: "module", line: lineNum, detail: "module" }); continue; }
    }

    // Markdown
    if (languageId === "markdown") {
      match = line.match(/^(#{1,6})\s+(.+)/);
      if (match) {
        symbols.push({ name: match[2].trim(), kind: "heading", line: lineNum, detail: `h${match[1].length}` }); continue;
      }
    }
  }

  return symbols;
}

/* ── Component ─────────────────────────────────────────────── */

export const MonacoEditor: React.FC<MonacoEditorConfig> = ({
  value,
  defaultValue,
  language,
  filePath,
  theme = "one-dark",
  readOnly = false,
  lineNumbers = "on",
  wordWrap = "off",
  fontSize = 14,
  fontFamily = "'Fira Code', 'Cascadia Code', 'JetBrains Mono', Consolas, monospace",
  tabSize = 2,
  minimap = true,
  height = "100%",
  width = "100%",
  options = {},
  plugins = [],
  pluginDebounceMs = 300,
  onNotify,
  onChange,
  onMount: onMountProp,
  onBeforeMount: onBeforeMountProp,
  onDispose,
  onSave,
  // Advanced props
  enableSnippets = true,
  enableAutoClose = true,
  enableCopilot = false,
  copilotEndpoint = "/api/complete",
  enableLSP = false,
  lspBaseUrl,
  documentUri,
  customTheme,
  showSidebar = false,
  onCursorChange,
  onThemeApply,
  enableExtensions,
  // Terminal integration
  enableTerminal = false,
  terminalUrl,
  terminalSessionId = "default",
  terminalCwd = "/",
  // Extension-contributed UI
  showStatusBar = false,
  statusBarItems = [],
  // VSIX drag-and-drop
  enableVsixDrop,
  onExtensionInstalled,
}) => {
  const editorRef = useRef<MonacoEditorInstance | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const eventBusRef = useRef(new EventBus());
  const pluginStatesRef = useRef<PluginState[]>([]);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const disposablesRef = useRef<monacoNs.IDisposable[]>([]);
  const copilotRef = useRef<CompletionRegistration | null>(null);
  const lspRef = useRef<LSPConnection | null>(null);
  const notificationsRef = useRef<EditorNotificationsHandle | null>(null);

  // Sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<"outline" | "problems" | "info" | "extensions" | "themes" | "settings">("outline");
  const [symbols, setSymbols] = useState<DocumentSymbolItem[]>([]);
  const [problems, setProblems] = useState<monacoNs.editor.IMarkerData[]>([]);
  const [extensionCount, setExtensionCount] = useState(0);
  const [notificationCount, setNotificationCount] = useState(0);

  // Internal cursor tracking (for status bar)
  const [cursorLine, setCursorLine] = useState(1);
  const [cursorCol, setCursorCol] = useState(1);

  // Editor settings (persisted to localStorage)
  const [editorSettings, setEditorSettings] = useState<EditorSettings>(() => loadEditorSettings());

  // Detect language from file path if not explicitly set
  const resolvedLanguage = language ?? (filePath ? detectLanguage(filePath) : "plaintext");

  // Filename for sidebar display
  const fileName = useMemo(() => {
    if (!filePath) return "untitled";
    return filePath.split("/").pop() ?? "untitled";
  }, [filePath]);

  // Whether extensions should be loaded
  const shouldLoadExtensions = enableExtensions ?? showSidebar;

  // Whether VSIX drop is enabled
  const shouldEnableVsixDrop = enableVsixDrop ?? showSidebar;

  // Terminal panel state
  const [terminalOpen, setTerminalOpen] = useState(false);

  // ── Merge all plugins: registry (global) + props (instance) ──
  const getAllPlugins = useCallback((): MonacoPlugin[] => {
    const globalPlugins = pluginRegistry.getEnabled();
    const instancePlugins = plugins;

    const seen = new Set<string>();
    const merged: MonacoPlugin[] = [];

    for (const p of instancePlugins) {
      if (!seen.has(p.id)) { seen.add(p.id); merged.push(p); }
    }
    for (const p of globalPlugins) {
      if (!seen.has(p.id)) { seen.add(p.id); merged.push(p); }
    }

    return merged.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  }, [plugins]);

  // ── Extract document symbols for Outline panel ──
  const updateSymbols = useCallback(() => {
    if (!showSidebar) return;
    const content = editorRef.current?.getValue() ?? value ?? "";
    const extracted = extractSymbolsFromContent(content, resolvedLanguage);
    setSymbols(extracted);
  }, [showSidebar, value, resolvedLanguage]);

  // ── Extract markers/problems ──
  const updateProblems = useCallback(() => {
    if (!showSidebar) return;
    const monaco = monacoRef.current;
    const editor = editorRef.current;
    if (!monaco || !editor) return;
    const model = editor.getModel();
    if (!model) return;
    const markers = monaco.editor.getModelMarkers({ resource: model.uri });
    setProblems(markers);
  }, [showSidebar]);

  // ── Update symbols + problems when content changes ──
  useEffect(() => {
    if (!showSidebar) return;
    const timer = setTimeout(() => {
      updateSymbols();
      updateProblems();
    }, 500);
    return () => clearTimeout(timer);
  }, [value, showSidebar, updateSymbols, updateProblems]);

  // ── Plugin lifecycle: onBeforeMount ──
  const handleBeforeMount: BeforeMount = useCallback(
    (monaco) => {
      monacoRef.current = monaco;

      // Populate the language detection cache from Monaco's built-in registry
      initMonacoLanguages(monaco);

      // Register built-in themes
      registerThemes(monaco, BUILT_IN_THEMES);

      // User's onBeforeMount hook
      onBeforeMountProp?.(monaco);

      // Plugin onBeforeMount
      const allPlugins = getAllPlugins();
      for (const plugin of allPlugins) {
        try {
          plugin.onBeforeMount?.(monaco);
        } catch (err) {
          console.error(`[MonacoEditor] Plugin "${plugin.id}" onBeforeMount error:`, err);
        }
      }
    },
    [onBeforeMountProp, getAllPlugins],
  );

  // ── Plugin lifecycle: onMount + advanced feature initialization ──
  const handleMount: OnMount = useCallback(
    async (editor, monaco) => {
      editorRef.current = editor;
      monacoRef.current = monaco;
      const disposables: monacoNs.IDisposable[] = [];

      // ── Ctrl+S / Cmd+S save handler ──
      if (onSave) {
        editor.addAction({
          id: "terminus-save",
          label: "Save File",
          keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
          run: () => {
            onSave(editor.getValue());
          },
        });
      }

      // ── Toggle terminal (Ctrl+`) ──
      if (enableTerminal) {
        editor.addAction({
          id: "terminus-toggle-terminal",
          label: "Toggle Terminal",
          keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Backquote],
          run: () => {
            setTerminalOpen((o) => !o);
          },
        });
      }

      // ── Custom theme loading ──
      if (customTheme) {
        loadCustomTheme(monaco, customTheme).then((ok) => {
          if (ok) monaco.editor.setTheme(customTheme);
        });
      }

      // ── Snippet loading ──
      if (enableSnippets) {
        loadSnippets(monaco, resolvedLanguage).then((d) => {
          if (d) disposables.push(d);
        });
      }

      // ── Auto-close HTML/JSX tags ──
      if (enableAutoClose) {
        const autoCloseDisposables = registerAutoClose(monaco, editor);
        disposables.push(...autoCloseDisposables);
      }

      // ── Copilot AI completions ──
      if (enableCopilot) {
        try {
          const techs = detectTechnologies(resolvedLanguage, fileName);
          const registration = registerCopilot(monaco, editor, {
            language: resolvedLanguage,
            filename: fileName,
            endpoint: copilotEndpoint,
            technologies: techs,
            trigger: "onIdle",
          });
          copilotRef.current = registration;
        } catch (err) {
          console.warn("[MonacoEditor] Copilot registration failed:", err);
        }
      }

      // ── LSP over WebSocket ──
      if (enableLSP && lspBaseUrl && hasLSPSupport(resolvedLanguage)) {

        const wsUrl = buildLSPWebSocketUrl(lspBaseUrl, resolvedLanguage);
        if (wsUrl) {
          connectLanguageServer({
            languageId: resolvedLanguage,
            wsUrl,
            documentUri,
            monaco,
            editor,
            onConnected: () => console.log(`[LSP] Connected: ${resolvedLanguage}`),
            onDisconnected: () => console.log(`[LSP] Disconnected: ${resolvedLanguage}`),
            onError: (err) => console.warn(`[LSP] Error:`, err),
          })
            .then((conn) => { lspRef.current = conn; })
            .catch((err) => { console.warn("[MonacoEditor] LSP connection failed:", err); });
        }
      }

      // ── Cursor position tracking ──
      {
        const cursorDisposable = editor.onDidChangeCursorPosition((e) => {
          setCursorLine(e.position.lineNumber);
          setCursorCol(e.position.column);
          onCursorChange?.(e.position.lineNumber, e.position.column);
        });
        disposables.push(cursorDisposable);
      }

      // ── Marker tracking (for problems panel) ──
      if (showSidebar) {
        const markerDisposable = monaco.editor.onDidChangeMarkers(() => {
          updateProblems();
        });
        disposables.push(markerDisposable);
      }

      // ── Load installed extensions from IDB ──
      if (shouldLoadExtensions) {
        loadAllExtensions(monaco, editor)
          .then(({ extensions }) => {
            setExtensionCount(extensions.length);
            console.log(`[MonacoEditor] Loaded ${extensions.length} extension(s)`);
          })
          .catch((err) => {
            console.warn("[MonacoEditor] Failed to load extensions:", err);
          });
      }

      disposablesRef.current = disposables;

      // ── User's onMount hook ──
      onMountProp?.(editor, monaco);

      // ── Plugin contexts and lifecycle ──
      const allPlugins = getAllPlugins();
      const states: PluginState[] = [];

      for (const plugin of allPlugins) {
        try {
          const ctx = createPluginContext(monaco, editor, {
            filePath,
            onNotify,
            eventBus: eventBusRef.current,
          }) as DisposableContext;

          plugin.onMount?.(ctx);
          states.push({ plugin, context: ctx });
        } catch (err) {
          console.error(`[MonacoEditor] Plugin "${plugin.id}" onMount error:`, err);
          states.push({ plugin, context: null });
        }
      }

      pluginStatesRef.current = states;

      // Initial symbol extraction
      if (showSidebar) {
        setTimeout(updateSymbols, 200);
      }
    },
    [
      onMountProp, onSave, filePath, onNotify, getAllPlugins,
      customTheme, resolvedLanguage, fileName, enableTerminal,
      enableSnippets, enableAutoClose,
      enableCopilot, copilotEndpoint,
      enableLSP, lspBaseUrl, documentUri,
      onCursorChange, showSidebar, shouldLoadExtensions,
      updateProblems, updateSymbols,
    ],
  );

  // ── Content change handler ──
  const handleChange = useCallback(
    (newValue: string | undefined) => {
      const val = newValue ?? "";
      onChange?.(val);

      // Debounced plugin notification
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        for (const state of pluginStatesRef.current) {
          if (state.context) {
            try {
              state.plugin.onContentChange?.(val, state.context);
            } catch (err) {
              console.error(
                `[MonacoEditor] Plugin "${state.plugin.id}" onContentChange error:`,
                err,
              );
            }
          }
        }
      }, pluginDebounceMs);
    },
    [onChange, pluginDebounceMs],
  );

  // ── Language change effect ──
  useEffect(() => {
    for (const state of pluginStatesRef.current) {
      if (state.context) {
        try {
          state.plugin.onLanguageChange?.(resolvedLanguage, state.context);
        } catch (err) {
          console.error(
            `[MonacoEditor] Plugin "${state.plugin.id}" onLanguageChange error:`,
            err,
          );
        }
      }
    }
  }, [resolvedLanguage]);

  // ── Cleanup on unmount ──
  useEffect(() => {
    return () => {
      // Dispose all plugin contexts
      for (const state of pluginStatesRef.current) {
        try {
          state.plugin.onDispose?.();
          state.context?.__dispose();
        } catch { /* swallow */ }
      }
      pluginStatesRef.current = [];

      // Dispose advanced feature disposables
      disposablesRef.current.forEach((d) => {
        try { d.dispose(); } catch { /* */ }
      });
      disposablesRef.current = [];

      // Cleanup copilot
      try { copilotRef.current?.deregister(); } catch { /* */ }
      copilotRef.current = null;

      // Cleanup LSP
      try { lspRef.current?.dispose(); } catch { /* */ }
      lspRef.current = null;

      // Clear event bus
      eventBusRef.current.clear();

      // Clear debounce
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

      // User callback
      onDispose?.();
    };
  }, [onDispose]);

  // ── Sidebar callbacks ──
  const handleSymbolClick = useCallback((symbol: DocumentSymbolItem) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.revealLineInCenter(symbol.line);
    editor.setPosition({ lineNumber: symbol.line, column: 1 });
    editor.focus();
  }, []);

  const handleProblemClick = useCallback((marker: monacoNs.editor.IMarkerData) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.revealLineInCenter(marker.startLineNumber);
    editor.setPosition({
      lineNumber: marker.startLineNumber,
      column: marker.startColumn,
    });
    editor.focus();
  }, []);

  const handleThemeApply = useCallback((themeId: string) => {
    monacoRef.current?.editor.setTheme(themeId);
    onThemeApply?.(themeId);
  }, [onThemeApply]);

  // ── Merged Monaco options (settings override props) ──
  const mergedOptions: Record<string, unknown> = {
    readOnly,
    lineNumbers: editorSettings.lineNumbers,
    wordWrap: editorSettings.wordWrap,
    fontSize: editorSettings.fontSize,
    fontFamily,
    tabSize: editorSettings.tabSize,
    minimap: { enabled: editorSettings.minimap },
    fontLigatures: editorSettings.fontLigatures,
    smoothScrolling: true,
    cursorBlinking: editorSettings.cursorBlinking,
    cursorSmoothCaretAnimation: "on",
    padding: { top: 12, bottom: 12 },
    scrollBeyondLastLine: false,
    automaticLayout: true,
    bracketPairColorization: { enabled: editorSettings.bracketPairColorization },
    guides: {
      bracketPairs: true,
      indentation: true,
    },
    autoClosingBrackets: "always",
    autoClosingQuotes: "always",
    autoClosingDelete: "always",
    autoSurround: "languageDefined",
    formatOnPaste: true,
    linkedEditing: true,
    mouseWheelZoom: editorSettings.mouseWheelZoom,
    stickyScroll: { enabled: editorSettings.stickyScroll },
    renderWhitespace: editorSettings.renderWhitespace,
    ...options,
  };

  // Content stats for sidebar info panel
  const contentValue = value ?? "";
  const lineCount = contentValue.split("\n").length;
  const charCount = contentValue.length;
  const fileSize = useMemo(() => new Blob([contentValue]).size, [contentValue]);

  const handleVsixInstalled = useCallback(() => {
    // Refresh extension count
    if (shouldLoadExtensions && monacoRef.current) {
      loadAllExtensions(monacoRef.current, editorRef.current ?? undefined)
        .then(({ extensions }) => setExtensionCount(extensions.length))
        .catch(() => { });
    }
    onExtensionInstalled?.();
  }, [shouldLoadExtensions, onExtensionInstalled]);

  const handleTerminalToggle = useCallback(() => {
    setTerminalOpen((o) => !o);
  }, []);

  // ── Settings change handler ──
  const handleSettingsChange = useCallback((newSettings: EditorSettings) => {
    setEditorSettings(newSettings);
    saveEditorSettings(newSettings);

    // Apply Monaco editor options in real-time
    const editor = editorRef.current;
    if (editor) {
      editor.updateOptions({
        fontSize: newSettings.fontSize,
        tabSize: newSettings.tabSize,
        wordWrap: newSettings.wordWrap,
        lineNumbers: newSettings.lineNumbers,
        minimap: { enabled: newSettings.minimap },
        stickyScroll: { enabled: newSettings.stickyScroll },
        bracketPairColorization: { enabled: newSettings.bracketPairColorization },
        cursorBlinking: newSettings.cursorBlinking,
        renderWhitespace: newSettings.renderWhitespace,
        fontLigatures: newSettings.fontLigatures,
        mouseWheelZoom: newSettings.mouseWheelZoom,
      });
    }

    // Handle panel toggles
    if (newSettings.showTerminal !== editorSettings.showTerminal) {
      setTerminalOpen(newSettings.showTerminal);
    }
  }, [editorSettings.showTerminal]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height, width }} className="monaco-editor-wrapper">
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        {/* Editor area (optionally wrapped in VsixDropZone) */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>
          {/* VS Code-style notification overlay */}
          <EditorNotifications
            ref={(handle) => {
              notificationsRef.current = handle;
              setNotificationsHandle(handle);
            }}
            onCountChange={setNotificationCount}
          />
          {shouldEnableVsixDrop ? (
            <VsixDropZone
              monaco={monacoRef.current}
              editor={editorRef.current}
              onInstalled={handleVsixInstalled}
            >
              <Editor
                height="100%"
                width="100%"
                language={resolvedLanguage}
                theme={customTheme ?? theme}
                value={value}
                defaultValue={defaultValue}
                options={mergedOptions}
                beforeMount={handleBeforeMount}
                onMount={handleMount}
                onChange={handleChange}
                loading={
                  <div className="flex items-center justify-center h-full w-full bg-background text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      <span className="text-sm">Loading editor…</span>
                    </div>
                  </div>
                }
              />
            </VsixDropZone>
          ) : (
            <Editor
              height="100%"
              width="100%"
              language={resolvedLanguage}
              theme={customTheme ?? theme}
              value={value}
              defaultValue={defaultValue}
              options={mergedOptions}
              beforeMount={handleBeforeMount}
              onMount={handleMount}
              onChange={handleChange}
              loading={
                <div className="flex items-center justify-center h-full w-full bg-background text-muted-foreground">
                  <div className="flex flex-col items-center gap-2">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    <span className="text-sm">Loading editor…</span>
                  </div>
                </div>
              }
            />
          )}
        </div>

        {/* Right Sidebar (VS Code style) */}
        {showSidebar && (
          <EditorRightSidebar
            open={sidebarOpen}
            onToggle={() => setSidebarOpen((o) => !o)}
            activeTab={sidebarTab}
            onTabChange={setSidebarTab}
            symbols={symbols}
            problems={problems}
            onSymbolClick={handleSymbolClick}
            onProblemClick={handleProblemClick}
            filename={fileName}
            language={resolvedLanguage}
            lineCount={lineCount}
            charCount={charCount}
            fileSize={fileSize}
            monaco={monacoRef.current}
            editor={editorRef.current}
            onThemeApply={handleThemeApply}
            extensionCount={extensionCount}
            editorSettings={editorSettings}
            onSettingsChange={handleSettingsChange}
            enableTerminal={enableTerminal}
          />
        )}
      </div>

      {/* Terminal panel (below editor) */}
      {enableTerminal && (
        <EditorTerminalPanel
          open={terminalOpen}
          onToggle={handleTerminalToggle}
          terminalUrl={terminalUrl}
          sessionId={terminalSessionId}
          cwd={terminalCwd}
        />
      )}

      {/* Extension-contributed status bar */}
      {(showStatusBar || editorSettings.showStatusBar) && (
        <ExtensionStatusBar
          monaco={monacoRef.current}
          editor={editorRef.current}
          language={resolvedLanguage}
          cursorLine={cursorLine}
          cursorCol={cursorCol}
          lineCount={lineCount}
          charCount={charCount}
          wordWrap={editorSettings.wordWrap}
          tabSize={editorSettings.tabSize}
          extraItems={statusBarItems}
          notificationCount={notificationCount}
          onNotificationToggle={() => notificationsRef.current?.toggleCenter()}
          enableTerminal={enableTerminal}
          terminalOpen={terminalOpen}
          onTerminalToggle={handleTerminalToggle}
        />
      )}
    </div>
  );
};

MonacoEditor.displayName = "MonacoEditor";
