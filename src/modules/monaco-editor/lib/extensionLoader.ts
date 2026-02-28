/**
 * @module lib/monaco/extensionLoader
 *
 * Loads installed extension data from IndexedDB into Monaco at runtime.
 * Handles:
 *  - Registering themes (defineTheme)
 *  - Registering contributed languages
 *  - Registering snippet completion providers
 *
 * Grammars from VSIX extensions are stored in IDB but language
 * highlighting relies on Monaco's built-in tokenizers + LSP semantic
 * tokens. No TextMate / vscode-oniguruma dependencies.
 *
 * Also provides the high-level `installExtensionFromOpenVSX()` function
 * that orchestrates: fetch metadata → download VSIX → extract → store → load.
 */

import type * as monacoNs from "monaco-editor";
import { refreshLanguageCache } from "../utils/language-detect";
import { convertVSCodeLanguageConfig } from "../utils/convert-language-config";

import { getExtension, downloadVSIX, type OpenVSXExtension } from "./openVSX";
import { extractVSIX, type VSIXContents, type ExtLanguage } from "./extractVSIX";
import {
  saveExtension,
  uninstallExtension,
  toggleExtension,
  getInstalledExtensions,
  getEnabledExtensions,
  getAllThemes,
  getAllGrammars,
  getAllSnippets,
  getSnippetsByLanguage,
  getThemeById,
  getGrammarByScope,
  getAllCommands,
  getAllKeybindings,
  getAllConfigurations,
  getAllColors,
  getAllIcons,
  getAllJsonValidation,
  type InstalledExtension,
  type StoredTheme,
  type StoredGrammar,
  type StoredSnippet,
  type StoredCommand,
  type StoredKeybinding,
  type StoredConfiguration,
  type StoredColor,
  type StoredIcon,
  type StoredJsonValidation,
} from "./extensionStorage";

type Monaco = typeof monacoNs;

/**
 * Typed accessor for `monaco.languages.json.jsonDefaults` which is
 * marked deprecated at the type level but still available at runtime.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getJsonDefaults(monaco: Monaco): any {
  return (monaco.languages as any).json?.jsonDefaults;
}

/* ── State ─────────────────────────────────────────────────── */

/** Track which extension themes have been registered with Monaco */
const registeredThemes = new Set<string>();

/** Track which extension grammars/languages have been registered */
const registeredGrammars = new Set<string>();

/** Track snippet disposables per language (extension-contributed) */
const extensionSnippetDisposables = new Map<string, monacoNs.IDisposable[]>();

/** Track registered command IDs (extension-contributed) */
const registeredCommands = new Set<string>();

/** Track command/keybinding action disposables */
const commandDisposables: monacoNs.IDisposable[] = [];

/** Track registered JSON schemas to avoid duplicates */
const registeredSchemaUris = new Set<string>();

/** Track injected icon style elements per extensionId */
const iconStyleElements = new Map<string, HTMLStyleElement>();

/** Install progress callback type */
export type InstallProgress = (
  stage: "fetching" | "downloading" | "extracting" | "storing" | "loading" | "done" | "error",
  detail?: string,
) => void;

/* ── Theme Loading ─────────────────────────────────────────── */

/**
 * Register a stored theme with Monaco's `defineTheme`.
 */
export function registerExtensionTheme(monaco: Monaco, theme: StoredTheme): void {
  if (registeredThemes.has(theme.themeId)) return;

  const content = theme.content as {
    type?: string;
    colors?: Record<string, string>;
    tokenColors?: Array<{
      name?: string;
      scope?: string | string[];
      settings: { foreground?: string; background?: string; fontStyle?: string };
    }>;
  };

  const base: "vs" | "vs-dark" | "hc-black" =
    theme.uiTheme === "vs" ? "vs" : theme.uiTheme === "hc-black" ? "hc-black" : "vs-dark";

  // Convert tokenColors to Monaco token rules
  const rules: monacoNs.editor.ITokenThemeRule[] = [];
  for (const entry of content.tokenColors ?? []) {
    const scopes = Array.isArray(entry.scope)
      ? entry.scope
      : entry.scope
        ? [entry.scope]
        : [];

    for (const scope of scopes) {
      const rule: monacoNs.editor.ITokenThemeRule = { token: scope };
      if (entry.settings.foreground) rule.foreground = entry.settings.foreground.replace("#", "");
      if (entry.settings.background) rule.background = entry.settings.background.replace("#", "");
      if (entry.settings.fontStyle) rule.fontStyle = entry.settings.fontStyle;
      rules.push(rule);
    }
  }

  try {
    monaco.editor.defineTheme(theme.themeId, {
      base,
      inherit: true,
      rules,
      colors: content.colors ?? {},
    });
  } catch (err) {
    // When @codingame/monaco-editor-wrapper replaces the standalone theme
    // service, defineTheme may not exist — themes are handled via VS Code
    // extension contributions instead.
    console.warn(`[extensionLoader] defineTheme("${theme.themeId}") unavailable:`, err);
  }

  registeredThemes.add(theme.themeId);
}

