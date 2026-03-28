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
import Editor, { type OnMount, type BeforeMount} from "@monaco-editor/react";

import * as monacoNs from "monaco-editor";
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
import { registerTheme, registerThemes } from "./core/theme-registry";
import { registerLanguage } from "./core/language-registry";
import { dotenvLanguageDef } from "./languages/dotenv";
import { BUILT_IN_THEMES } from "./themes";
import { loadMonacoTheme } from "./themes/monaco-themes-catalog";
import { detectLanguage, initMonacoLanguages, refreshLanguageCache } from "./utils/language-detect";

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
  registerAICompletions,
} from "./lib";
import { detectTechnologies } from "./lib/registerCopilot";
import type { LSPConnection } from "./lib/connectLanguageServer";
import type { CompletionRegistration } from "monacopilot";
import type { AICompletionRegistration } from "./lib/aiCompletions";
import { registerCustomHoverProviders } from "./lib/hoverProvider";
import { registerBuiltinProviders } from "./lib/lsp/builtin-providers";
import { registerContextEngineProviders } from "./lib/contextEngineProviders";
import { monacoThemeIdToXterm } from "./lib/monacoThemeToXterm";

// GitHub-based VSCode extension loader
import {
  initExtensionIndex,
  onFileOpened as ghExtOnFileOpened,
  loadAllCustomSnippets,
  setGitHubToken,
  spawnExtensionWorker,
  terminateExtensionWorker,
  workerInitIndex,
  workerLoadFolder,
} from "./extensions";
import { resolveFileLanguage, getExtensionFolder } from "./extensions/languageMap";
import { getExtensionStatus } from "./extensions/extensionStatusStore";

// Sidebar component
import {
  EditorRightSidebar,
  EditorSidebarActivityBar,
  EditorSidebarContent,
  type DocumentSymbolItem,
} from "./components/EditorRightSidebar";

// Resizable panels
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";

