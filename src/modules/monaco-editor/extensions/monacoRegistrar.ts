/**
 * @module monaco-editor/extensions/monacoRegistrar
 *
 * Registers snippets, language configuration, and grammars into Monaco
 * from data fetched + stored by the asset loader.
 *
 * This module is the bridge between our IDB storage and the Monaco API.
 */

import type * as monacoNs from "monaco-editor";

type Monaco = typeof monacoNs;

/* ── State ─────────────────────────────────────────────────── */

/** Track registered snippet disposables per language */
const snippetDisposables = new Map<string, monacoNs.IDisposable[]>();

/** Track languages for which we applied language configuration */
const appliedLangConfig = new Set<string>();

/** Track registered grammars */
const registeredGrammars = new Set<string>();

/* ── Types (VS Code snippet format) ──────────────────────── */

interface VSCodeSnippet {
  prefix: string | string[];
  body: string | string[];
  description?: string;
}

type SnippetFile = Record<string, VSCodeSnippet>;

/* ── Language Configuration types ────────────────────────── */

interface CommentRule {
  lineComment?: string;
  blockComment?: [string, string];
}

interface AutoClosingPair {
  open: string;
  close: string;
  notIn?: string[];
}

interface IndentationRule {
  increaseIndentPattern?: string;
  decreaseIndentPattern?: string;
}

interface LanguageConfigJson {
  comments?: CommentRule;
  brackets?: [string, string][];
  autoClosingPairs?: (AutoClosingPair | [string, string])[];
  surroundingPairs?: [string, string][];
  wordPattern?: string;
  indentationRules?: IndentationRule;
  folding?: {
    markers?: {
      start?: string;
      end?: string;
    };
  };
  onEnterRules?: Array<{
    beforeText: string;
    afterText?: string;
    action: { indent: string; appendText?: string };
  }>;
}

/* ── Public: Snippets ────────────────────────────────────── */

/**
 * Register snippets for a language from parsed VSCode snippet JSON(s).
 * Supports multiple snippet files (the extension may bundle several).
 */
export function registerSnippets(
  monaco: Monaco,
  languageId: string,
  snippetFiles: Map<string, unknown>,
): monacoNs.IDisposable[] {
  // Dispose previous registrations for this language
  const existing = snippetDisposables.get(languageId);
  if (existing) {
    existing.forEach((d) => d.dispose());
  }

  const disposables: monacoNs.IDisposable[] = [];

  for (const [, raw] of snippetFiles) {
    const file = raw as SnippetFile;
    if (!file || typeof file !== "object") continue;

    const entries = Object.entries(file);
    if (entries.length === 0) continue;

    const disposable = monaco.languages.registerCompletionItemProvider(languageId, {
      provideCompletionItems(model, position) {
        const word = model.getWordUntilPosition(position);
        const range: monacoNs.IRange = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        };

        const suggestions: monacoNs.languages.CompletionItem[] = entries.map(
          ([name, snippet]) => {
            const prefixes = Array.isArray(snippet.prefix)
              ? snippet.prefix
              : [snippet.prefix];
            const body = Array.isArray(snippet.body)
              ? snippet.body.join("\n")
              : snippet.body;

            return {
              label: {
                label: prefixes[0],
                description: `Snippet`,
              },
              kind: monaco.languages.CompletionItemKind.Snippet,
              documentation: {
                value: `**${name}**${snippet.description ? `\n\n${snippet.description}` : ""}\n\n\`\`\`\n${body}\n\`\`\``,
              },
              insertText: body,
              insertTextRules:
                monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              detail: name,
              range,
              filterText: prefixes[0],
              sortText: `b_snippet_${prefixes[0]}`,
            };
          },
        );

        return { suggestions };
      },
    });

    disposables.push(disposable);
  }

  snippetDisposables.set(languageId, disposables);
  return disposables;
}

/* ── Public: Language Configuration ──────────────────────── */

/**
 * Apply a language-configuration.json from a VSCode extension to Monaco.
 * This sets brackets, comments, auto-closing pairs, etc.
 */