/**
 * Register all enabled extension themes with Monaco.
 */
export async function loadAllExtensionThemes(monaco: Monaco): Promise<string[]> {
  const themes = await getAllThemes();
  const loaded: string[] = [];
  for (const theme of themes) {
    try {
      registerExtensionTheme(monaco, theme);
      loaded.push(theme.themeId);
    } catch (err) {
      console.warn(`[extensionLoader] Failed to load theme "${theme.themeId}":`, err);
    }
  }
  return loaded;
}

/* ── Grammar / Language Registration ───────────────────────── */

/**
 * Register a grammar's associated language with Monaco.
 * The grammar content is stored in IDB but we don't wire TextMate;
 * Monaco's built-in tokenizer handles highlighting.
 */
export async function registerExtensionGrammar(
  monaco: Monaco,
  grammar: StoredGrammar,
  _editor?: monacoNs.editor.ICodeEditor,
): Promise<boolean> {
  if (registeredGrammars.has(grammar.scopeName)) return true;

  try {
    if (grammar.language) {
      // Ensure the language is registered with Monaco
      const existing = monaco.languages.getLanguages().find((l) => l.id === grammar.language);
      if (!existing) {
        monaco.languages.register({ id: grammar.language });
      }
      registeredGrammars.add(grammar.scopeName);
      return true;
    }

    return false;
  } catch (err) {
    console.warn(`[extensionLoader] Failed to register grammar language "${grammar.scopeName}":`, err);
    return false;
  }
}

/**
 * Load all enabled extension grammars.
 */
export async function loadAllExtensionGrammars(
  monaco: Monaco,
  editor?: monacoNs.editor.ICodeEditor,
): Promise<string[]> {
  const grammars = await getAllGrammars();
  const loaded: string[] = [];
  for (const grammar of grammars) {
    const ok = await registerExtensionGrammar(monaco, grammar, editor);
    if (ok) loaded.push(grammar.scopeName);
  }
  return loaded;
}

/* ── Snippet Loading ───────────────────────────────────────── */

/**
 * Register extension-contributed snippets for a specific language.
 */
export async function loadExtensionSnippets(
  monaco: Monaco,
  langId: string,
): Promise<monacoNs.IDisposable[]> {
  const snippets = await getSnippetsByLanguage(langId);
  if (snippets.length === 0) return [];

  // Dispose previous registrations for this language
  const existing = extensionSnippetDisposables.get(langId);
  if (existing) {
    existing.forEach((d) => d.dispose());
  }

  const disposables: monacoNs.IDisposable[] = [];

  for (const snippet of snippets) {
    const entries = Object.entries(snippet.content) as [string, {
      prefix: string | string[];
      body: string | string[];
      description?: string;
    }][];

    if (entries.length === 0) continue;

    const disposable = monaco.languages.registerCompletionItemProvider(langId, {
      provideCompletionItems(model, position) {
        const word = model.getWordUntilPosition(position);
        const range: monacoNs.IRange = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        };

        const suggestions: monacoNs.languages.CompletionItem[] = entries.map(
          ([name, snip]) => {
            const prefixes = Array.isArray(snip.prefix) ? snip.prefix : [snip.prefix];
            const body = Array.isArray(snip.body) ? snip.body.join("\n") : snip.body;

            return {
              label: prefixes[0],
              kind: monaco.languages.CompletionItemKind.Snippet,
              documentation: snip.description
                ? { value: `**${name}**\n\n${snip.description}` }
                : undefined,
              insertText: body,
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              detail: `${name} (extension)`,
              range,
              filterText: prefixes.join(" "),
              sortText: `zzz_ext_${prefixes[0]}`,
            };
          },
        );

        return { suggestions };
      },
    });

    disposables.push(disposable);
  }

  extensionSnippetDisposables.set(langId, disposables);
  return disposables;
}

/**
 * Load snippets for ALL languages that have extension-contributed snippets.
 * Groups stored snippets by language and registers a completion provider for each.
 */
