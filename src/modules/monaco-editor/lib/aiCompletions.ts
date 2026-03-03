/**
 * @module lib/monaco/aiCompletions
 *
 * Dynamic AI Completion Provider for Monaco Editor.
 *
 * Features:
 *  - Fetches AI completions from a configurable API endpoint
 *  - **Async provideCompletionItems** — returns cached instantly, fetches fresh in background
 *  - Debounce-fetches in background as the user types (2 s default)
 *  - Caches results in IndexedDB (Dexie `assets` store)
 *  - Serves cached completions instantly while a fresh fetch is pending
 *  - **CodeLens** — shows ✨ Fetch Snippets buttons on function / class declarations
 *  - **Ctrl+Alt+A** keybinding + right-click context menu — manually triggers AI completions
 *  - Returns a deregister/dispose handle
 */

import type * as monacoNs from "monaco-editor";
import { idbGet, idbSet, STORE_ASSETS } from "../extensions/idb";

type Monaco = typeof monacoNs;

/* ── Public types ──────────────────────────────────────────── */

/** A user-defined custom right-click context menu entry */
export interface CustomContextMenuItem {
  /** Unique identifier (auto-generated if omitted) */
  id?: string;
  /** Display label in the context menu */
  label: string;
  /**
   * What happens when the item is clicked. One of:
   *  - `"command:<monaco-command-id>"` — run a built-in Monaco command
   *  - `"url:<endpoint>"` — POST the current selection/context to a URL
   *  - `"insert:<text>"` — insert literal text at cursor
   */
  action: string;
  /** Optional keyboard shortcut description (display only, not bound) */
  shortcut?: string;
}

export interface AICompletionConfig {
  /** API endpoint URL that returns AI completion items */
  endpoint: string;
  /** Language ID to register the provider for (e.g. "typescript") */
  languageId: string;
  /** File name (e.g. "app.tsx") — sent in the request body */
  filename?: string;
  /** Debounce delay in ms after last keystroke before background fetch (default: 2000) */
  debounceMs?: number;
  /**
   * Trigger characters that invoke the provider inline.
   * Default: ["."]
   */
  triggerCharacters?: string[];
  /** Extra headers to send with the fetch request */
  headers?: Record<string, string>;
  /** Called when fetch fails */
  onError?: (error: Error) => void;
  /** Called when new completions are stored */
  onCompletionsUpdated?: (count: number) => void;
  /** Enable CodeLens "AI Suggest" buttons on functions/classes (default: true) */
  enableCodeLens?: boolean;
  /** User-defined custom context menu items registered on the editor */
  customContextMenuItems?: CustomContextMenuItem[];
}

/** Shape of a single completion item returned by the AI API */
export interface AICompletionItem {
  label: string;
  /** Numeric kind — mapped via `resolveKind()` to Monaco enum */
  kind?: number;
  detail?: string;
  documentation?: string;
  insertText: string;
  /** 4 = InsertAsSnippet (Monaco InsertTextRule) */
  insertTextRules?: number;
  /** Optional sort priority (lower = higher priority) */
  sortText?: string;
  /** Optional filter text for fuzzy matching */
  filterText?: string;
  /** Optional preselect flag */
  preselect?: boolean;
}

/** Expected API response shape */
export interface AICompletionResponse {
  items: AICompletionItem[];
  /** Optional error message */
  error?: string;
}

/** Handle returned by registerAICompletions */
export interface AICompletionRegistration {
  /** Dispose the provider and stop background fetching */
  dispose(): void;
  /** Force a fetch right now (ignores debounce) */
  fetchNow(): Promise<void>;
  /** Update the endpoint URL at runtime */
  setEndpoint(url: string): void;
  /** Get the number of currently cached items */
  getCachedCount(): number;
}

/* ── Kind resolver ─────────────────────────────────────────── */

const KIND_MAP: Record<number, string> = {
  0: "Method",
  1: "Function",
  2: "Constructor",
  3: "Field",
  4: "Variable",
  5: "Class",
  6: "Struct",
  7: "Interface",
  8: "Module",
  9: "Property",
  10: "Event",
  11: "Operator",
  12: "Unit",
  13: "Value",
  14: "Constant",
  15: "Enum",
  16: "EnumMember",
  17: "Keyword",
  18: "Text",
  19: "Color",
  20: "File",
  21: "Reference",
  22: "Customcolor",
  23: "Folder",
  24: "TypeParameter",
  25: "User",
  26: "Issue",
  27: "Snippet",
};

