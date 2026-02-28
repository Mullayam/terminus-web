/**
 * @module lib/loadPrismLanguage
 *
 * Auto-loads Prism.js language grammars on demand with full dependency
 * resolution.  Instead of statically importing 20+ language files upfront,
 * call `loadPrismLanguage("tsx")` and it will dynamically import `tsx`,
 * plus its dependencies (`jsx`, `typescript`, `javascript`, `markup`)
 * in the correct order.
 *
 * Usage:
 *   import { loadPrismLanguage, detectPrismLanguage } from "@/lib/loadPrismLanguage";
 *
 *   const lang = detectPrismLanguage("app.tsx");   // → "tsx"
 *   await loadPrismLanguage(lang);                 // loads tsx + deps
 *   const html = Prism.highlight(code, Prism.languages.tsx, "tsx");
 */
import Prism from "prismjs";

// ── Dependency map from prismjs/components.json ──────────────
// We inline the require/alias info so we don't need to import the
// 80 KB components.json at runtime.  This covers all commonly used
// languages.  For any language not listed here the loader will still
// attempt a dynamic import — it just won't resolve deps automatically.

interface LangMeta {
  /** Other Prism language IDs that must be loaded first */
  require?: string | string[];
  /** Alias names that resolve to this language */
  alias?: string | string[];
}

const LANG_META: Record<string, LangMeta> = {
  // ── No deps ───────────────────────────
  markup:     { alias: ["html", "xml", "svg", "mathml", "ssml", "atom", "rss"] },
  css:        {},
  clike:      {},
  javascript: { require: "clike", alias: "js" },
  c:          { require: "clike" },
  // ── Single dep ────────────────────────
  cpp:        { require: "c", alias: "c++" },
  csharp:     { require: "clike", alias: ["cs", "dotnet"] },
  java:       { require: "clike" },
  kotlin:     { require: "clike", alias: ["kt", "kts"] },
  swift:      { require: "clike" },
  go:         { require: "clike", alias: "golang" },
  rust:       { require: "clike", alias: "rs" },
  dart:       { require: "clike" },
  scala:      { require: "java" },
  groovy:     { require: "clike" },
  typescript: { require: "javascript", alias: "ts" },
  python:     { require: "clike", alias: "py" },
  ruby:       { require: "clike", alias: "rb" },
  php:        { require: ["markup", "clike"] },
  perl:       {},
  lua:        {},
  r:          {},
  bash:       { alias: ["sh", "shell", "zsh"] },
  powershell: {},
  json:       { alias: "jsonc" },
  yaml:       { alias: "yml" },
  toml:       {},
  ini:        {},
  markdown:   { require: "markup", alias: "md" },
  scss:       { require: "css" },
  less:       { require: "css" },
  sass:       { require: "css" },
  sql:        {},
  graphql:    { alias: "gql" },
  docker:     { alias: "dockerfile" },
  nginx:      { require: "clike" },
  // ── Multi-dep ─────────────────────────
  jsx:        { require: ["markup", "javascript"] },
  tsx:        { require: ["jsx", "typescript"] },
  // ── Others ────────────────────────────
  regex:      {},
  diff:       {},
  git:        {},
  ignore:     { alias: "gitignore" },
  log:        {},
  makefile:   {},
  vim:        {},
  latex:      { require: "markup", alias: "tex" },
  hcl:        {},
  elixir:     {},
  erlang:     {},
  clojure:    {},
  haskell:    { alias: "hs" },
  fsharp:     { require: "clike", alias: "fs" },
  ocaml:      {},
  zig:        {},
  wasm:       {},
  protobuf:   { require: "clike" },
  http:       { require: ["markup", "javascript"] },
};

// Build alias → canonical ID lookup
const ALIAS_MAP = new Map<string, string>();
for (const [id, meta] of Object.entries(LANG_META)) {
  ALIAS_MAP.set(id, id);
  if (meta.alias) {
    const aliases = Array.isArray(meta.alias) ? meta.alias : [meta.alias];
    for (const a of aliases) {
      ALIAS_MAP.set(a.toLowerCase(), id);
    }
  }
}

/** Resolve an alias to the canonical Prism language ID */
export function resolveAlias(lang: string): string {
  return ALIAS_MAP.get(lang.toLowerCase()) ?? lang.toLowerCase();
}

// Track which languages have been loaded (or are currently loading)
const loaded = new Set<string>(["plaintext"]);
const loading = new Map<string, Promise<void>>();

/**
 * Dynamically load a Prism language grammar and all its dependencies.
 *
 * - Resolves aliases (`ts` → `typescript`, `sh` → `bash`, etc.)
 * - Loads dependencies first (`tsx` → jsx, typescript → javascript, markup)
 * - Deduplicates — same language is never loaded twice
 * - Concurrent-safe — parallel calls for the same language share one Promise
 */