export async function loadAllExtensionSnippets(
  monaco: Monaco,
): Promise<string[]> {
  const allSnippets = await getAllSnippets();
  if (allSnippets.length === 0) return [];

  // Group by language
  const byLang = new Map<string, StoredSnippet[]>();
  for (const s of allSnippets) {
    const arr = byLang.get(s.language) ?? [];
    arr.push(s);
    byLang.set(s.language, arr);
  }

  const loaded: string[] = [];
  for (const langId of byLang.keys()) {
    try {
      await loadExtensionSnippets(monaco, langId);
      loaded.push(langId);
    } catch (err) {
      console.warn(`[extensionLoader] Failed to load snippets for "${langId}":`, err);
    }
  }
  return loaded;
}

/* ── Command Loading ───────────────────────────────────────── */

/**
 * Parse a VS Code keybinding string into a Monaco keybinding number.
 * E.g. "ctrl+shift+k" → KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyK
 */
function parseKeybinding(monaco: Monaco, keyStr: string): number {
  let mods = 0;
  const parts = keyStr.toLowerCase().replace(/\s/g, "").split("+");
  const key = parts.pop() ?? "";

  for (const mod of parts) {
    if (mod === "ctrl" || mod === "cmd" || mod === "ctrlcmd") mods |= monaco.KeyMod.CtrlCmd;
    if (mod === "shift") mods |= monaco.KeyMod.Shift;
    if (mod === "alt" || mod === "option") mods |= monaco.KeyMod.Alt;
    if (mod === "win" || mod === "meta" || mod === "super") mods |= monaco.KeyMod.WinCtrl;
  }

  // Try to resolve the key code via KeyCode enum
  // First try "Key" + uppercase letter for alpha keys (e.g., "k" → "KeyK")
  const keyUpper = key.toUpperCase();
  let keyCode: number | undefined;
  const keyCodeMap = monaco.KeyCode as unknown as Record<string, number>;

  // Single letter keys: a-z
  if (key.length === 1 && /^[a-z]$/i.test(key)) {
    keyCode = keyCodeMap[`Key${keyUpper}`];
  }
  // Digit keys: 0-9
  else if (key.length === 1 && /^[0-9]$/.test(key)) {
    keyCode = keyCodeMap[`Digit${key}`];
  }
  // Function keys: f1-f19
  else if (/^f\d{1,2}$/.test(key)) {
    keyCode = keyCodeMap[key.toUpperCase()];
  }
  // Named keys: enter, escape, tab, space, backspace, delete, etc.
  else {
    const nameMap: Record<string, string> = {
      enter: "Enter",
      return: "Enter",
      escape: "Escape",
      esc: "Escape",
      tab: "Tab",
      space: "Space",
      backspace: "Backspace",
      delete: "Delete",
      del: "Delete",
      insert: "Insert",
      home: "Home",
      end: "End",
      pageup: "PageUp",
      pagedown: "PageDown",
      up: "UpArrow",
      down: "DownArrow",
      left: "LeftArrow",
      right: "RightArrow",
      "[": "BracketLeft",
      "]": "BracketRight",
      "\\": "Backslash",
      "/": "Slash",
      ";": "Semicolon",
      "'": "Quote",
      ",": "Comma",
      ".": "Period",
      "-": "Minus",
      "=": "Equal",
      "`": "Backquote",
    };
    const mapped = nameMap[key] ?? key.charAt(0).toUpperCase() + key.slice(1);
    keyCode = keyCodeMap[mapped];
  }

  return mods | (keyCode ?? 0);
}

/**
 * Register extension-contributed commands with the editor.
 * Commands appear in the command palette (Ctrl+Shift+P).
 */