// New components
import { VsixDropZone } from "./components/VsixDropZone";
import { ExtensionStatusBar } from "./components/ExtensionStatusBar";
import { EditorTerminalPanel } from "./components/EditorTerminalPanel";
import {
  type EditorSettings,
  type AICompletionProvider,
  loadEditorSettings,
  saveEditorSettings,
} from "./components/EditorSettingsPanel";
import {
  EditorNotifications,
  type EditorNotificationsHandle,
} from "./components/EditorNotifications";
import { setNotificationsHandle, showEditorNotification } from "./plugins/notification-plugin";

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
  aiCompletionsEndpoint: aiCompletionsEndpointProp,
  enableLSP = false,
  lspBaseUrl,
  documentUri,
  customTheme,
  showSidebar = false,
  onCursorChange,
  onThemeApply,
  enableExtensions,
  onAIProviderChange,
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
  // AI Chat
  chatBaseUrl,
  chatHostId,
  onChatApplyCode,
}) => {
  const editorRef = useRef<MonacoEditorInstance | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const eventBusRef = useRef(new EventBus());
  const pluginStatesRef = useRef<PluginState[]>([]);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const disposablesRef = useRef<monacoNs.IDisposable[]>([]);
  const copilotRef = useRef<CompletionRegistration | null>(null);
  const aiCompletionsRef = useRef<AICompletionRegistration | null>(null);
  const lspRef = useRef<LSPConnection | null>(null);
  const hoverProviderRef = useRef<monacoNs.IDisposable | null>(null);
  const notificationsRef = useRef<EditorNotificationsHandle | null>(null);

  // Flips to true once Monaco editor is ready (handleMount has fired).
  // Used as a dependency so effects that need editorRef/monacoRef can retry.
  const [editorReady, setEditorReady] = useState(false);

  // Internal content tracking for sidebar stats (works in both controlled & uncontrolled mode)
  const internalContentRef = useRef(value ?? defaultValue ?? "");
  const [internalContent, setInternalContent] = useState(value ?? defaultValue ?? "");
  const sidebarStatsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<"outline" | "problems" | "info" | "extensions" | "themes" | "settings" | "chat" | "ai" | "context-menu" | "hover" | "context-engine" | "plugins">("outline");
  const [symbols, setSymbols] = useState<DocumentSymbolItem[]>([]);
  const [problems, setProblems] = useState<monacoNs.editor.IMarkerData[]>([]);
  const [extensionCount, setExtensionCount] = useState(0);
  const [pluginCount, setPluginCount] = useState(0);
  const [contextEngineCount, setContextEngineCount] = useState(0);
  const [notificationCount, setNotificationCount] = useState(0);

  // Internal cursor tracking (for status bar)
  const [cursorLine, setCursorLine] = useState(1);
  const [cursorCol, setCursorCol] = useState(1);

  // Track selected text (for AI chat context)
  const [selectedText, setSelectedText] = useState("");

  // Listen for Explain events from builtin providers
  useEffect(() => {
    const handleExplain = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail) return;
      // Open the AI sidebar tab so the user can see the explain prompt
      setSidebarOpen(true);
      setSidebarTab("ai");
    };
    window.addEventListener("terminus:explain", handleExplain);
    return () => window.removeEventListener("terminus:explain", handleExplain);
  }, []);

  // Editor settings (persisted to localStorage)
  const [editorSettings, setEditorSettings] = useState<EditorSettings>(() => loadEditorSettings());

  // Sync wordWrap prop into editorSettings + editor when parent toggles it
  useEffect(() => {
    if (wordWrap && wordWrap !== editorSettings.wordWrap) {
      const updated = { ...editorSettings, wordWrap: wordWrap as EditorSettings["wordWrap"] };
      setEditorSettings(updated);
      saveEditorSettings(updated);
      editorRef.current?.updateOptions({ wordWrap: updated.wordWrap });
    }
  }, [wordWrap]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const [terminalMounted, setTerminalMounted] = useState(false);

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
    const content = editorRef.current?.getValue() ?? internalContentRef.current;
    const extracted = extractSymbolsFromContent(content, resolvedLanguage);
    setSymbols(extracted);
  }, [showSidebar, resolvedLanguage]);

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

  // ── Update symbols + problems when internal content changes ──
  useEffect(() => {
    if (!showSidebar) return;
    const timer = setTimeout(() => {
      updateSymbols();
      updateProblems();
    }, 500);
    return () => clearTimeout(timer);
  }, [internalContent, showSidebar, updateSymbols, updateProblems]);

  // ── Plugin lifecycle: onBeforeMount ──
  const handleBeforeMount: BeforeMount = useCallback(
    (monaco) => {
      monacoRef.current = monaco;

      // Populate the language detection cache from Monaco's built-in registry
      initMonacoLanguages(monaco);

      // Register custom languages
      registerLanguage(monaco, dotenvLanguageDef);

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
      setEditorReady(true);
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
            setTerminalOpen((o) => {
              const next = !o;
              if (next) setTerminalMounted(true);
              return next;
            });
          },
        });
      }

      // ── Custom theme loading ──
      if (customTheme) {
        loadCustomTheme(monaco, customTheme).then((ok) => {
          if (ok) monaco.editor.setTheme(customTheme);
        });
      }

      // ── Load initial theme from monaco-themes package if needed ──
      {
        const { hasTheme: isRegistered } = await import("./core/theme-registry");
        const initialTheme = customTheme ?? theme;
        if (initialTheme && !isRegistered(initialTheme) && initialTheme !== "vs" && initialTheme !== "vs-dark" && initialTheme !== "hc-black" && initialTheme !== "hc-light") {
          const themeDef = await loadMonacoTheme(initialTheme);
          if (themeDef) {
            registerTheme(monaco, themeDef);
            monaco.editor.setTheme(initialTheme);
          }
        }
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

      // ── Copilot AI completions (only if settings say copilot, or enableCopilot prop) ──
      if (enableCopilot || editorSettings.aiCompletionProvider === "copilot") {
        try {
          const techs = detectTechnologies(resolvedLanguage, fileName);
          const effectiveCopilotEndpoint = editorSettings.copilotEndpoint || copilotEndpoint;
          const registration = registerCopilot(monaco, editor, {
            language: resolvedLanguage,
            filename: fileName,
            endpoint: effectiveCopilotEndpoint,
            technologies: techs,
            trigger: "onIdle",
          });
          copilotRef.current = registration;
        } catch (err) {
          console.warn("[MonacoEditor] Copilot registration failed:", err);
        }
      }

      // ── Built-in diagnostics, CodeLens, and CodeAction providers ──
      // (registered first so CodeLens/CodeActions work immediately)
      const builtinHandle = registerBuiltinProviders(monaco, resolvedLanguage);
      disposables.push(builtinHandle);

      // ── LSP over WebSocket ──
      const shouldEnableLSP = enableLSP && editorSettings.enableLSP;
      if (shouldEnableLSP && lspBaseUrl && hasLSPSupport(resolvedLanguage)) {

        const wsUrl = buildLSPWebSocketUrl(lspBaseUrl, resolvedLanguage);
        if (wsUrl) {
          const lspName = resolvedLanguage.charAt(0).toUpperCase() + resolvedLanguage.slice(1);
          connectLanguageServer({
            languageId: resolvedLanguage,
            wsUrl,
            documentUri,
            monaco,
            editor,
            onConnected: () => {
              console.log(`[LSP] Connected: ${resolvedLanguage}`);
              // Pause all builtin providers — LSP provides its own
              builtinHandle.pause();
              showEditorNotification(`Language server connected`, "info", {
                source: `LSP: ${lspName}`,
                timeout: 3000,
              });
            },
            onDisconnected: () => {
              console.log(`[LSP] Disconnected: ${resolvedLanguage}`);
              // Resume builtin providers when LSP disconnects
              builtinHandle.resume();
            },
            onError: (err) => {
              console.warn(`[LSP] Error:`, err);
              showEditorNotification(err.message || "Language server error", "error", {
                source: `LSP: ${lspName}`,
                detail: String(err),
                timeout: 8000,
              });
            },
            onServerMessage: (message, severity, langId) => {
              console.log(message, severity, langId)
              const severityMap: Record<string, "error" | "warning" | "info"> = {
                error: "error",
                warning: "warning",
                info: "info",
                log: "info",
                debug: "info",
              };
              const srcName = langId.charAt(0).toUpperCase() + langId.slice(1);
              showEditorNotification(message, severityMap[severity] ?? "info", {
                source: `LSP: ${srcName}`,
                timeout: severity === "error" ? 8000 : severity === "warning" ? 6000 : 4000,
              });
            },
          })
            .then((conn) => { lspRef.current = conn; })
            .catch((err) => {
              console.warn("[MonacoEditor] LSP connection failed:", err);
              showEditorNotification(
                `Failed to connect to ${lspName} language server`,
                "error",
                {
                  source: `LSP: ${lspName}`,
                  detail: err?.message ?? String(err),
                  timeout: 8000,
                },
              );
            });
        }
      }

      // ── Link opener: open external URLs in a new tab ──
      {
        const linkOpenerDisposable = monaco.editor.registerLinkOpener({
          open(resource: monacoNs.Uri) {
            const scheme = resource.scheme;
            // HTTP(S) links → open in new tab
            if (scheme === "http" || scheme === "https") {
              window.open(resource.toString(), "_blank", "noopener,noreferrer");
              return true;
            }
            // mailto links → open mail client
            if (scheme === "mailto") {
              window.open(resource.toString(), "_self");
              return true;
            }
            // Fallback: not handled, let Monaco's default behaviour kick in
            return false;
          },
        });
        disposables.push(linkOpenerDisposable);
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

      // ── Selection tracking (for AI chat context) ──
      {
        const selectionDisposable = editor.onDidChangeCursorSelection(() => {
          const sel = editor.getSelection();
          if (sel && !sel.isEmpty()) {
            setSelectedText(editor.getModel()?.getValueInRange(sel) ?? "");
          } else {
            setSelectedText("");
          }
        });
        disposables.push(selectionDisposable);
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

      // ── Load installed context-engine packs count ──
      import("@/lib/context-engine/contextEngineStorage").then(({ getInstalledLanguages }) => {
        getInstalledLanguages().then((langs) => setContextEngineCount(langs.length)).catch(() => {});
      });

      // ── GitHub-based VSCode extension loader (Web Worker) ──
      if (editorSettings.enableGitHubExtensions) {
        if (editorSettings.githubToken) {
          setGitHubToken(editorSettings.githubToken);
        }

        // ── onDidChangeModel: trigger extension loading on model switch ──
        const modelChangeDisposable = editor.onDidChangeModel((e) => {
          if (!e.newModelUrl) return;
          const newPath = e.newModelUrl.path || e.newModelUrl.toString();
          const { extensionFolder } = resolveFileLanguage(newPath);
          if (!extensionFolder) return;

          const token = editorSettings.githubToken || undefined;
          getExtensionStatus().setActivating(extensionFolder);
          workerLoadFolder(extensionFolder, token)
            .then((data) => {
              if (data) {
                getExtensionStatus().setDone(extensionFolder);
                showEditorNotification(
                  `Extension "${extensionFolder}" activated`,
                  "info",
                  { source: "Extensions", timeout: 3000 },
                );
              } else {
                getExtensionStatus().reset();
              }
            })
            .catch(() => {
              ghExtOnFileOpened(newPath, monaco, editor)
                .then(() => {
                  getExtensionStatus().setDone(extensionFolder);
                })
                .catch((err) => {
                  getExtensionStatus().setError(extensionFolder, err?.message ?? String(err));
                  showEditorNotification(
                    `Failed to activate "${extensionFolder}"`,
                    "warning",
                    { source: "Extensions", detail: err?.message, timeout: 5000 },
                  );
                });
            });
        });
        disposables.push(modelChangeDisposable);

        // Spawn the extension-loader Web Worker
        spawnExtensionWorker(monaco);

        // Init index + auto-load for current file via worker
        const token = editorSettings.githubToken || undefined;
        getExtensionStatus().setIndexing();
        workerInitIndex(token)
          .then((folders) => {
            console.log(`[MonacoEditor] GitHub ext worker index: ${folders.length} folders`);
            // Auto-load contributions for the current file's language
            if (filePath) {
              const { extensionFolder } = resolveFileLanguage(filePath);
              if (extensionFolder) {
                getExtensionStatus().setActivating(extensionFolder);
                workerLoadFolder(extensionFolder, token)
                  .then((data) => {
                    if (data) {
                      getExtensionStatus().setDone(extensionFolder);
                      showEditorNotification(
                        `Extension "${extensionFolder}" activated`,
                        "info",
                        { source: "Extensions", timeout: 3000 },
                      );
                      console.log(`[MonacoEditor] Worker loaded contributions for "${extensionFolder}"`);
                    } else {
                      getExtensionStatus().reset();
                    }
                  })
                  .catch((err) => {
                    getExtensionStatus().setError(extensionFolder, err?.message ?? String(err));
                    showEditorNotification(
                      `Failed to activate "${extensionFolder}"`,
                      "warning",
                      { source: "Extensions", detail: err?.message, timeout: 5000 },
                    );
                  });
              } else {
                getExtensionStatus().reset();
              }
            } else {
              getExtensionStatus().reset();
            }
          })
          .catch((err) => {
            console.warn("[MonacoEditor] Worker ext index failed:", err);
            getExtensionStatus().setError("index", err?.message ?? String(err));
            // Fallback: use direct (main-thread) loader
            initExtensionIndex()
              .then((folders) => {
                console.log(`[MonacoEditor] Fallback index: ${folders.length} folders`);
                if (filePath) {
                  const { extensionFolder } = resolveFileLanguage(filePath);
                  if (extensionFolder) {
                    getExtensionStatus().setActivating(extensionFolder);
                  }
                  ghExtOnFileOpened(filePath, monaco, editor)
                    .then(() => {
                      if (extensionFolder) {
                        getExtensionStatus().setDone(extensionFolder);
                        showEditorNotification(
                          `Extension "${extensionFolder}" activated (fallback)`,
                          "info",
                          { source: "Extensions", timeout: 3000 },
                        );
                      }
                    })
                    .catch((fbErr) => {
                      getExtensionStatus().setError(
                        extensionFolder ?? "unknown",
                        fbErr?.message ?? String(fbErr),
                      );
                    });
                }
              })
              .catch(() => {
                getExtensionStatus().setError("index", "Failed to fetch extension index");
                showEditorNotification(
                  "Failed to fetch extension index",
                  "error",
                  { source: "Extensions", timeout: 5000 },
                );
              });
          });
      }

      // ── Load custom snippet URLs from settings ──
      if (editorSettings.customSnippetUrls.length > 0) {
        loadAllCustomSnippets(monaco, editorSettings.customSnippetUrls)
          .then((count) => {
            if (count > 0) console.log(`[MonacoEditor] Loaded ${count} custom snippet source(s)`);
          })
          .catch(() => {});
      }

      // ── Register custom hover providers from settings ──
      if (editorSettings.customHoverProviders.length > 0) {
        hoverProviderRef.current = registerCustomHoverProviders(monaco, editorSettings.customHoverProviders);
        console.log(`[MonacoEditor] Registered ${editorSettings.customHoverProviders.length} custom hover provider(s)`);
      }

      // ── Register context-engine language providers (completions, hover, definitions) ──
      registerContextEngineProviders(monaco).catch(() => {});

      disposablesRef.current = disposables;

      // ── User's onMount hook ──
      onMountProp?.(editor, monaco);

      // ── Plugin contexts and lifecycle ──
      const allPlugins = getAllPlugins();
      const states: PluginState[] = [];

      // Register all plugins into the global registry so PluginManagerPanel can see them
      pluginRegistry.registerAll(allPlugins);

      for (const plugin of allPlugins) {
        // Skip plugins that are disabled in the registry
        if (!pluginRegistry.isEnabled(plugin.id)) {
          states.push({ plugin, context: null });
          continue;
        }
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

      // Update plugin count for sidebar badge
      const loadedCount = states.filter((s) => s.context !== null).length;
      setPluginCount(loadedCount);
      if (loadedCount > 0) {
        onNotify?.(`${loadedCount} plugins loaded`, "info");
      }

      // Initial symbol extraction
      if (showSidebar) {
        setTimeout(updateSymbols, 200);
      }
    },
    [
      onMountProp, onSave, filePath, onNotify, getAllPlugins,
      customTheme, theme, resolvedLanguage, fileName, enableTerminal,
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
      internalContentRef.current = val;
      onChange?.(val);

      // Debounced sidebar stats update (avoids rapid re-renders)
      if (sidebarStatsTimerRef.current) clearTimeout(sidebarStatsTimerRef.current);
      sidebarStatsTimerRef.current = setTimeout(() => {
        setInternalContent(val);
      }, 300);

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

    // Load GitHub-based extension assets for the new language (via worker)
    if (editorSettings.enableGitHubExtensions && monacoRef.current && filePath) {
      const { extensionFolder } = resolveFileLanguage(filePath);
      if (extensionFolder) {
        const token = editorSettings.githubToken || undefined;
        getExtensionStatus().setActivating(extensionFolder);
        workerLoadFolder(extensionFolder, token)
          .then((data) => {
            if (data) {
              getExtensionStatus().setDone(extensionFolder);
              showEditorNotification(
                `Extension "${extensionFolder}" activated`,
                "info",
                { source: "Extensions", timeout: 3000 },
              );
            } else {
              // Already loaded or no contributions — reset quietly
              getExtensionStatus().reset();
            }
          })
          .catch(() => {
            // Fallback to main-thread if worker fails
            ghExtOnFileOpened(filePath, monacoRef.current!, editorRef.current ?? undefined)
              .then(() => {
                getExtensionStatus().setDone(extensionFolder);
                showEditorNotification(
                  `Extension "${extensionFolder}" activated (fallback)`,
                  "info",
                  { source: "Extensions", timeout: 3000 },
                );
              })
              .catch((err) => {
                getExtensionStatus().setError(extensionFolder, err?.message ?? String(err));
                showEditorNotification(
                  `Failed to activate "${extensionFolder}"`,
                  "warning",
                  { source: "Extensions", detail: err?.message, timeout: 5000 },
                );
              });
          });
      }
    }
  }, [resolvedLanguage, filePath, editorSettings.enableGitHubExtensions]);

  // ── Plugin hot-swap: dispose removed plugins, mount added ones ──
  const prevPluginIdsRef = useRef<string[]>([]);
  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;

    const currentPlugins = getAllPlugins();
    const currentIds = currentPlugins.map((p) => p.id);
    const prevIds = prevPluginIdsRef.current;

    // Skip the very first render (mount handles initial plugins)
    if (prevIds.length === 0) {
      prevPluginIdsRef.current = currentIds;
      return;
    }

    const removedIds = new Set(prevIds.filter((id) => !currentIds.includes(id)));
    const addedPlugins = currentPlugins.filter((p) => !prevIds.includes(p.id));

    // Dispose removed plugin contexts
    if (removedIds.size > 0) {
      const kept: PluginState[] = [];
      for (const state of pluginStatesRef.current) {
        if (removedIds.has(state.plugin.id)) {
          try {
            state.plugin.onDispose?.();
            state.context?.__dispose();
          } catch { /* swallow */ }
        } else {
          kept.push(state);
        }
      }
      pluginStatesRef.current = kept;
    }

    // Mount newly added plugins
    for (const plugin of addedPlugins) {
      try {
        const ctx = createPluginContext(monaco, editor, {
          filePath,
          onNotify,
          eventBus: eventBusRef.current,
        }) as DisposableContext;

        plugin.onMount?.(ctx);
        pluginStatesRef.current.push({ plugin, context: ctx });
      } catch (err) {
        console.error(`[MonacoEditor] Plugin "${plugin.id}" hot-mount error:`, err);
        pluginStatesRef.current.push({ plugin, context: null });
      }
    }

    prevPluginIdsRef.current = currentIds;
  }, [plugins, getAllPlugins, filePath, onNotify]);

  // ── Copilot / Ghost-text provider switching ──
  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;

    const provider = editorSettings.aiCompletionProvider;

    if (provider === "copilot") {
      if (!copilotRef.current) {
        try {
          const techs = detectTechnologies(resolvedLanguage, fileName);
          const effectiveCopilotEndpoint = editorSettings.copilotEndpoint || copilotEndpoint;
          const registration = registerCopilot(monaco, editor, {
            language: resolvedLanguage,
            filename: fileName,
            endpoint: effectiveCopilotEndpoint,
            technologies: techs,
            trigger: "onIdle",
          });
          copilotRef.current = registration;
        } catch (err) {
          console.warn("[MonacoEditor] Copilot registration failed:", err);
        }
      }
    } else {
      // Deregister copilot when not "copilot"
      if (copilotRef.current) {
        try { copilotRef.current.deregister(); } catch { /* */ }
        copilotRef.current = null;
      }
    }
  }, [editorSettings.aiCompletionProvider, editorSettings.copilotEndpoint, resolvedLanguage, fileName, copilotEndpoint]);

  // ── AI Completions (dropdown suggestions) — independent of copilot/ghost-text ──
  // Registers whenever an endpoint is available (prop or settings).
  // Dropdown completion items don't conflict with inline ghost-text.
  // Depends on editorReady so it re-runs after handleMount.
  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco || !editorReady) return;

    const endpoint = editorSettings.aiCompletionsEndpoint || aiCompletionsEndpointProp;

    if (!endpoint) {
      // No endpoint — dispose if active
      if (aiCompletionsRef.current) {
        try { aiCompletionsRef.current.dispose(); } catch { /* */ }
        aiCompletionsRef.current = null;
      }
      return;
    }

    // Always dispose & re-register when any dep changes (language, filename, endpoint).
    // This ensures completion provider + CodeLens are registered for the correct language.
    if (aiCompletionsRef.current) {
      try { aiCompletionsRef.current.dispose(); } catch { /* */ }
      aiCompletionsRef.current = null;
    }

    try {
      const registration = registerAICompletions(monaco, editor, {
        endpoint,
        languageId: resolvedLanguage,
        filename: fileName,
        onError: (err) => console.warn("[MonacoEditor] AI completions fetch error:", err),
        onCompletionsUpdated: (count) =>
          console.log(`[MonacoEditor] AI completions updated: ${count} items for ${resolvedLanguage}`),
        customContextMenuItems: editorSettings.customContextMenuItems,
      });
      aiCompletionsRef.current = registration;
    } catch (err) {
      console.warn("[MonacoEditor] AI completions registration failed:", err);
    }

    // Cleanup on deps change / unmount
    return () => {
      if (aiCompletionsRef.current) {
        try { aiCompletionsRef.current.dispose(); } catch { /* */ }
        aiCompletionsRef.current = null;
      }
    };
  }, [editorReady, editorSettings.aiCompletionsEndpoint, aiCompletionsEndpointProp, resolvedLanguage, fileName, editorSettings.customContextMenuItems]);

  // ── Custom Hover Providers — re-register whenever the entries change ──
  useEffect(() => {
    const monaco = monacoRef.current;
    if (!monaco || !editorReady) return;

    // Dispose previous
    if (hoverProviderRef.current) {
      hoverProviderRef.current.dispose();
      hoverProviderRef.current = null;
    }

    if (editorSettings.customHoverProviders.length > 0) {
      hoverProviderRef.current = registerCustomHoverProviders(monaco, editorSettings.customHoverProviders);
      console.log(`[MonacoEditor] Re-registered ${editorSettings.customHoverProviders.length} custom hover provider(s)`);
    }

    return () => {
      if (hoverProviderRef.current) {
        hoverProviderRef.current.dispose();
        hoverProviderRef.current = null;
      }
    };
  }, [editorReady, editorSettings.customHoverProviders]);

  // ── LSP toggle switching ──
  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;

    const shouldConnect = enableLSP && editorSettings.enableLSP && !!lspBaseUrl && hasLSPSupport(resolvedLanguage);

    if (shouldConnect && !lspRef.current) {
      // Connect LSP
      const wsUrl = buildLSPWebSocketUrl(lspBaseUrl!, resolvedLanguage);
      if (wsUrl) {
        const lspName = resolvedLanguage.charAt(0).toUpperCase() + resolvedLanguage.slice(1);
        connectLanguageServer({
          languageId: resolvedLanguage,
          wsUrl,
          documentUri,
          monaco,
          editor,
          onConnected: () => {
            console.log(`[LSP] Connected: ${resolvedLanguage}`);
            showEditorNotification(`Language server connected`, "info", {
              source: `LSP: ${lspName}`,
              timeout: 3000,
            });
          },
          onDisconnected: () => console.log(`[LSP] Disconnected: ${resolvedLanguage}`),
          onError: (err) => {
            console.warn(`[LSP] Error:`, err);
            showEditorNotification(err.message || "Language server error", "error", {
              source: `LSP: ${lspName}`,
              detail: String(err),
              timeout: 8000,
            });
          },
          onServerMessage: (message, severity, langId) => {
            const severityMap: Record<string, "error" | "warning" | "info"> = {
              error: "error", warning: "warning", info: "info", log: "info", debug: "info",
            };
            const srcName = langId.charAt(0).toUpperCase() + langId.slice(1);
            showEditorNotification(message, severityMap[severity] ?? "info", {
              source: `LSP: ${srcName}`,
              timeout: severity === "error" ? 8000 : severity === "warning" ? 6000 : 4000,
            });
          },
        })
          .then((conn) => { lspRef.current = conn; })
          .catch((err) => {
            console.warn("[MonacoEditor] LSP connection failed:", err);
            showEditorNotification(
              `Failed to connect to ${lspName} language server`,
              "error",
              {
                source: `LSP: ${lspName}`,
                detail: err?.message ?? String(err),
                timeout: 8000,
              },
            );
          });
      }
    } else if (!shouldConnect && lspRef.current) {
      // Disconnect LSP
      try { lspRef.current.dispose(); } catch { /* */ }
      lspRef.current = null;
    }
  }, [editorSettings.enableLSP, enableLSP, lspBaseUrl, resolvedLanguage, documentUri]);

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

      // Cleanup AI completions
      try { aiCompletionsRef.current?.dispose(); } catch { /* */ }
      aiCompletionsRef.current = null;

      // Cleanup LSP
      try { lspRef.current?.dispose(); } catch { /* */ }
      lspRef.current = null;

      // Terminate extension-loader Web Worker
      terminateExtensionWorker();

      // Clear event bus
      eventBusRef.current.clear();

      // Clear debounce timers
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (sidebarStatsTimerRef.current) clearTimeout(sidebarStatsTimerRef.current);

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

  const handleThemeApply = useCallback(async (themeId: string) => {
    const monaco = monacoRef.current;
    if (!monaco) return;
    // If it's a built-in or already registered, apply directly
    const { hasTheme } = await import("./core/theme-registry");
    if (hasTheme(themeId)) {
      monaco.editor.setTheme(themeId);
      onThemeApply?.(themeId);
      return;
    }
    // Try loading from monaco-themes package
    const themeDef = await loadMonacoTheme(themeId);
    if (themeDef) {
      registerTheme(monaco, themeDef);
      monaco.editor.setTheme(themeId);
      onThemeApply?.(themeId);
      return;
    }
    // Fallback: try loading from /public/themes/
    const ok = await loadCustomTheme(monaco, themeId);
    if (ok) {
      monaco.editor.setTheme(themeId);
    }
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
    // CodeLens (used by AI Suggest buttons on functions/classes)
    codeLens: true,
    // Inlay hints (type annotations, parameter names from LSP)
    inlayHints: { enabled: "on" },
    // Lightbulb (code action indicator)
    lightbulb: { enabled: "on" as any },
    // IntelliSense / text hint settings
    parameterHints: { enabled: editorSettings.parameterHints },
    hover: { enabled: editorSettings.hoverEnabled },
    quickSuggestions: editorSettings.quickSuggestions
      ? { other: "on", comments: "off", strings: "off" }
      : false,
    suggestOnTriggerCharacters: editorSettings.quickSuggestions,
    definitionLinkOpensInPeek: editorSettings.definitionLinkEnabled,
    gotoLocation: {
      multiple: "peek",
      multipleDefinitions: "peek",
      multipleTypeDefinitions: "peek",
      multipleDeclarations: "peek",
      multipleImplementations: "peek",
      multipleReferences: "peek",
    },
    ...options,
  };

  // Content stats for sidebar info panel (use internal tracking for uncontrolled mode)
  const contentValue = value ?? internalContentRef.current;
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
    // Refresh language detection and re-apply model language
    refreshModelLanguage();
    onExtensionInstalled?.();
  }, [shouldLoadExtensions, onExtensionInstalled]);

  /**
   * Re-detect the current file's language from the (now updated) Monaco
   * language registry and update the model language if it changed.
   *
   * Called after any extension install/uninstall/toggle or context-engine
   * pack change so the editor picks up new language support, tokenization,
   * grammars, completions, etc. without a full page reload.
   */
  const refreshModelLanguage = useCallback(() => {
    const monaco = monacoRef.current;
    const editor = editorRef.current;
    if (!monaco || !editor) return;

    // 1. Refresh the language detection cache from the updated Monaco registry
    refreshLanguageCache(monaco);

    // 2. Re-detect the language for the currently open file
    const currentFilePath = filePath ?? editor.getModel()?.uri.path ?? "";
    if (!currentFilePath) return;

    const newLang = detectLanguage(currentFilePath);
    const model = editor.getModel();
    if (!model) return;

    const currentLang = model.getLanguageId();
    if (newLang && newLang !== "plaintext" && newLang !== currentLang) {
      // Update the model's language — triggers re-tokenization, snippets, completions, etc.
      monaco.editor.setModelLanguage(model, newLang);
      console.log(`[MonacoEditor] Model language refreshed: ${currentLang} → ${newLang}`);
      showEditorNotification(
        `Language switched to ${newLang}`,
        "info",
        { source: "Extensions", timeout: 3000 },
      );
    } else {
      // Same language — still force a re-tokenization by toggling the language
      // This ensures new grammars/tokens from the extension are applied.
      monaco.editor.setModelLanguage(model, "plaintext");
      monaco.editor.setModelLanguage(model, currentLang);
      console.log(`[MonacoEditor] Model re-tokenized for language: ${currentLang}`);
    }

    // 3. Re-register context-engine providers for any newly installed packs
    import("./lib/contextEngineProviders").then(({ registerContextEngineProviders }) => {
      registerContextEngineProviders(monaco).catch(() => {});
    });

    // 4. Refresh extension count badge immediately
    if (shouldLoadExtensions) {
      loadAllExtensions(monaco, editor)
        .then(({ extensions }) => setExtensionCount(extensions.length))
        .catch(() => {});
    }

    // 5. Refresh context-engine installed count
    import("@/lib/context-engine/contextEngineStorage").then(({ getInstalledLanguages }) => {
      getInstalledLanguages().then((langs) => setContextEngineCount(langs.length)).catch(() => {});
    });
  }, [filePath, shouldLoadExtensions]);

  const handleTerminalToggle = useCallback(() => {
    setTerminalOpen((o) => {
      const next = !o;
      if (next) setTerminalMounted(true);
      return next;
    });
  }, []);

  /** Close the terminal entirely — unmounts it so the socket connection is disposed */
  const handleTerminalClose = useCallback(() => {
    setTerminalOpen(false);
    setTerminalMounted(false);
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
        // IntelliSense settings
        parameterHints: { enabled: newSettings.parameterHints },
        hover: { enabled: newSettings.hoverEnabled },
        inlayHints: { enabled: "on" },
        lightbulb: { enabled: "on" as any },
        quickSuggestions: newSettings.quickSuggestions
          ? { other: "on", comments: "off", strings: "off" }
          : false,
        suggestOnTriggerCharacters: newSettings.quickSuggestions,
      });
    }

    // Handle AI provider change
    if (newSettings.aiCompletionProvider !== editorSettings.aiCompletionProvider) {
      onAIProviderChange?.(newSettings.aiCompletionProvider);
    }

    // Handle panel toggles
    if (newSettings.showTerminal !== editorSettings.showTerminal) {
      setTerminalOpen(newSettings.showTerminal);
      if (newSettings.showTerminal) setTerminalMounted(true);
    }
  }, [editorSettings.showTerminal, editorSettings.aiCompletionProvider, onAIProviderChange]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height, width }} className="monaco-editor-wrapper">
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <ResizablePanelGroup direction="horizontal">
          {/* Editor area */}
          <ResizablePanel defaultSize={showSidebar && sidebarOpen ? 75 : 100}>
            <div style={{ display: "flex", flexDirection: "column", overflow: "hidden", position: "relative", height: "100%" }}>
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
          </ResizablePanel>

          {/* Sidebar content panel (resizable) */}
          {showSidebar && sidebarOpen && (
            <>
              <ResizableHandle withHandle className="bg-[var(--editor-border,#3c3c3c)] hover:bg-blue-500/40 transition-colors" />
              <ResizablePanel defaultSize={25} minSize={12} maxSize={40}>
                <EditorSidebarContent
                  activeTab={sidebarTab}
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
                  activeTheme={customTheme ?? theme}
                  editorSettings={editorSettings}
                  onSettingsChange={handleSettingsChange}
                  enableTerminal={enableTerminal}
                  chatBaseUrl={chatBaseUrl}
                  chatHostId={chatHostId}
                  chatFileContent={value ?? internalContentRef.current ?? editorRef.current?.getValue() ?? ""}
                  chatSelectedText={selectedText}
                  onChatApplyCode={onChatApplyCode}
                  onExtensionChange={refreshModelLanguage}
                />
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>

        {/* Activity bar (always visible when sidebar enabled, outside resizable area) */}
        {showSidebar && (
          <EditorSidebarActivityBar
            open={sidebarOpen}
            onToggle={() => setSidebarOpen((o) => !o)}
            activeTab={sidebarTab}
            onTabChange={setSidebarTab}
            symbols={symbols}
            problems={problems}
            extensionCount={extensionCount}
            pluginCount={pluginCount}
            contextEngineCount={contextEngineCount}
          />
        )}
      </div>

      {/* Terminal panel (below editor) */}
      {enableTerminal && terminalMounted && (
        <EditorTerminalPanel
          open={terminalOpen}
          onToggle={handleTerminalToggle}
          onClose={handleTerminalClose}
          terminalUrl={terminalUrl}
          sessionId={terminalSessionId}
          cwd={terminalCwd}
          terminalTheme={monacoThemeIdToXterm(customTheme ?? theme)}
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
