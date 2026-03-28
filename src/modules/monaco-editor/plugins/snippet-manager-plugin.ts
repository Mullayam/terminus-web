/**
 * @module monaco-editor/plugins/snippet-manager-plugin
 *
 * Snippet manager that loads snippets from /public/snippets/ JSON files
 * and registers them as Monaco completion providers.
 * Also supports user-defined snippets stored in localStorage.
 */

import type { MonacoPlugin, PluginContext, Monaco } from "../types";

interface SnippetDef {
  prefix: string | string[];
  body: string | string[];
  description?: string;
}

type SnippetFile = Record<string, SnippetDef>;

const STORAGE_KEY = "terminus-user-snippets";

/* Built-in snippet files that exist in /public/snippets/ */
const SNIPPET_FILES: Record<string, string[]> = {
  javascript: ["/snippets/javascript.json"],
  typescript: ["/snippets/typescript.json"],
  typescriptreact: ["/snippets/typescript.json"],
  javascriptreact: ["/snippets/javascript.json"],
  python: ["/snippets/python.json"],
  go: ["/snippets/go.json"],
};

/* Cache loaded snippets */
const snippetCache: Record<string, SnippetFile> = {};

async function loadSnippetFile(url: string): Promise<SnippetFile> {
  if (snippetCache[url]) return snippetCache[url];
  try {
    const res = await fetch(url);
    if (!res.ok) return {};
    const data = await res.json();
    snippetCache[url] = data;
    return data;
  } catch {
    return {};
  }
}

function getUserSnippets(language: string): SnippetFile {
  try {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return all[language] || {};
  } catch {
    return {};
  }
}

function bodyToInsertText(body: string | string[]): string {
  return Array.isArray(body) ? body.join("\n") : body;
}

export const snippetManagerPlugin: MonacoPlugin = {
  id: "builtin-snippet-manager",
  name: "Snippet Manager",
  version: "1.0.0",
  description: "Language-aware snippets from /public/snippets/ and user storage",

  onMount(ctx: PluginContext) {
    /* Register a universal completion provider that fires for all languages */
    const ALL_LANGUAGES = ["*"];

    ctx.registerCompletionProvider(ALL_LANGUAGES, {
      triggerCharacters: undefined,

      async provideCompletionItems(model, position) {
        const lang = model.getLanguageId();
        const snippets: SnippetFile = {};

        // Load built-in snippets for this language
        const files = SNIPPET_FILES[lang];
        if (files) {
          for (const file of files) {
            const loaded = await loadSnippetFile(file);
            Object.assign(snippets, loaded);
          }
        }

        // Merge user snippets
        const userSnippets = getUserSnippets(lang);
        Object.assign(snippets, userSnippets);

        if (Object.keys(snippets).length === 0) {
          return { suggestions: [] };
        }

        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endLineNumber: position.lineNumber,
          endColumn: position.column,
        };

        const suggestions: import("monaco-editor").languages.CompletionItem[] = [];

        for (const [name, def] of Object.entries(snippets)) {
          const prefixes = Array.isArray(def.prefix) ? def.prefix : [def.prefix];

          for (const prefix of prefixes) {
            suggestions.push({
              label: { label: prefix, description: name },
              kind: 27, // Snippet
              insertText: bodyToInsertText(def.body),
              insertTextRules: 4, // InsertAsSnippet
              range,
              detail: def.description ?? `Snippet: ${name}`,
              documentation: {
                value: "```\n" + bodyToInsertText(def.body).replace(/\$\d+/g, "").replace(/\$\{[^}]+\}/g, "") + "\n```",
              },
              sortText: `zzz_snippet_${prefix}`,
            });
          }
        }

        return { suggestions };
      },
    });

    /* Register commands for snippet management */
    ctx.addAction({
      id: "snippet-manager.insert",
      label: "Insert Snippet",
      keybindings: [
        ctx.monaco.KeyMod.CtrlCmd | ctx.monaco.KeyMod.Shift | ctx.monaco.KeyCode.KeyP,
      ],
      run() {
        // Trigger the quick pick with snippet suggestions
        ctx.editor.trigger("snippet-manager", "editor.action.triggerSuggest", {});
      },
    });

    void ctx;
  },

  onBeforeMount(_monaco: Monaco) {
    // Pre-warm common snippet files
    for (const files of Object.values(SNIPPET_FILES)) {
      for (const file of files) {
        loadSnippetFile(file).catch(() => {});
      }
    }
  },
};