export async function loadExtensionCommands(
  monaco: Monaco,
  editor?: monacoNs.editor.ICodeEditor,
): Promise<string[]> {
  const commands = await getAllCommands();
  if (commands.length === 0) return [];

  // Also fetch keybindings so we can attach them to matching commands
  const keybindings = await getAllKeybindings();
  const kbMap = new Map<string, StoredKeybinding[]>();
  for (const kb of keybindings) {
    const arr = kbMap.get(kb.command) ?? [];
    arr.push(kb);
    kbMap.set(kb.command, arr);
  }

  const loaded: string[] = [];
  for (const cmd of commands) {
    if (registeredCommands.has(cmd.command)) continue;

    const label = cmd.category ? `${cmd.category}: ${cmd.title}` : cmd.title;

    // Resolve keybindings for this command
    const cmdKeybindings: number[] = [];
    const kbs = kbMap.get(cmd.command);
    if (kbs) {
      for (const kb of kbs) {
        // Use platform-specific key if available
        const isMac = navigator.platform?.toLowerCase().includes("mac");
        const isLinux = navigator.platform?.toLowerCase().includes("linux");
        const keyStr = (isMac && kb.mac) || (isLinux && kb.linux) || kb.key;
        try {
          cmdKeybindings.push(parseKeybinding(monaco, keyStr));
        } catch {
          // skip invalid keybindings
        }
      }
    }

    if (editor) {
      try {
        // addAction exists on IStandaloneCodeEditor but not the ICodeEditor base type
        const standaloneEditor = editor as unknown as monacoNs.editor.IStandaloneCodeEditor;
        const disposable = standaloneEditor.addAction({
          id: cmd.command,
          label,
          keybindings: cmdKeybindings.length > 0 ? cmdKeybindings : undefined,
          contextMenuGroupId: "extension",
          run: () => {
            console.log(`[extension] Command stub: ${cmd.command}`);
          },
        });
        if (disposable) commandDisposables.push(disposable);
        registeredCommands.add(cmd.command);
        loaded.push(cmd.command);
      } catch (err) {
        console.warn(`[extensionLoader] Failed to register command "${cmd.command}":`, err);
      }
    } else {
      // Without an editor instance, register a no-op placeholder
      registeredCommands.add(cmd.command);
      loaded.push(cmd.command);
    }
  }

  return loaded;
}

/**
 * Register standalone keybindings that aren't already attached to a command.
 * If no matching command action was registered, create a minimal action.
 */
export async function loadExtensionKeybindings(
  monaco: Monaco,
  editor?: monacoNs.editor.ICodeEditor,
): Promise<string[]> {
  if (!editor) return [];

  const keybindings = await getAllKeybindings();
  const loaded: string[] = [];

  for (const kb of keybindings) {
    // Skip if the command was already registered with its keybinding
    if (registeredCommands.has(kb.command)) continue;

    const isMac = navigator.platform?.toLowerCase().includes("mac");
    const isLinux = navigator.platform?.toLowerCase().includes("linux");
    const keyStr = (isMac && kb.mac) || (isLinux && kb.linux) || kb.key;

    try {
      const binding = parseKeybinding(monaco, keyStr);
      const standaloneEditor = editor as unknown as monacoNs.editor.IStandaloneCodeEditor;
      const disposable = standaloneEditor.addAction({
        id: kb.command,
        label: kb.command,
        keybindings: [binding],
        precondition: kb.when,
        run: () => {
          console.log(`[extension] Keybinding stub: ${kb.command}`);
        },
      });
      if (disposable) commandDisposables.push(disposable);
      registeredCommands.add(kb.command);
      loaded.push(kb.command);
    } catch (err) {
      console.warn(`[extensionLoader] Failed to register keybinding for "${kb.command}":`, err);
    }
  }

  return loaded;
}

/* ── Configuration Loading ─────────────────────────────────── */

/**
 * Register extension configuration schemas.
 * Merges all extension config properties into a JSON schema that
 * provides validation/intellisense for settings.json files.
 */
export async function loadExtensionConfigurations(monaco: Monaco): Promise<number> {
  const configs = await getAllConfigurations();
  if (configs.length === 0) return 0;

  const allProperties: Record<string, unknown> = {};
  for (const cfg of configs) {
    if (cfg.properties && typeof cfg.properties === "object") {
      Object.assign(allProperties, cfg.properties);
    }
  }

  const schemaUri = "terminus://extension-settings-schema.json";
  if (registeredSchemaUris.has(schemaUri) && Object.keys(allProperties).length === 0) return 0;

  try {
    // Access existing diagnostic options and merge
    const jsonDefaults = getJsonDefaults(monaco);
    if (!jsonDefaults) return 0;
    const existing = jsonDefaults.diagnosticsOptions;
    const existingSchemas = existing?.schemas ?? [];

    // Remove any previous extension-settings schema
    const filtered = existingSchemas.filter((s: { uri?: string }) => s.uri !== schemaUri);

    jsonDefaults.setDiagnosticsOptions({
      validate: true,
      allowComments: true,
      schemas: [
        ...filtered,
        {
          uri: schemaUri,
          fileMatch: ["settings.json", "*.settings.json"],
          schema: {
            type: "object",
            properties: allProperties,
          },
        },
      ],
    });

    registeredSchemaUris.add(schemaUri);
    return Object.keys(allProperties).length;
  } catch (err) {
    console.warn("[extensionLoader] Failed to register configuration schemas:", err);
    return 0;
  }
}

