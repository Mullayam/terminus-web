/**
 * @module lib/monaco/monacoLanguageMap
 *
 * TextMate scope mapping for Monaco language IDs.
 *
 * Language detection has been moved to `utils/language-detect.ts`
 * which uses Monaco's built-in `monaco.languages.getLanguages()`.
 * This file only provides the TextMate scope mapping, which is
 * not available from Monaco's core API.
 */

/**
 * Resolve to a TextMate scope name for a given Monaco language ID.
 * Returns null if there's no known TM scope for that language.
 */
export function getTextMateScope(languageId: string): string | null {
  return TM_SCOPE_MAP[languageId] ?? null;
}

/** Monaco language ID → TextMate scope name */
const TM_SCOPE_MAP: Record<string, string> = {
  javascript: "source.js",
  typescript: "source.ts",
  html: "text.html.basic",
  css: "source.css",
  scss: "source.css.scss",
  less: "source.css.less",
  json: "source.json",
  xml: "text.xml",
  yaml: "source.yaml",
  markdown: "text.html.markdown",
  python: "source.python",
  ruby: "source.ruby",
  go: "source.go",
  rust: "source.rust",
  java: "source.java",
  kotlin: "source.kotlin",
  swift: "source.swift",
  c: "source.c",
  cpp: "source.cpp",
  csharp: "source.cs",
  php: "source.php",
  lua: "source.lua",
  perl: "source.perl",
  r: "source.r",
  shell: "source.shell",
  powershell: "source.powershell",
  sql: "source.sql",
  graphql: "source.graphql",
  dockerfile: "source.dockerfile",
  toml: "source.toml",
  ini: "source.ini",
  bat: "source.batchfile",
  makefile: "source.makefile",
  dart: "source.dart",
  scala: "source.scala",
  elixir: "source.elixir",
  erlang: "source.erlang",
  clojure: "source.clojure",
  fsharp: "source.fsharp",
  haskell: "source.haskell",
  julia: "source.julia",
  latex: "text.tex.latex",
  vue: "source.vue",
};