/**
 * Map a numeric kind to its Monaco `CompletionItemKind` enum value.
 * Falls back to `Text` for unknown kinds.
 */
export function resolveKind(
  monaco: Monaco,
  kind?: number,
): monacoNs.languages.CompletionItemKind {
  if (kind == null) return monaco.languages.CompletionItemKind.Text;

  const name = KIND_MAP[kind];
  if (name && name in monaco.languages.CompletionItemKind) {
    return (monaco.languages.CompletionItemKind as any)[name];
  }
  return monaco.languages.CompletionItemKind.Text;
}

/* ── IDB helpers ───────────────────────────────────────────── */

function cacheKey(languageId: string): string {
  return `ai-completions::${languageId}`;
}

async function loadCachedItems(languageId: string): Promise<AICompletionItem[]> {
  try {
    const raw = await idbGet(STORE_ASSETS, cacheKey(languageId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveCachedItems(languageId: string, items: AICompletionItem[]): Promise<void> {
  await idbSet(STORE_ASSETS, cacheKey(languageId), JSON.stringify(items));
}

/* ── Symbol detection for CodeLens ─────────────────────────── */

/** Regex patterns that detect function/class/interface declarations per language family */
const SYMBOL_PATTERNS: Array<{
  langs: string[];
  patterns: RegExp[];
}> = [
  {
    // JS / TS
    langs: ["javascript", "typescript", "javascriptreact", "typescriptreact"],
    patterns: [
      /^\s*(?:export\s+)?(?:async\s+)?function\s+(\w+)/,
      /^\s*(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[a-zA-Z_]\w*)\s*=>/,
      /^\s*(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/,
      /^\s*(?:export\s+)?interface\s+(\w+)/,
      /^\s*(?:export\s+)?type\s+(\w+)/,
      /^\s*(?:export\s+)?enum\s+(\w+)/,
    ],
  },
  {
    // Python
    langs: ["python"],
    patterns: [
      /^\s*(?:async\s+)?def\s+(\w+)/,
      /^\s*class\s+(\w+)/,
    ],
  },
  {
    // Go
    langs: ["go"],
    patterns: [
      /^\s*func\s+(?:\([^)]+\)\s+)?(\w+)/,
      /^\s*type\s+(\w+)\s+(?:struct|interface)/,
    ],
  },
  {
    // Rust
    langs: ["rust"],
    patterns: [
      /^\s*(?:pub\s+)?(?:async\s+)?fn\s+(\w+)/,
      /^\s*(?:pub\s+)?(?:struct|enum|trait)\s+(\w+)/,
    ],
  },
  {
    // Java / Kotlin / C# / C++
    langs: ["java", "kotlin", "csharp", "cpp", "c"],
    patterns: [
      /^\s*(?:public|private|protected|static|abstract|final|virtual|override|\s)*\s*(?:class|struct|interface)\s+(\w+)/,
      /^\s*(?:public|private|protected|static|abstract|virtual|override|\s)*\s*\w+\s+(\w+)\s*\(/,
    ],
  },
  {
    // PHP
    langs: ["php"],
    patterns: [
      /^\s*(?:public|private|protected|static|\s)*function\s+(\w+)/,
      /^\s*(?:abstract\s+)?class\s+(\w+)/,
    ],
  },
  {
    // Ruby
    langs: ["ruby"],
    patterns: [
      /^\s*def\s+(\w+)/,
      /^\s*class\s+(\w+)/,
      /^\s*module\s+(\w+)/,
    ],
  },
];

interface SymbolLine {
  line: number;    // 1-based
  name: string;
}

/** Scan content for function/class declarations. Returns 1-based lines. */
function findSymbolLines(content: string, languageId: string): SymbolLine[] {
  const family = SYMBOL_PATTERNS.find((f) => f.langs.includes(languageId));
  if (!family) return [];

  const lines = content.split("\n");
  const result: SymbolLine[] = [];

  for (let i = 0; i < lines.length; i++) {
    for (const pat of family.patterns) {
      const m = lines[i].match(pat);
      if (m && m[1] && !["if", "for", "while", "switch", "return"].includes(m[1])) {
        result.push({ line: i + 1, name: m[1] });
        break;
      }
    }
  }
  return result;
}

/* ── Main registration ─────────────────────────────────────── */

/**
 * Register a dynamic AI completion provider for Monaco.
 *
 * - **provideCompletionItems is async**: always fetches live from the API on
 *   Ctrl+Space / trigger chars. Returns cached items immediately as a baseline,
 *   then the next invocation will have the fresh data.
 * - Background debounce-fetch keeps the cache warm as the user types.
 * - CodeLens "Fetch Snippets" buttons on functions/classes/interfaces.
 * - Ctrl+Shift+A keybinding to trigger suggestions manually.
 */
export function registerAICompletions(
  monaco: Monaco,
  editor: monacoNs.editor.IStandaloneCodeEditor,
  config: AICompletionConfig,
): AICompletionRegistration {
  const {
    languageId,
    filename: configFilename,
    debounceMs = 2000,
    triggerCharacters = ["."],
    headers = {},
    onError,
    onCompletionsUpdated,
    enableCodeLens = true,
  } = config;

  let endpoint = config.endpoint;
  let disposed = false;
  let cachedItems: AICompletionItem[] = [];
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let fetchController: AbortController | null = null;
  const disposables: monacoNs.IDisposable[] = [];

  /* ── Build request body ────────────────────────────────── */
  function buildRequestBody(
    overridePosition?: monacoNs.Position,
  ): string {
    const model = editor.getModel();
    const position = overridePosition ?? editor.getPosition();
    const content = model?.getValue() ?? "";
    const lang = model?.getLanguageId() ?? languageId;

    const visibleRanges = editor.getVisibleRanges();
    const vr = visibleRanges?.[0];
    const range = vr
      ? {
          startLineNumber: vr.startLineNumber,
          startColumn: vr.startColumn,
          endLineNumber: vr.endLineNumber,
          endColumn: vr.endColumn,
        }
      : undefined;

    return JSON.stringify({
      language: lang,
      filename: configFilename ?? model?.uri?.path?.split("/").pop() ?? "untitled",
      range,
      content,
      position: position
        ? { line: position.lineNumber, column: position.column }
        : undefined,
    });
  }

  /* ── Fetch from endpoint ──────────────────────────────── */
  let fetchInProgress = false;

  async function fetchCompletions(
    overridePosition?: monacoNs.Position,
  ): Promise<AICompletionItem[]> {
    if (disposed) return cachedItems;

    // If a request is already in progress, skip this one (don't cancel the pending one)
    if (fetchInProgress) {
      console.log(`[AI Completions] Skipping — request already in progress for ${languageId}`);
      return cachedItems;
    }

    fetchInProgress = true;
    fetchController = new AbortController();

    try {
      const body = buildRequestBody(overridePosition);
      console.log(`[AI Completions] Fetching for ${languageId} from ${endpoint}`);

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
        body,
        signal: fetchController.signal,
      });

      if (!res.ok) {
        throw new Error(`AI completions endpoint returned ${res.status}`);
      }

      const data: AICompletionResponse = await res.json();
      console.log(`[AI Completions] Response for ${languageId}:`, {
        hasItems: Array.isArray(data.items),
        count: data.items?.length ?? 0,
        error: data.error,
      });

      if (data.error) {
        throw new Error(data.error);
      }

      if (Array.isArray(data.items) && data.items.length > 0) {
        cachedItems = data.items;
        saveCachedItems(languageId, cachedItems)
          .then(() => console.log(`[AI Completions] Saved ${cachedItems.length} items to IDB for ${languageId}`))
          .catch((err) => console.error(`[AI Completions] IDB save failed for ${languageId}:`, err));
        onCompletionsUpdated?.(cachedItems.length);
      } else {
        console.warn(`[AI Completions] No items in response for ${languageId}`);
      }
    } catch (err: any) {
      if (err?.name === "AbortError") return cachedItems;
      console.error(`[AI Completions] Fetch failed for ${languageId}:`, err);
      onError?.(err instanceof Error ? err : new Error(String(err)));
    } finally {
      fetchController = null;
      fetchInProgress = false;
    }
    return cachedItems;
  }

  /* ── Convert cached items to Monaco suggestions ────────── */
  function toSuggestions(
    items: AICompletionItem[],
    model: monacoNs.editor.ITextModel,
    position: monacoNs.Position,
  ): monacoNs.languages.CompletionItem[] {
    const word = model.getWordUntilPosition(position);
    const range: monacoNs.IRange = {
      startLineNumber: position.lineNumber,
      endLineNumber: position.lineNumber,
      startColumn: word.startColumn,
      endColumn: word.endColumn,
    };

    return items.map((item, idx) => {
      const kind = resolveKind(monaco, item.kind);
      const insertTextRules =
        item.insertTextRules === 4
          ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
          : undefined;

      return {
        label: item.label,
        kind,
        detail: item.detail ?? "✨ AI",
        documentation: item.documentation
          ? { value: item.documentation, isTrusted: true }
          : undefined,
        insertText: item.insertText,
        insertTextRules,
        range,
        sortText: item.sortText ?? `a_ai_${String(idx).padStart(4, "0")}`,
        filterText: item.filterText ?? item.label,
        preselect: item.preselect,
      } satisfies monacoNs.languages.CompletionItem;
    });
  }

  /* ── Load from IDB on startup — only fetch if cache is empty ── */
  loadCachedItems(languageId).then((items) => {
    console.log(`[AI Completions] IDB cache load for ${languageId}: ${items.length} items`);
    if (!disposed && items.length > 0) {
      cachedItems = items;
      onCompletionsUpdated?.(cachedItems.length);
    } else if (!disposed) {
      // No cached items — auto-fetch once on mount
      console.log(`[AI Completions] No cache for ${languageId}, fetching from server…`);
      fetchCompletions();
    }
  });

  /* ── Completion provider (returns cached instantly — no background fetch) */
  disposables.push(
    monaco.languages.registerCompletionItemProvider(languageId, {
      triggerCharacters,

      provideCompletionItems(
        model: monacoNs.editor.ITextModel,
        position: monacoNs.Position,
        _ctx: monacoNs.languages.CompletionContext,
      ): monacoNs.languages.CompletionList {
        // Return cached items immediately — user must manually fetch via
        // context menu / Ctrl+Alt+A / CodeLens to refresh from server
        const suggestions = toSuggestions(cachedItems, model, position);
        return { suggestions };
      },
    }),
  );

  /* ── Context menu + keybinding ─────────────────────────── */

  // "Fetch Snippets" — always visible in right-click context menu + Ctrl+Alt+A
  // Works for ALL file types regardless of language
  disposables.push(
    editor.addAction({
      id: "ai-completions.suggest",
      label: "Fetch Snippets",
      keybindings: [
        monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.KeyA,
      ],
      contextMenuGroupId: "1_ai",
      contextMenuOrder: 0,
      run: () => {
        // Show suggest widget immediately with cached items
        editor.trigger("ai-completions", "editor.action.triggerSuggest", {});
        // Fetch fresh in background; re-trigger when done
        fetchCompletions().then((items) => {
          if (!disposed && items.length > 0) {
            editor.trigger("ai-completions", "editor.action.triggerSuggest", {});
          }
        });
      },
    }),
  );

  /* ── User-defined custom context menu items ────────────── */
  const customItems = config.customContextMenuItems ?? [];
  for (let i = 0; i < customItems.length; i++) {
    const item = customItems[i];
    const actionId = item.id ?? `custom-ctx-menu.${i}.${item.label.replace(/\s+/g, "-").toLowerCase()}`;

    disposables.push(
      editor.addAction({
        id: actionId,
        label: item.label,
        contextMenuGroupId: "2_custom",
        contextMenuOrder: i + 1,
        run: (ed) => {
          const action = item.action;
          const model = ed.getModel();
          const sel = ed.getSelection();
          const selectedText = sel && model ? model.getValueInRange(sel) : "";

          if (action.startsWith("command:")) {
            // Run a built-in Monaco command
            const cmdId = action.slice("command:".length).trim();
            ed.trigger("custom-ctx", cmdId, {});
          } else if (action.startsWith("url:")) {
            // POST context to a URL endpoint
            const url = action.slice("url:".length).trim();
            const body = JSON.stringify({
              language: model?.getLanguageId() ?? languageId,
              filename: configFilename ?? model?.uri?.path?.split("/").pop() ?? "untitled",
              selection: selectedText,
              content: model?.getValue() ?? "",
              position: ed.getPosition()
                ? { line: ed.getPosition()!.lineNumber, column: ed.getPosition()!.column }
                : undefined,
            });
            fetch(url, {
              method: "POST",
              headers: { "Content-Type": "application/json", ...headers },
              body,
            })
              .then(async (res) => {
                if (!res.ok) throw new Error(`Custom action endpoint returned ${res.status}`);
                const data = await res.json();
                // If the response has `insertText`, insert it at cursor
                if (data.insertText && typeof data.insertText === "string") {
                  const pos = ed.getPosition();
                  if (pos && model) {
                    model.pushEditOperations(
                      [],
                      [{ range: sel ?? { startLineNumber: pos.lineNumber, startColumn: pos.column, endLineNumber: pos.lineNumber, endColumn: pos.column }, text: data.insertText }],
                      () => null,
                    );
                  }
                }
                // If the response has `items` (AI completions format), update cache
                if (Array.isArray(data.items) && data.items.length > 0) {
                  cachedItems = data.items;
                  saveCachedItems(languageId, cachedItems).catch(() => {});
                  onCompletionsUpdated?.(cachedItems.length);
                  ed.trigger("custom-ctx", "editor.action.triggerSuggest", {});
                }
              })
              .catch((err) => {
                console.error(`[Custom Context Menu] URL action failed:`, err);
                onError?.(err instanceof Error ? err : new Error(String(err)));
              });
          } else if (action.startsWith("insert:")) {
            // Insert literal text at cursor/selection
            const text = action.slice("insert:".length);
            const pos = ed.getPosition();
            if (pos && model) {
              model.pushEditOperations(
                [],
                [{ range: sel ?? { startLineNumber: pos.lineNumber, startColumn: pos.column, endLineNumber: pos.lineNumber, endColumn: pos.column }, text }],
                () => null,
              );
            }
          } else {
            // Fallback: treat as Monaco command ID
            ed.trigger("custom-ctx", action, {});
          }
        },
      }),
    );
  }

  /* ── CodeLens: "Fetch Snippets" on functions/classes ────── */
  let codeLensDisposable: monacoNs.IDisposable | null = null;

  if (enableCodeLens) {
    const CODELENS_COMMAND_ID = `ai-completions.codeLens.${languageId}`;

    // Register command for CodeLens clicks
    disposables.push(
      editor.addAction({
        id: CODELENS_COMMAND_ID,
        label: "AI Suggest from CodeLens",
        run: (_ed, lineNumber?: number) => {
          if (typeof lineNumber === "number") {
            const model = _ed.getModel();
            if (model) {
              const lineContent = model.getLineContent(lineNumber);
              const col = lineContent.search(/\S/) + 1 || 1;
              _ed.setPosition({ lineNumber, column: col });
              _ed.revealLineInCenter(lineNumber);
            }
          }
          _ed.trigger("ai-codelens", "editor.action.triggerSuggest", {});
        },
      }),
    );

    codeLensDisposable = monaco.languages.registerCodeLensProvider(languageId, {
      provideCodeLenses(
        model: monacoNs.editor.ITextModel,
      ): monacoNs.languages.CodeLensList {
        const content = model.getValue();
        const lang = model.getLanguageId();
        const symbols = findSymbolLines(content, lang);

        const lenses: monacoNs.languages.CodeLens[] = symbols.map((sym) => ({
          range: {
            startLineNumber: sym.line,
            startColumn: 1,
            endLineNumber: sym.line,
            endColumn: 1,
          },
          command: {
            id: CODELENS_COMMAND_ID,
            title: `Fetch Snippets`,
            tooltip: `Get AI completions for "${sym.name}"`,
            arguments: [sym.line],
          },
        }));

        return { lenses, dispose: () => {} };
      },

      resolveCodeLens(
        _model: monacoNs.editor.ITextModel,
        codeLens: monacoNs.languages.CodeLens,
      ): monacoNs.languages.CodeLens {
        return codeLens;
      },
    });

    disposables.push(codeLensDisposable);

    // Refresh CodeLenses when content changes (debounced via Monaco)
    disposables.push(
      editor.onDidChangeModelContent(() => {
        // Monaco auto-refreshes CodeLenses; no manual action needed
      }),
    );
  }

  /* ── Public handle ─────────────────────────────────────── */
  return {
    dispose() {
      if (disposed) return;
      disposed = true;

      if (debounceTimer) clearTimeout(debounceTimer);
      if (fetchController) fetchController.abort();

      for (const d of disposables) {
        try { d.dispose(); } catch { /* */ }
      }
      disposables.length = 0;
    },

    async fetchNow() {
      if (debounceTimer) clearTimeout(debounceTimer);
      await fetchCompletions();
    },

    setEndpoint(url: string) {
      endpoint = url;
    },

    getCachedCount() {
      return cachedItems.length;
    },
  };
}