export function applyLanguageConfiguration(
  monaco: Monaco,
  languageId: string,
  config: unknown,
): monacoNs.IDisposable | null {
  if (appliedLangConfig.has(languageId)) return null;
  if (!config || typeof config !== "object") return null;

  const cfg = config as LanguageConfigJson;

  try {
    // Ensure the language is registered
    const langs = monaco.languages.getLanguages();
    if (!langs.find((l) => l.id === languageId)) {
      monaco.languages.register({ id: languageId });
    }

    const langConfig: monacoNs.languages.LanguageConfiguration = {};

    // Comments
    if (cfg.comments) {
      langConfig.comments = {
        lineComment: cfg.comments.lineComment,
        blockComment: cfg.comments.blockComment,
      };
    }

    // Brackets
    if (cfg.brackets) {
      langConfig.brackets = cfg.brackets;
    }

    // Auto-closing pairs
    if (cfg.autoClosingPairs) {
      langConfig.autoClosingPairs = cfg.autoClosingPairs.map((pair) => {
        if (Array.isArray(pair)) {
          return { open: pair[0], close: pair[1] };
        }
        return pair;
      });
    }

    // Surrounding pairs
    if (cfg.surroundingPairs) {
      langConfig.surroundingPairs = cfg.surroundingPairs.map(([open, close]) => ({
        open,
        close,
      }));
    }

    // Word pattern
    if (cfg.wordPattern) {
      try {
        langConfig.wordPattern = new RegExp(cfg.wordPattern);
      } catch {
        // Invalid regex, skip
      }
    }

    // Indentation rules
    if (cfg.indentationRules) {
      const ir: monacoNs.languages.IndentationRule = {} as monacoNs.languages.IndentationRule;
      if (cfg.indentationRules.increaseIndentPattern) {
        try {
          ir.increaseIndentPattern = new RegExp(cfg.indentationRules.increaseIndentPattern);
        } catch { /* skip */ }
      }
      if (cfg.indentationRules.decreaseIndentPattern) {
        try {
          ir.decreaseIndentPattern = new RegExp(cfg.indentationRules.decreaseIndentPattern);
        } catch { /* skip */ }
      }
      if (ir.increaseIndentPattern || ir.decreaseIndentPattern) {
        langConfig.indentationRules = ir;
      }
    }

    // Folding markers
    if (cfg.folding?.markers) {
      const foldingMarkers: { start?: RegExp; end?: RegExp } = {};
      if (cfg.folding.markers.start) {
        try { foldingMarkers.start = new RegExp(cfg.folding.markers.start); } catch { /* skip */ }
      }
      if (cfg.folding.markers.end) {
        try { foldingMarkers.end = new RegExp(cfg.folding.markers.end); } catch { /* skip */ }
      }
      if (foldingMarkers.start || foldingMarkers.end) {
        langConfig.folding = { markers: foldingMarkers as { start: RegExp; end: RegExp } };
      }
    }

    // On-enter rules
    if (cfg.onEnterRules && Array.isArray(cfg.onEnterRules)) {
      langConfig.onEnterRules = cfg.onEnterRules
        .map((rule) => {
          try {
            return {
              beforeText: new RegExp(rule.beforeText),
              afterText: rule.afterText ? new RegExp(rule.afterText) : undefined,
              action: {
                indentAction:
                  rule.action.indent === "indent"
                    ? monaco.languages.IndentAction.Indent
                    : rule.action.indent === "outdent"
                      ? monaco.languages.IndentAction.Outdent
                      : rule.action.indent === "indentOutdent"
                        ? monaco.languages.IndentAction.IndentOutdent
                        : monaco.languages.IndentAction.None,
                appendText: rule.action.appendText,
              },
            };
          } catch {
            return null;
          }
        })
        .filter(Boolean) as monacoNs.languages.OnEnterRule[];
    }

    const disposable = monaco.languages.setLanguageConfiguration(languageId, langConfig);
    appliedLangConfig.add(languageId);
    return disposable;
  } catch (err) {
    console.warn(`[ext-registrar] Failed to apply lang config for "${languageId}":`, err);
    return null;
  }
}