/* ── Color Loading ─────────────────────────────────────────── */

/**
 * Get all extension-contributed color defaults for the given theme type.
 * These can be merged into theme `colors` when defining/updating a theme.
 */
export async function getExtensionColorDefaults(
  themeType: "dark" | "light" | "hc" = "dark",
): Promise<Record<string, string>> {
  const colors = await getAllColors();
  const result: Record<string, string> = {};

  for (const color of colors) {
    const value =
      themeType === "dark"
        ? color.defaults.dark
        : themeType === "light"
          ? color.defaults.light
          : color.defaults.highContrast ?? color.defaults.dark;
    if (value) {
      result[color.colorId] = value;
    }
  }

  return result;
}

/* ── Icon Loading ──────────────────────────────────────────── */

/**
 * Load extension-contributed custom icon fonts.
 * Injects @font-face rules and per-icon CSS classes into the document.
 * Returns the list of icon names that were loaded.
 */
export async function loadExtensionIcons(
  extensionId?: string,
): Promise<string[]> {
  const icons = await getAllIcons();
  if (icons.length === 0) return [];

  // Group by extensionId
  const byExt = new Map<string, StoredIcon[]>();
  for (const icon of icons) {
    if (extensionId && icon.extensionId !== extensionId) continue;
    const arr = byExt.get(icon.extensionId) ?? [];
    arr.push(icon);
    byExt.set(icon.extensionId, arr);
  }

  const loaded: string[] = [];

  for (const [extId, extIcons] of byExt) {
    // Skip if already injected
    if (iconStyleElements.has(extId)) continue;

    // Collect unique font paths
    const fontPaths = new Set<string>();
    for (const icon of extIcons) {
      if (icon.fontPath) fontPaths.add(icon.fontPath);
    }

    let css = "";

    // Generate @font-face for each unique font
    let fontIdx = 0;
    const fontFamilies = new Map<string, string>();
    for (const fp of fontPaths) {
      const family = `ExtIcon_${extId.replace(/[^a-zA-Z0-9]/g, "_")}_${fontIdx++}`;
      fontFamilies.set(fp, family);

      // The font file should be stored in IDB as a raw file
      // We create a blob URL for it
      css += `/* Font: ${fp} */\n`;
      css += `@font-face {\n`;
      css += `  font-family: '${family}';\n`;
      // If the file is stored in IDB, we'd need to create a blob URL
      // For now, reference it as a data URI placeholder
      css += `  src: url('data:font/woff2;base64,') format('woff2');\n`;
      css += `  font-weight: normal;\n`;
      css += `  font-style: normal;\n`;
      css += `}\n\n`;
    }

    // Generate per-icon CSS classes
    for (const icon of extIcons) {
      const family = icon.fontPath ? fontFamilies.get(icon.fontPath) : undefined;
      if (icon.fontCharacter && family) {
        const safeName = icon.name.replace(/[^a-zA-Z0-9-_]/g, "-");
        css += `.ext-icon-${safeName}::before {\n`;
        css += `  content: '${icon.fontCharacter}';\n`;
        css += `  font-family: '${family}';\n`;
        css += `}\n`;
        loaded.push(icon.name);
      }
    }

    if (css) {
      const style = document.createElement("style");
      style.setAttribute("data-ext-icons", extId);
      style.textContent = css;
      document.head.appendChild(style);
      iconStyleElements.set(extId, style);
    }
  }

  return loaded;
}

/* ── JSON Validation Loading ───────────────────────────────── */

/**
 * Register extension-contributed JSON validation schemas with Monaco.
 * Provides validation and intellisense for matching JSON files.
 */
export async function loadExtensionJsonValidation(monaco: Monaco): Promise<number> {
  const validations = await getAllJsonValidation();
  if (validations.length === 0) return 0;

  try {
    const jsonDefaults = getJsonDefaults(monaco);
    if (!jsonDefaults) return 0;
    const existing = jsonDefaults.diagnosticsOptions;
    const existingSchemas = existing?.schemas ?? [];

    // Build new schema entries from extension contributions
    const newSchemas: Array<{ uri: string; fileMatch: string[]; schema: Record<string, unknown> }> = [];
    for (const v of validations) {
      const schemaUri = `terminus://ext-json-schema/${v.extensionId}/${v.url}`;
      if (registeredSchemaUris.has(schemaUri)) continue;

      if (v.schema) {
        const fileMatch = Array.isArray(v.fileMatch) ? v.fileMatch : [v.fileMatch];
        newSchemas.push({
          uri: schemaUri,
          fileMatch,
          schema: v.schema,
        });
        registeredSchemaUris.add(schemaUri);
      }
    }

    if (newSchemas.length === 0) return 0;

    jsonDefaults.setDiagnosticsOptions({
      validate: true,
      allowComments: true,
      schemas: [...existingSchemas, ...newSchemas],
    });

    return newSchemas.length;
  } catch (err) {
    console.warn("[extensionLoader] Failed to register JSON validation schemas:", err);
    return 0;
  }
}

