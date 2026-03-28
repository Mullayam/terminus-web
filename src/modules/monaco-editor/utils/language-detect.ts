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
import { isDotenvFile } from "../languages/dotenv";
import { isDockerfile } from "../languages/filename-patterns";

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

  // Dotenv files → always "dotenv" regardless of extension
  if (isDotenvFile(lowerName)) return "dotenv";

  // Dockerfile variants → always "dockerfile"
  if (isDockerfile(lowerName)) return "dockerfile";

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
  // ── Original entries ──
  { id: "typescript",  extensions: [".ts", ".tsx", ".mts", ".cts"] },
  { id: "javascript",  extensions: [".js", ".jsx", ".mjs", ".cjs"] },
  { id: "html",        extensions: [".html", ".htm"] },
  { id: "css",         extensions: [".css"] },
  { id: "scss",        extensions: [".scss"] },
  { id: "less",        extensions: [".less"] },
  { id: "json",        extensions: [".json", ".jsonc", ".json5"] },
  { id: "yaml",        extensions: [".yaml", ".yml"] },
  { id: "xml",         extensions: [".xml", ".svg", ".xsl", ".xslt", ".xsd"] },
  { id: "markdown",    extensions: [".md", ".markdown"] },
  { id: "python",      extensions: [".py", ".pyw", ".pyi"] },
  { id: "ruby",        extensions: [".rb", ".erb", ".rake", ".gemspec"] },
  { id: "go",          extensions: [".go"] },
  { id: "rust",        extensions: [".rs"] },
  { id: "java",        extensions: [".java"] },
  { id: "kotlin",      extensions: [".kt", ".kts"] },
  { id: "csharp",      extensions: [".cs"] },
  { id: "cpp",         extensions: [".cpp", ".cxx", ".cc", ".hpp", ".hh"] },
  { id: "c",           extensions: [".c", ".h"] },
  { id: "swift",       extensions: [".swift"] },
  { id: "php",         extensions: [".php"] },
  { id: "shell",       extensions: [".sh", ".bash", ".zsh", ".fish"] },
  { id: "powershell",  extensions: [".ps1", ".psm1", ".psd1"] },
  { id: "bat",         extensions: [".bat", ".cmd"] },
  { id: "sql",         extensions: [".sql"] },
  { id: "dockerfile",  filenames: ["Dockerfile"], extensions: [".dockerfile"] },
  { id: "dotenv",      extensions: [".env"] },
  { id: "ini",         extensions: [".ini", ".cfg", ".conf", ".properties"] },
  { id: "plaintext",   extensions: [".txt", ".log", ".csv"] },
  // ── From @enjoys/context-engine manifest ──
  { id: "abap",              extensions: [".abap"] },
  { id: "apex",              extensions: [".cls", ".trigger"] },
  { id: "awk",               extensions: [".awk"] },
  { id: "bicep",             extensions: [".bicep"] },
  { id: "clojure",           extensions: [".clj", ".cljs", ".cljc", ".edn"] },
  { id: "coffee",            extensions: [".coffee", ".litcoffee"] },
  { id: "cypher",            extensions: [".cypher"] },
  { id: "dart",              extensions: [".dart"] },
  { id: "ecl",               extensions: [".ecl"] },
  { id: "elixir",            extensions: [".ex", ".exs", ".heex"] },
  { id: "freemarker2",       extensions: [".ftl"] },
  { id: "graphql",           extensions: [".graphql", ".gql"] },
  { id: "hcl",               extensions: [".hcl", ".tf", ".tfvars"] },
  { id: "julia",             extensions: [".jl"] },
  { id: "lexon",             extensions: [".lex"] },
  { id: "liquid",            extensions: [".liquid"] },
  { id: "lua",               extensions: [".lua"] },
  { id: "m3",                extensions: [".m3", ".mg", ".ig"] },
  { id: "makefile",          filenames: ["Makefile", "GNUmakefile", "makefile"] },
  { id: "mdx",               extensions: [".mdx"] },
  { id: "mips",              extensions: [".mips", ".asm", ".s"] },
  { id: "mysql",             extensions: [".mysql"] },
  { id: "objective-c",       extensions: [".m", ".mm"] },
  { id: "pascal",            extensions: [".pas", ".pp", ".lpr"] },
  { id: "pascaligo",         extensions: [".ligo"] },
  { id: "cameligo",          extensions: [".mligo"] },
  { id: "perl",              extensions: [".pl", ".pm", ".perl"] },
  { id: "pgsql",             extensions: [".pgsql"] },
  { id: "pla",               extensions: [".pla"] },
  { id: "postiats",          extensions: [".dats", ".sats", ".hats"] },
  { id: "powerquery",        extensions: [".pq", ".pqm"] },
  { id: "protobuf",          extensions: [".proto"] },
  { id: "qsharp",            extensions: [".qs"] },
  { id: "r",                 extensions: [".r", ".rmd"] },
  { id: "razor",             extensions: [".cshtml", ".razor"] },
  { id: "restructuredtext",  extensions: [".rst"] },
  { id: "scala",             extensions: [".scala", ".sc"] },
  { id: "scheme",            extensions: [".scm", ".ss", ".rkt"] },
  { id: "sol",               extensions: [".sol"] },
  { id: "sparql",            extensions: [".sparql", ".rq"] },
  { id: "st",                extensions: [".st"] },
  { id: "systemverilog",     extensions: [".sv", ".svh", ".v"] },
  { id: "tcl",               extensions: [".tcl"] },
  { id: "toml",              extensions: [".toml"] },
  { id: "twig",              extensions: [".twig"] },
  { id: "vb",                extensions: [".vb", ".vbs", ".bas"] },
  { id: "wgsl",              extensions: [".wgsl"] },
  { id: "sb",                extensions: [".sb"] },
  { id: "docker-compose",    filenames: ["docker-compose.yml", "docker-compose.yaml", "compose.yml", "compose.yaml"] },
  { id: "nginx",             filenames: ["nginx.conf"], extensions: [".nginx"] },
  { id: "ssh_config",        filenames: ["ssh_config", "sshd_config"] },
  { id: "systemd",           extensions: [".service", ".timer", ".socket", ".target", ".mount"] },
  { id: "crontab",           filenames: ["crontab"] },
];