/* ── Public: Grammars ────────────────────────────────────── */

/* ── Languages that Monaco already tokenizes well ────────── */

const MONACO_BUILTIN_LANGUAGES = new Set([
  "javascript", "typescript", "css", "html", "json", "xml",
  "markdown", "yaml", "sql", "python", "java", "cpp", "c",
  "csharp", "go", "rust", "ruby", "php", "swift", "kotlin",
  "lua", "perl", "r", "shell", "powershell", "bat", "coffeescript",
  "fsharp", "handlebars", "ini", "less", "scss", "dockerfile",
  "graphql", "objective-c", "razor", "redis", "scheme",
  "vb", "clojure", "elixir", "dart",
  "javascriptreact", "typescriptreact", "jsx-tags",
]);

/**
 * Register TextMate grammar data.
 *
 * For languages with a built-in Monaco tokenizer, we only ensure the
 * language ID is registered. For other languages, we attempt to derive
 * a basic Monarch tokenizer from the TM grammar's `repository` patterns
 * so the editor at least highlights keywords, strings, and comments.
 */
export function registerGrammar(
  monaco: Monaco,
  languageId: string,
  scopeName: string,
  grammarJson: unknown,
): boolean {
  if (registeredGrammars.has(scopeName)) return true;

  try {
    // Ensure language is registered
    const existing = monaco.languages.getLanguages().find((l) => l.id === languageId);
    if (!existing) {
      monaco.languages.register({ id: languageId });
    }

    // If Monaco already has a good tokenizer, skip Monarch generation
    if (!MONACO_BUILTIN_LANGUAGES.has(languageId) && grammarJson && typeof grammarJson === "object") {
      const monarch = tmGrammarToMonarch(grammarJson as Record<string, unknown>);
      if (monarch) {
        try {
          monaco.languages.setMonarchTokensProvider(languageId, monarch);
          console.log(`[ext-registrar] Monarch tokenizer set for "${languageId}" from TM grammar`);
        } catch (e) {
          console.warn(`[ext-registrar] Monarch set failed for "${languageId}":`, e);
        }
      }
    }

    registeredGrammars.add(scopeName);
    return true;
  } catch (err) {
    console.warn(`[ext-registrar] Grammar registration failed for "${scopeName}":`, err);
    return false;
  }
}

/* ── TM → Monarch conversion (best-effort) ──────────────── */

/**
 * Extract basic token patterns from a TextMate grammar JSON and produce
 * a simplified Monarch tokenizer. This is NOT a full TM engine — it
 * covers keywords, strings, numbers, and comments which is enough for
 * basic syntax highlighting.
 */