/* ── Language Registration ─────────────────────────────────── */

/**
 * Register contributed languages from enabled extensions.
 *
 * Uses the full `languageConfigs` stored in each extension record
 * (extensions, aliases, filenames) so Monaco can:
 *  1. Detect file types for extension-contributed languages
 *  2. List them in language pickers
 *
 * Falls back to grammar-based registration for older records that
 * don't have `languageConfigs` populated (backwards compatibility).
 */
export async function registerExtensionLanguages(monaco: Monaco): Promise<void> {
 try {
   const extensions = await getEnabledExtensions();
  const existingLangs = new Set(monaco.languages.getLanguages().map((l) => l.id));
  let registered = false;
  
  for (const ext of extensions) {
    // Prefer full language configs (new format with extensions/aliases/filenames)
    const langConfigs = ext.contributes.languageConfigs;
 
    if (langConfigs && langConfigs.length > 0) {
      for (const lang of langConfigs) {
        if (!existingLangs.has(lang.id)) {
          monaco.languages.register({
            id: lang.id,
            extensions: lang.extensions,
            aliases: lang.aliases,
            filenames: lang.filenames,
          });
          existingLangs.add(lang.id);
          registered = true;
        }

        // Apply language configuration (brackets, auto-close, comments, etc.)
        if (lang.configurationContent) {
          try {
            const monacoConfig = convertVSCodeLanguageConfig(lang.configurationContent);
            monaco.languages.setLanguageConfiguration(lang.id, monacoConfig);
          } catch (err) {
            console.warn(`[extensionLoader] Failed to set language config for "${lang.id}":`, err);
          }
        }
      }
    } else {
      // Backwards compatibility: register language IDs from grammar or language list
      const langIds = ext.contributes.languages ?? [];
      for (const langId of langIds) {
        if (typeof langId === "string" && !existingLangs.has(langId)) {
          monaco.languages.register({ id: langId });
          existingLangs.add(langId);
          registered = true;
        }
      }
    }
  }

  // Also check grammars for languages not yet registered
  const grammars = await getAllGrammars();
  for (const grammar of grammars) {
    if (grammar.language && !existingLangs.has(grammar.language)) {
      monaco.languages.register({ id: grammar.language });
      existingLangs.add(grammar.language);
      registered = true;
    }
  }

  // Refresh the language detection cache if we registered anything new
  if (registered) {
    refreshLanguageCache(monaco);
  }
 
 } catch (error) {
  console.log(error)
 }
}

/* ── Full Lifecycle ────────────────────────────────────────── */

/**
 * Load all resources from all enabled extensions into Monaco.
 * Call this once on editor initialization.
 */
export async function loadAllExtensions(
  monaco: Monaco,
  editor?: monacoNs.editor.ICodeEditor,
): Promise<{
  themes: string[];
  grammars: string[];
  snippets: string[];
  commands: string[];
  keybindings: string[];
  configProperties: number;
  jsonSchemas: number;
  icons: string[];
  extensions: InstalledExtension[];
}> {
  const extensions = await getEnabledExtensions();
 
  // Register languages first
  await registerExtensionLanguages(monaco);

  // Then themes, grammars, and snippets
  const [themes, grammars, snippets] = await Promise.all([
    loadAllExtensionThemes(monaco),
    loadAllExtensionGrammars(monaco, editor),
    loadAllExtensionSnippets(monaco),
  ]);

  // Load new contribution types
  const [commands, keybindings, configProperties, jsonSchemas, icons] = await Promise.all([
    loadExtensionCommands(monaco, editor),
    loadExtensionKeybindings(monaco, editor),
    loadExtensionConfigurations(monaco),
    loadExtensionJsonValidation(monaco),
    loadExtensionIcons(),
  ]);

  return { themes, grammars, snippets, commands, keybindings, configProperties, jsonSchemas, icons, extensions };
}

