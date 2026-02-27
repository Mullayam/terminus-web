/**
 * @module lib/monaco/loadTextMateGrammar
 *
 * Loads TextMate grammars from /public/grammars/ and wires them into
 * Monaco using `monaco-textmate`, `vscode-oniguruma`, and
 * `monaco-editor-textmate`.
 *
 * Grammar files should be placed as:
 *   public/grammars/typescript.tmLanguage.json
 *   public/grammars/python.tmLanguage.json
 *   etc.
 *
 * The onig.wasm file must live at:
 *   public/onig.wasm
 */

import type * as monacoNs from "monaco-editor";
import { Registry } from "monaco-textmate";
import { loadWASM } from "vscode-oniguruma";
import { wireTmGrammars } from "monaco-editor-textmate";
import { getTextMateScope } from "./monacoLanguageMap";

type Monaco = typeof monacoNs;

/* ── State ─────────────────────────────────────────────────── */
let wasmLoaded = false;
let wasmLoadPromise: Promise<void> | null = null;
const loadedScopes = new Set<string>();

/**
 * Ensure the Oniguruma WASM binary is loaded exactly once.
 */
async function ensureOniguruma(): Promise<void> {
  if (wasmLoaded) return;
  if (wasmLoadPromise) return wasmLoadPromise;

  wasmLoadPromise = (async () => {
    const response = await fetch("/onig.wasm");
    const buffer = await response.arrayBuffer();
    await loadWASM(buffer);
    wasmLoaded = true;
  })();

  return wasmLoadPromise;
}

/**
 * Fetch a .tmLanguage.json grammar file for a given TextMate scope.
 * Returns the parsed JSON or null on failure.
 */
async function fetchGrammar(
  scopeName: string,
): Promise<{ format: "json"; content: object } | null> {
  // Convert scope to a filename: "source.ts" → "typescript"
  // We strip the "source." or "text." prefix and replace dots
  const fileBase = scopeToFileName(scopeName);
  const url = `/grammars/${fileBase}.tmLanguage.json`;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const content = await res.json();
    return { format: "json", content };
  } catch {
    console.warn(`[loadTextMateGrammar] Failed to load grammar: ${url}`);
    return null;
  }
}

/**
 * Convert a TextMate scope like "source.ts" to a grammar file name like "typescript".
 */
function scopeToFileName(scopeName: string): string {
  const SCOPE_FILE_MAP: Record<string, string> = {
    "source.js": "javascript",
    "source.ts": "typescript",
    "source.tsx": "typescriptreact",
    "source.jsx": "javascriptreact",
    "text.html.basic": "html",
    "source.css": "css",
    "source.css.scss": "scss",
    "source.css.less": "less",
    "source.json": "json",
    "text.xml": "xml",
    "source.yaml": "yaml",
    "text.html.markdown": "markdown",
    "source.python": "python",
    "source.ruby": "ruby",
    "source.go": "go",
    "source.rust": "rust",
    "source.java": "java",
    "source.kotlin": "kotlin",
    "source.swift": "swift",
    "source.c": "c",
    "source.cpp": "cpp",
    "source.cs": "csharp",
    "source.php": "php",
    "source.lua": "lua",
    "source.perl": "perl",
    "source.r": "r",
    "source.shell": "shellscript",
    "source.powershell": "powershell",
    "source.sql": "sql",
    "source.graphql": "graphql",
    "source.dockerfile": "dockerfile",
    "source.toml": "toml",
    "source.ini": "ini",
    "source.dart": "dart",
    "source.scala": "scala",
    "source.elixir": "elixir",
    "source.vue": "vue",
  };

  return SCOPE_FILE_MAP[scopeName] ?? scopeName.replace(/^(source|text)\./, "").replace(/\./g, "-");
}

/**
 * Load a TextMate grammar for a given Monaco language and wire it up.
 *
 * @param monaco   The Monaco namespace
 * @param langId   Monaco language ID, e.g. "typescript"
 * @param editor   Optional editor instance for scoped wiring
 * @returns true if the grammar was loaded successfully
 *
 * ```ts
 * import { loadTextMateGrammar } from "@/modules/monaco-editor";
 *
 * await loadTextMateGrammar(monaco, "typescript", editor);
 * ```
 */
export async function loadTextMateGrammar(
  monaco: Monaco,
  langId: string,
  editor?: monacoNs.editor.ICodeEditor,
): Promise<boolean> {
  const scopeName = getTextMateScope(langId);
  if (!scopeName) {
    console.warn(`[loadTextMateGrammar] No TM scope for language: ${langId}`);
    return false;
  }

  // Don't reload the same scope
  if (loadedScopes.has(scopeName)) return true;

  try {
    // Pre-check: fetch the grammar first to verify it exists.
    // If the grammar file is missing we return false immediately,
    // keeping Monaco's built-in tokenizer intact instead of
    // overriding it with an empty TextMate grammar.
    const prefetchedGrammar = await fetchGrammar(scopeName);
    if (!prefetchedGrammar) {
      console.warn(
        `[loadTextMateGrammar] Grammar file not available for "${langId}" (${scopeName}), using built-in tokenizer`,
      );
      return false;
    }

    await ensureOniguruma();

    // Cache pre-fetched grammar so the Registry callback can serve it
    // without a redundant network request.
    const grammarCache = new Map<string, { format: "json"; content: object }>();
    grammarCache.set(scopeName, prefetchedGrammar);

    const registry = new Registry({
      getGrammarDefinition: async (scope: string) => {
        const cached = grammarCache.get(scope);
        if (cached) return cached as any;

        const grammar = await fetchGrammar(scope);
        if (!grammar) {
          throw new Error(`Grammar not found for scope: ${scope}`);
        }
        return grammar as any;
      },
    });

    const langMap = new Map<string, string>();
    langMap.set(langId, scopeName);

    // Ensure Monaco knows about this language
    const existing = monaco.languages.getLanguages().find((l) => l.id === langId);
    if (!existing) {
      monaco.languages.register({ id: langId });
    }

    await wireTmGrammars(monaco, registry, langMap, editor);
    loadedScopes.add(scopeName);
    return true;
  } catch (err) {
    console.error(`[loadTextMateGrammar] Failed for ${langId}:`, err);
    return false;
  }
}

/**
 * Pre-load grammars for multiple languages at once.
 */
export async function preloadGrammars(
  monaco: Monaco,
  langIds: string[],
  editor?: monacoNs.editor.ICodeEditor,
): Promise<void> {
  await Promise.allSettled(langIds.map((id) => loadTextMateGrammar(monaco, id, editor)));
}