function tmGrammarToMonarch(
  grammar: Record<string, unknown>,
): monacoNs.languages.IMonarchLanguage | null {
  try {
    const keywords: string[] = [];
    const operators: string[] = [];
    let lineComment: string | undefined;
    let blockCommentStart: string | undefined;
    let blockCommentEnd: string | undefined;

    // Walk the repository looking for keyword/comment patterns
    const repo = grammar.repository as Record<string, unknown> | undefined;
    const patterns = grammar.patterns as Array<Record<string, unknown>> | undefined;

    const allPatterns = [...(patterns ?? [])];
    if (repo) {
      for (const val of Object.values(repo)) {
        if (val && typeof val === "object") {
          const r = val as Record<string, unknown>;
          if (Array.isArray(r.patterns)) allPatterns.push(...r.patterns);
          if (r.match || r.begin) allPatterns.push(r);
        }
      }
    }

    for (const pat of allPatterns) {
      const name = String(pat.name ?? pat.contentName ?? "");
      const match = String(pat.match ?? "");

      // Extract keywords from patterns like \b(if|else|for|while)\b
      if (name.includes("keyword") || name.includes("storage")) {
        const kwMatch = match.match(/\\b\(([^)]+)\)\\b/);
        if (kwMatch) {
          keywords.push(...kwMatch[1].split("|").map((k) => k.trim()).filter(Boolean));
        }
      }

      // Extract comment delimiters
      if (name.includes("comment.line")) {
        const cm = match.match(/^\(?\\?(.{1,3})/);
        if (cm) {
          const c = cm[1].replace(/\\/g, "");
          if (c === "//" || c === "#" || c === "--" || c === ";") lineComment = c;
        }
      }
      if (name.includes("comment.block") && pat.begin && pat.end) {
        blockCommentStart = String(pat.begin).replace(/\\/g, "");
        blockCommentEnd = String(pat.end).replace(/\\/g, "");
      }

      // Extract operators from patterns
      if (name.includes("operator")) {
        const opMatch = match.match(/\[([^\]]+)\]/);
        if (opMatch) operators.push(...opMatch[1].split("").filter((c) => !"\\^$".includes(c)));
      }
    }

    // If we couldn't extract anything useful, bail
    if (keywords.length === 0 && !lineComment && !blockCommentStart) return null;

    const rootRules: monacoNs.languages.IMonarchLanguageRule[] = [];

    // Comments
    if (lineComment) {
      rootRules.push([lineComment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ".*$", "comment"]);
    }
    if (blockCommentStart && blockCommentEnd) {
      rootRules.push([
        blockCommentStart.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        "comment",
        "@comment",
      ]);
    }

    // Strings
    rootRules.push(['"', "string", "@string_double"]);
    rootRules.push(["'", "string", "@string_single"]);
    rootRules.push(["`", "string", "@string_backtick"]);

    // Numbers
    rootRules.push(["\\d+\\.?\\d*([eE][+-]?\\d+)?", "number"]);
    rootRules.push(["0[xX][0-9a-fA-F]+", "number.hex"]);

    // Keywords / Identifiers
    if (keywords.length > 0) {
      rootRules.push(["[a-zA-Z_$][\\w$]*", { cases: { "@keywords": "keyword", "@default": "identifier" } }]);
    } else {
      rootRules.push(["[a-zA-Z_$][\\w$]*", "identifier"]);
    }

    // Delimiters
    rootRules.push(["[{}()\\[\\]]", "delimiter.bracket"]);
    rootRules.push(["[;,.]", "delimiter"]);

    const monarch: monacoNs.languages.IMonarchLanguage = {
      keywords: keywords.length > 0 ? keywords : undefined,
      operators: operators.length > 0 ? operators : ["+", "-", "*", "/", "=", "<", ">"],
      tokenizer: {
        root: rootRules,
        ...(blockCommentStart && blockCommentEnd
          ? {
              comment: [
                ["[^*/]+", "comment"],
                [
                  blockCommentEnd.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
                  "comment",
                  "@pop",
                ],
                [".", "comment"],
              ],
            }
          : {}),
        string_double: [
          ["[^\\\\\"]+", "string"],
          ["\\\\.", "string.escape"],
          ['"', "string", "@pop"],
        ],
        string_single: [
          ["[^\\\\']+", "string"],
          ["\\\\.", "string.escape"],
          ["'", "string", "@pop"],
        ],
        string_backtick: [
          ["[^\\\\`]+", "string"],
          ["\\\\.", "string.escape"],
          ["`", "string", "@pop"],
        ],
      },
    };

    return monarch;
  } catch (e) {
    console.warn("[ext-registrar] TM→Monarch conversion failed:", e);
    return null;
  }
}

/* ── Disposal ────────────────────────────────────────────── */

/**
 * Dispose all registered snippet providers for a language.
 */
export function disposeSnippets(languageId: string): void {
  const disposables = snippetDisposables.get(languageId);
  if (disposables) {
    disposables.forEach((d) => d.dispose());
    snippetDisposables.delete(languageId);
  }
}

/**
 * Dispose all registered snippet providers for ALL languages.
 */
export function disposeAllSnippets(): void {
  for (const [, disposables] of snippetDisposables) {
    disposables.forEach((d) => d.dispose());
  }
  snippetDisposables.clear();
}

/**
 * Clear all internal state — used for full cleanup.
 */
export function resetRegistrarState(): void {
  disposeAllSnippets();
  appliedLangConfig.clear();
  registeredGrammars.clear();
}