/**
 * High-level: install an extension from Open VSX.
 *
 * 1. Fetch metadata from Open VSX
 * 2. Download the VSIX archive
 * 3. Extract contents (themes, grammars, snippets, etc.)
 * 4. Store everything in IndexedDB
 * 5. Load into the current Monaco editor
 *
 * @param publisher   Extension publisher (e.g. "Catppuccin")
 * @param name        Extension name (e.g. "catppuccin-vsc")
 * @param monaco      Monaco namespace
 * @param editor      Optional editor instance
 * @param onProgress  Progress callback
 */
export async function installExtensionFromOpenVSX(
  publisher: string,
  name: string,
  monaco: Monaco,
  editor?: monacoNs.editor.ICodeEditor,
  onProgress?: InstallProgress,
): Promise<InstalledExtension> {
  try {
    // 1. Fetch metadata
    onProgress?.("fetching", `${publisher}.${name}`);
    const extMeta = await getExtension(publisher, name);

    // 2. Download VSIX
    onProgress?.("downloading", `${extMeta.version}`);
    if (!extMeta.files.download) {
      throw new Error("No download URL found for this extension");
    }
    const buffer = await downloadVSIX(extMeta.files.download);

    // 3. Extract
    onProgress?.("extracting");
    const vsix = await extractVSIX(buffer);

    // 3b. Fetch README from Open VSX if not in VSIX
    let readme = vsix.readme;
    if (!readme && extMeta.files.readme) {
      try {
        const readmeRes = await fetch(extMeta.files.readme);
        if (readmeRes.ok) readme = await readmeRes.text();
      } catch { /* ignore README fetch failure */ }
    }

    // 4. Store in IDB
    onProgress?.("storing");
    const installed = await saveExtension(publisher, name, vsix, {
      displayName: extMeta.displayName,
      description: extMeta.description,
      version: extMeta.version,
      iconUrl: extMeta.files.icon,
      categories: extMeta.categories,
      readme,
    });

    // 5. Load into Monaco
    onProgress?.("loading");

    // Register contributed languages first (with extensions, aliases, filenames)
    const existingLangs = new Set(monaco.languages.getLanguages().map((l) => l.id));
    for (const lang of vsix.languages) {
      if (!existingLangs.has(lang.id)) {
        monaco.languages.register({
          id: lang.id,
          extensions: lang.extensions,
          aliases: lang.aliases,
          filenames: lang.filenames,
        });
        existingLangs.add(lang.id);
      }

      // Apply language configuration (brackets, auto-close, comments, etc.)
      if (lang.configurationContent) {
        try {
          const monacoConfig = convertVSCodeLanguageConfig(lang.configurationContent);
          monaco.languages.setLanguageConfiguration(lang.id, monacoConfig);
        } catch (err) {
          console.warn(`[extensionLoader] Failed to set language config for "${lang.id}":`, err);
        }
      }
    }

    // Refresh detection cache after registering new languages
    if (vsix.languages.length > 0) {
      refreshLanguageCache(monaco);
    }

    for (const theme of vsix.themes) {
      const storedTheme: StoredTheme = {
        id: `${installed.id}::${theme.id}`,
        extensionId: installed.id,
        themeId: theme.id,
        label: theme.label,
        uiTheme: theme.uiTheme,
        content: theme.content,
      };
      registerExtensionTheme(monaco, storedTheme);
    }

    for (const grammar of vsix.grammars) {
      const storedGrammar: StoredGrammar = {
        id: `${installed.id}::${grammar.scopeName}`,
        extensionId: installed.id,
        scopeName: grammar.scopeName,
        language: grammar.language,
        content: grammar.content,
        parsed: grammar.parsed,
      };
      await registerExtensionGrammar(monaco, storedGrammar, editor);
    }

    // Register snippets for all languages contributed by this extension
    for (const snippet of vsix.snippets) {
      try {
        await loadExtensionSnippets(monaco, snippet.language);
      } catch (err) {
        console.warn(`[extensionLoader] Failed to load snippets for "${snippet.language}":`, err);
      }
    }

    // Register new contribution types (commands, keybindings, config, colors, icons, jsonValidation)
    await loadExtensionCommands(monaco, editor);
    await loadExtensionKeybindings(monaco, editor);
    await loadExtensionConfigurations(monaco);
    await loadExtensionJsonValidation(monaco);
    await loadExtensionIcons(installed.id);

    onProgress?.("done", installed.id);
    return installed;
  } catch (err) {
    onProgress?.("error", (err as Error).message);
    throw err;
  }
}

/**
 * Uninstall an extension and clean up Monaco registrations.
 * Note: themes defined with defineTheme cannot be unregistered —
 * they'll be gone on next page load.
 */
