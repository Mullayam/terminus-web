/**
 * @module lib/monaco/loadSnippets
 *
 * Loads VS Code-compatible snippet JSON files from /public/snippets/
 * and registers them as Monaco completion providers.
 *
 * Snippet files should be placed as:
 *   public/snippets/javascript.json
 *   public/snippets/typescript.json
 *   public/snippets/python.json
 *   etc.
 *
 * The JSON format follows VS Code snippets:
 * {
 *   "Console Log": {
 *     "prefix": ["log", "cl"],
 *     "body": ["console.log('$1');", "$0"],
 *     "description": "Log output to console"
 *   }
 * }
 */

import type * as monacoNs from "monaco-editor";

type Monaco = typeof monacoNs;

/* ── Types ─────────────────────────────────────────────────── */
interface VSCodeSnippet {
  prefix: string | string[];
  body: string | string[];
  description?: string;
}

type SnippetFile = Record<string, VSCodeSnippet>;

/* ── State ─────────────────────────────────────────────────── */
const loadedLanguages = new Set<string>();
const disposables = new Map<string, monacoNs.IDisposable>();

/**
 * Convert VS Code snippet body to Monaco insertText with snippet syntax.
 */
function convertBody(body: string | string[]): string {
  return Array.isArray(body) ? body.join("\n") : body;
}

/**
 * Fetch and parse a snippet file for a given language.
 */
async function fetchSnippets(langId: string): Promise<SnippetFile | null> {
  try {
    const res = await fetch(`/snippets/${langId}.json`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Load snippets for a language from /public/snippets/<langId>.json
 * and register a CompletionItemProvider in Monaco.
 *
 * @param monaco   The Monaco namespace
 * @param langId   Language ID, e.g. "typescript"
 * @returns An IDisposable to deregister the provider, or null if no snippets found
 *
 * ```ts
 * import { loadSnippets } from "@/modules/monaco-editor";
 *
 * const disposable = await loadSnippets(monaco, "typescript");
 * // later: disposable?.dispose();
 * ```
 */
export async function loadSnippets(
  monaco: Monaco,
  langId: string,
): Promise<monacoNs.IDisposable | null> {
  // Don't double-register
  if (loadedLanguages.has(langId)) return disposables.get(langId) ?? null;

  const snippets = await fetchSnippets(langId);
  if (!snippets || Object.keys(snippets).length === 0) return null;

  const entries = Object.entries(snippets);

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
        ([name, snippet]) => {
          const prefixes = Array.isArray(snippet.prefix)
            ? snippet.prefix
            : [snippet.prefix];

          return {
            label: prefixes[0],
            kind: monaco.languages.CompletionItemKind.Snippet,
            documentation: snippet.description
              ? { value: `**${name}**\n\n${snippet.description}` }
              : undefined,
            insertText: convertBody(snippet.body),
            insertTextRules:
              monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            detail: name,
            range,
            // Additional prefixes for filtering
            filterText: prefixes.join(" "),
            sortText: `zzz_${prefixes[0]}`, // sort after normal completions
          };
        },
      );

      return { suggestions };
    },
  });

  loadedLanguages.add(langId);
  disposables.set(langId, disposable);
  return disposable;
}

/**
 * Unload snippets for a specific language.
 */
export function unloadSnippets(langId: string): void {
  const d = disposables.get(langId);
  if (d) {
    d.dispose();
    disposables.delete(langId);
    loadedLanguages.delete(langId);
  }
}

/**
 * Pre-load snippets for multiple languages.
 */
export async function preloadSnippets(
  monaco: Monaco,
  langIds: string[],
): Promise<void> {
  await Promise.allSettled(langIds.map((id) => loadSnippets(monaco, id)));
}
