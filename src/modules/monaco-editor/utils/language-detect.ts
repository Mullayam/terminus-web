/**
 * @module monaco-editor/utils/language-detect
 *
 * Detect Monaco language ID from file path using Monaco's built-in
 * language registry (`monaco.languages.getLanguages()`).
 *
 * Call `initMonacoLanguages(monaco)` once after Monaco loads
 * (e.g. in the `beforeMount` callback) to populate the cache.
 * Before initialization, the function still works using a small
 * bootstrap fallback for the most common extensions.
 */

import type * as monacoNs from "monaco-editor";

type Monaco = typeof monacoNs;

/* ── Cached language registry from Monaco ──────────────────── */

interface LangEntry {
  id: string;
  extensions?: string[];
  filenames?: string[];
  aliases?: string[];
}

let cachedLanguages: LangEntry[] | null = null;

/**
 * Populate the language detection cache from Monaco's built-in registry.
 * Call once in `beforeMount` or after `loader.init()`.
 */
export function initMonacoLanguages(monaco: Monaco): void {
  cachedLanguages = monaco.languages.getLanguages();
}

/**
 * Refresh the cached language list.
 * Useful after extensions register new languages at runtime.
 */
export function refreshLanguageCache(monaco: Monaco): void {
  cachedLanguages = monaco.languages.getLanguages();
}

/* ── Detection ─────────────────────────────────────────────── */

/**
 * Detect the Monaco language ID from a file path or filename.
 *
 * Uses Monaco's built-in language registry (populated via `initMonacoLanguages`).
 * Falls back to "plaintext" if the language is unknown.
 *
 * ```ts
 * detectLanguage("src/app.tsx");    // "typescript"
 * detectLanguage("Dockerfile");     // "dockerfile"
 * detectLanguage("styles.scss");    // "scss"
 * ```
 */
export function detectLanguage(filePath: string): string {
  if (!filePath) return "plaintext";

  const fileName = filePath.split(/[/\\]/).pop() ?? "";
  const lowerName = fileName.toLowerCase();
  const ext = fileName.includes(".")
    ? "." + (fileName.split(".").pop()?.toLowerCase() ?? "")
    : "";

  const langs = cachedLanguages ?? BOOTSTRAP_LANGUAGES;

  // 1. Exact filename match
  for (const lang of langs) {
    if (
      lang.filenames?.some(
        (f) => f.toLowerCase() === lowerName,
      )
    ) {
      return lang.id;
    }
  }

  // 2. Extension match
  if (ext) {
    for (const lang of langs) {
      if (
        lang.extensions?.some(
          (e) => e.toLowerCase() === ext,
        )
      ) {
        return lang.id;
      }
    }
  }

  return "plaintext";
}

/* ── Bootstrap fallback (used before Monaco loads) ─────────── */

/**
 * Minimal set of languages for pre-mount detection (status bar, etc.).
 * Once `initMonacoLanguages()` runs, the full Monaco registry takes over.
 */
const BOOTSTRAP_LANGUAGES: LangEntry[] = [
  { id: "typescript",  extensions: [".ts", ".tsx", ".mts", ".cts"] },
  { id: "javascript",  extensions: [".js", ".jsx", ".mjs", ".cjs"] },
  { id: "html",        extensions: [".html", ".htm"] },
  { id: "css",         extensions: [".css"] },
  { id: "scss",        extensions: [".scss"] },
  { id: "less",        extensions: [".less"] },
  { id: "json",        extensions: [".json", ".jsonc"] },
  { id: "yaml",        extensions: [".yaml", ".yml"] },
  { id: "xml",         extensions: [".xml", ".svg", ".xsl"] },
  { id: "markdown",    extensions: [".md", ".mdx"] },
  { id: "python",      extensions: [".py", ".pyw"] },
  { id: "ruby",        extensions: [".rb"] },
  { id: "go",          extensions: [".go"] },
  { id: "rust",        extensions: [".rs"] },
  { id: "java",        extensions: [".java"] },
  { id: "kotlin",      extensions: [".kt", ".kts"] },
  { id: "csharp",      extensions: [".cs"] },
  { id: "cpp",         extensions: [".cpp", ".cxx", ".cc", ".hpp", ".hh"] },
  { id: "c",           extensions: [".c", ".h"] },
  { id: "swift",       extensions: [".swift"] },
  { id: "php",         extensions: [".php"] },
  { id: "shell",       extensions: [".sh", ".bash", ".zsh"] },
  { id: "powershell",  extensions: [".ps1", ".psm1"] },
  { id: "bat",         extensions: [".bat", ".cmd"] },
  { id: "sql",         extensions: [".sql"] },
  { id: "dockerfile",  filenames: ["Dockerfile"], extensions: [".dockerfile"] },
  { id: "ini",         extensions: [".ini", ".cfg", ".conf", ".env", ".properties"] },
  { id: "plaintext",   extensions: [".txt", ".log", ".csv"] },
];