export async function uninstallExtensionFull(extensionId: string): Promise<void> {
  // Clean up injected icon styles
  const iconStyle = iconStyleElements.get(extensionId);
  if (iconStyle) {
    iconStyle.remove();
    iconStyleElements.delete(extensionId);
  }

  await uninstallExtension(extensionId);
}

/**
 * Install a VSIX extension from a File (drag-and-drop or file picker).
 *
 * @param file        The .vsix file
 * @param monaco      Monaco namespace
 * @param editor      Optional editor instance
 * @param onProgress  Progress callback
 */
export async function installExtensionFromVSIX(
  file: File,
  monaco: Monaco,
  editor?: monacoNs.editor.ICodeEditor,
  onProgress?: InstallProgress,
): Promise<InstalledExtension> {
  try {
    onProgress?.("extracting", file.name);
    const buffer = await file.arrayBuffer();
    const vsix = await extractVSIX(buffer);

    const pkgJson = vsix.packageJson;
    const publisher = (pkgJson.publisher as string) ?? "local";
    const name = (pkgJson.name as string) ?? file.name.replace(/\.vsix$/i, "");
    const displayName = (pkgJson.displayName as string) ?? name;
    const description = (pkgJson.description as string) ?? "";
    const version = (pkgJson.version as string) ?? "0.0.0";

    onProgress?.("storing", `${publisher}.${name}`);
    const installed = await saveExtension(publisher, name, vsix, {
      displayName,
      description,
      version,
      readme: vsix.readme,
    });

    onProgress?.("loading");

    // Register contributed languages
    const existingLangs = new Set(monaco.languages.getLanguages().map((l) => l.id));
    for (const lang of vsix.languages) {
      if (!existingLangs.has(lang.id)) {
        monaco.languages.register({
          id: lang.id,
          extensions: lang.extensions,
          aliases: lang.aliases,
          filenames: lang.filenames,
        });
      }

      // Apply language configuration (brackets, auto-close, comments, etc.)
      if (lang.configurationContent) {
        try {
          const monacoConfig = convertVSCodeLanguageConfig(lang.configurationContent);
          monaco.languages.setLanguageConfiguration(lang.id, monacoConfig);
        } catch (err) {
          console.warn(`[extensionLoader] Failed to set language config for "${lang.id}":`, err);
        }
      }
    }
    if (vsix.languages.length > 0) {
      refreshLanguageCache(monaco);
    }

    // Register themes
    for (const theme of vsix.themes) {
      const storedTheme: StoredTheme = {
        id: `${installed.id}::${theme.id}`,
        extensionId: installed.id,
        themeId: theme.id,
        label: theme.label,
        uiTheme: theme.uiTheme,
        content: theme.content,
      };
      registerExtensionTheme(monaco, storedTheme);
    }

    // Register grammars
    for (const grammar of vsix.grammars) {
      const storedGrammar: StoredGrammar = {
        id: `${installed.id}::${grammar.scopeName}`,
        extensionId: installed.id,
        scopeName: grammar.scopeName,
        language: grammar.language,
        content: grammar.content,
        parsed: grammar.parsed,
      };
      await registerExtensionGrammar(monaco, storedGrammar, editor);
    }

    // Register snippets for all languages contributed by this extension
    for (const snippet of vsix.snippets) {
      try {
        await loadExtensionSnippets(monaco, snippet.language);
      } catch (err) {
        console.warn(`[extensionLoader] Failed to load snippets for "${snippet.language}":`, err);
      }
    }

    // Register new contribution types (commands, keybindings, config, colors, icons, jsonValidation)
    await loadExtensionCommands(monaco, editor);
    await loadExtensionKeybindings(monaco, editor);
    await loadExtensionConfigurations(monaco);
    await loadExtensionJsonValidation(monaco);
    await loadExtensionIcons(installed.id);

    onProgress?.("done", installed.id);
    return installed;
  } catch (err) {
    onProgress?.("error", (err as Error).message);
    throw err;
  }
}

/**
 * Toggle an extension on/off.
 */
export { toggleExtension, getInstalledExtensions, getEnabledExtensions };

/**
 * Get a list of all available theme IDs from installed extensions.
 */
export async function getAvailableExtensionThemes(): Promise<
  Array<{ themeId: string; label: string; extensionId: string; uiTheme: string }>
> {
  const themes = await getAllThemes();
  return themes.map((t) => ({
    themeId: t.themeId,
    label: t.label,
    extensionId: t.extensionId,
    uiTheme: t.uiTheme,
  }));
}