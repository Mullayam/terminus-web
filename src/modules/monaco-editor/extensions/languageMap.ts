/**
 * @module monaco-editor/extensions/languageMap
 *
 * Maps file extensions → Monaco language IDs → VSCode extension folder names.
 *
 * When a user opens `foo.py`, we look up:
 *   ".py" → languageId "python" → extensionFolder "python"
 *
 * The extension folder name corresponds to the directory name in the
 * microsoft/vscode `extensions/` tree on GitHub.
 */

import { isDotenvFile } from "../languages/dotenv";

/* ── Extension → Language ID ─────────────────────────────── */

/**
 * Map from file extension (with leading dot) to Monaco language ID.
 * This covers the most common languages. When a file extension is not found,
 * Monaco's built-in `getLanguages()` detection is used as fallback.
 */
const EXT_TO_LANG: Record<string, string> = {
  // JavaScript / TypeScript
  ".js": "javascript",
  ".jsx": "javascriptreact",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".ts": "typescript",
  ".tsx": "typescriptreact",
  ".mts": "typescript",
  ".cts": "typescript",

  // Web
  ".html": "html",
  ".htm": "html",
  ".css": "css",
  ".scss": "scss",
  ".less": "less",
  ".vue": "vue",
  ".svelte": "svelte",

  // Data / Config
  ".json": "json",
  ".jsonc": "jsonc",
  ".json5": "json5",
  ".yaml": "yaml",
  ".yml": "yaml",
  ".toml": "toml",
  ".xml": "xml",
  ".svg": "xml",
  ".ini": "ini",
  ".env": "dotenv",
  ".properties": "ini",

  // Systems
  ".py": "python",
  ".pyw": "python",
  ".rb": "ruby",
  ".go": "go",
  ".rs": "rust",
  ".c": "c",
  ".h": "c",
  ".cpp": "cpp",
  ".cc": "cpp",
  ".cxx": "cpp",
  ".hpp": "cpp",
  ".cs": "csharp",
  ".java": "java",
  ".kt": "kotlin",
  ".kts": "kotlin",
  ".swift": "swift",
  ".m": "objective-c",
  ".mm": "objective-cpp",
  ".dart": "dart",
  ".scala": "scala",

  // Scripting
  ".php": "php",
  ".lua": "lua",
  ".pl": "perl",
  ".pm": "perl",
  ".r": "r",
  ".R": "r",
  ".jl": "julia",
  ".ex": "elixir",
  ".exs": "elixir",
  ".erl": "erlang",
  ".clj": "clojure",
  ".cljs": "clojure",
  ".fs": "fsharp",
  ".fsi": "fsharp",
  ".hs": "haskell",
  ".lhs": "haskell",

  // Shell
  ".sh": "shellscript",
  ".bash": "shellscript",
  ".zsh": "shellscript",
  ".fish": "shellscript",
  ".ps1": "powershell",
  ".psm1": "powershell",
  ".bat": "bat",
  ".cmd": "bat",

  // Markup / Docs
  ".md": "markdown",
  ".mdx": "markdown",
  ".tex": "latex",
  ".rst": "restructuredtext",
  ".adoc": "asciidoc",

  // Database
  ".sql": "sql",
  ".graphql": "graphql",
  ".gql": "graphql",

  // DevOps
  ".dockerfile": "dockerfile",
  ".tf": "hcl",
  ".tfvars": "hcl",
  ".makefile": "makefile",

  // Other
  ".groovy": "groovy",
  ".gradle": "groovy",
  ".coffee": "coffeescript",
  ".diff": "diff",
  ".patch": "diff",
  ".log": "log",
};

/* ── Language ID → Extension Folder ──────────────────────── */

/**
 * Map from Monaco languageId to the vscode extension folder.
 * Many language IDs map 1:1 — e.g. "python" → "python".
 * Some are different — e.g. "shellscript" → "shellscript".
 */
const LANG_TO_FOLDER: Record<string, string> = {
  javascript: "javascript",
  javascriptreact: "javascript",
  typescript: "typescript-basics",
  typescriptreact: "typescript-basics",
  html: "html",
  css: "css",
  scss: "scss",
  less: "less",
  json: "json",
  jsonc: "json",
  yaml: "yaml",
  xml: "xml",
  markdown: "markdown-basics",
  python: "python",
  ruby: "ruby",
  go: "go",
  rust: "rust",
  c: "cpp",
  cpp: "cpp",
  csharp: "csharp",
  java: "java",
  kotlin: "kotlin",           // Community ext — may not be in vscode tree
  swift: "swift",
  "objective-c": "objective-c",
  dart: "dart",
  scala: "scala",
  php: "php",
  lua: "lua",
  perl: "perl",
  r: "r",
  julia: "julia",
  elixir: "elixir",           // Not in vscode tree by default
  clojure: "clojure",
  fsharp: "fsharp",
  haskell: "haskell",          // Not in vscode tree by default
  shellscript: "shellscript",
  powershell: "powershell",
  bat: "bat",
  sql: "sql",
  graphql: "graphql",          // Not in vscode tree by default
  dockerfile: "docker",
  makefile: "make",
  groovy: "groovy",
  coffeescript: "coffeescript",
  diff: "diff",
  latex: "latex",
  ini: "ini",
  dotenv: "ini",
  toml: "toml",                // Not in vscode tree by default
  log: "log",
  hlsl: "hlsl",
  razor: "razor",
  vue: "vue",                  // Not in vscode tree by default
  svelte: "svelte",            // Not in vscode tree by default
};

/* ── Public API ────────────────────────────────────────────── */

/**
 * Get the Monaco language ID from a file extension (e.g. `.py` → `python`).
 * Returns null if extension is unknown.
 */
export function getLanguageFromExtension(ext: string): string | null {
  return EXT_TO_LANG[ext.toLowerCase()] ?? null;
}

/**
 * Get the VSCode extension folder name for a given Monaco language ID.
 * Returns null if no matching folder is known.
 */
export function getExtensionFolder(languageId: string): string | null {
  return LANG_TO_FOLDER[languageId] ?? null;
}

/**
 * Given a file path, resolve the file extension, language ID, and extension folder.
 */
export function resolveFileLanguage(filePath: string): {
  ext: string;
  languageId: string | null;
  extensionFolder: string | null;
} {
  const fileName = filePath.split(/[/\\]/).pop() ?? filePath;

  // Dotenv pattern detection takes priority
  if (isDotenvFile(fileName)) {
    return { ext: ".env", languageId: "dotenv", extensionFolder: getExtensionFolder("dotenv") };
  }

  const lastDot = filePath.lastIndexOf(".");
  const ext = lastDot >= 0 ? filePath.slice(lastDot).toLowerCase() : "";
  const languageId = getLanguageFromExtension(ext);
  const extensionFolder = languageId ? getExtensionFolder(languageId) : null;
  return { ext, languageId, extensionFolder };
}

/**
 * Get all known file extensions (for use in UI).
 */
export function getAllKnownExtensions(): string[] {
  return Object.keys(EXT_TO_LANG);
}

/**
 * Get all known language IDs.
 */
export function getAllKnownLanguages(): string[] {
  return [...new Set(Object.values(EXT_TO_LANG))];
}