export async function loadPrismLanguage(language: string): Promise<void> {
  const id = resolveAlias(language);

  // Already registered in Prism
  if (loaded.has(id) || Prism.languages[id]) {
    loaded.add(id);
    return;
  }

  // Currently loading — wait for the in-flight promise
  if (loading.has(id)) {
    return loading.get(id);
  }

  const promise = (async () => {
    // 1. Load dependencies first
    const meta = LANG_META[id];
    if (meta?.require) {
      const deps = Array.isArray(meta.require) ? meta.require : [meta.require];
      for (const dep of deps) {
        await loadPrismLanguage(dep);
      }
    }

    // 2. Load the language itself
    if (!Prism.languages[id]) {
      try {
        await import(
          /* webpackChunkName: "prism-[request]" */
          `prismjs/components/prism-${id}.js`
        );
      } catch {
        console.warn(`Prism: language "${id}" not found, falling back to plaintext`);
      }
    }

    loaded.add(id);
    loading.delete(id);
  })();

  loading.set(id, promise);
  return promise;
}

// ── File extension → Prism language mapping ──────────────────

const EXT_TO_PRISM: Record<string, string> = {
  js: "javascript", mjs: "javascript", cjs: "javascript",
  jsx: "jsx",
  ts: "typescript", mts: "typescript", cts: "typescript",
  tsx: "tsx",
  py: "python", pyw: "python", pyi: "python",
  rb: "ruby", rake: "ruby", gemspec: "ruby",
  go: "go",
  rs: "rust",
  java: "java",
  kt: "kotlin", kts: "kotlin",
  c: "c", h: "c",
  cpp: "cpp", cc: "cpp", cxx: "cpp", hpp: "cpp", hxx: "cpp",
  cs: "csharp",
  swift: "swift",
  dart: "dart",
  scala: "scala",
  groovy: "groovy",
  php: "php",
  pl: "perl", pm: "perl",
  lua: "lua",
  r: "r",
  html: "markup", htm: "markup", xml: "markup", svg: "markup",
  css: "css",
  scss: "scss", sass: "sass", less: "less",
  json: "json", jsonc: "json",
  yaml: "yaml", yml: "yaml",
  toml: "toml",
  ini: "ini", conf: "ini", cfg: "ini", env: "ini",
  md: "markdown", mdx: "markdown",
  sh: "bash", bash: "bash", zsh: "bash",
  ps1: "powershell", psm1: "powershell",
  sql: "sql",
  graphql: "graphql", gql: "graphql",
  dockerfile: "docker",
  makefile: "makefile",
  diff: "diff", patch: "diff",
  regex: "regex",
  nginx: "nginx",
  vim: "vim",
  tex: "latex", latex: "latex",
  tf: "hcl", hcl: "hcl",
  ex: "elixir", exs: "elixir",
  erl: "erlang", hrl: "erlang",
  clj: "clojure", cljs: "clojure",
  hs: "haskell",
  fs: "fsharp", fsi: "fsharp", fsx: "fsharp",
  ml: "ocaml", mli: "ocaml",
  zig: "zig",
  wasm: "wasm", wat: "wasm",
  proto: "protobuf",
  log: "log",
  gitignore: "ignore",
};

/**
 * Detect the Prism language ID from a file name / path.
 * Returns `null` if no mapping is found (use plaintext).
 *
 *   detectPrismLanguage("app.tsx")     → "tsx"
 *   detectPrismLanguage("Dockerfile")  → "docker"
 *   detectPrismLanguage("unknown.xyz") → null
 */
export function detectPrismLanguage(fileName: string): string | null {
  const name = fileName.split("/").pop() ?? fileName;
  const lower = name.toLowerCase();

  // Special filenames
  if (lower === "dockerfile") return "docker";
  if (lower === "makefile" || lower === "gnumakefile") return "makefile";
  if (lower.startsWith(".env")) return "ini";
  if (lower === ".gitignore" || lower === ".dockerignore") return "ignore";
  if (lower === "nginx.conf") return "nginx";

  const ext = name.includes(".") ? name.split(".").pop()?.toLowerCase() ?? "" : "";
  return EXT_TO_PRISM[ext] ?? null;
}

/**
 * Convenience: detect language from filename, load it, and return
 * the Prism grammar + language ID.  Ready to pass to `Prism.highlight()`.
 *
 *   const { grammar, langId } = await loadLanguageForFile("app.tsx");
 *   if (grammar) {
 *     const html = Prism.highlight(code, grammar, langId);
 *   }
 */
export async function loadLanguageForFile(
  fileName: string,
): Promise<{ grammar: Prism.Grammar | null; langId: string }> {
  const langId = detectPrismLanguage(fileName) ?? "plaintext";
  await loadPrismLanguage(langId);
  return {
    grammar: Prism.languages[langId] ?? null,
    langId,
  };
}
