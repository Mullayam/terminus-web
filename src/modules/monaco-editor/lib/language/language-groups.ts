/**
 * @module lib/monaco/language-groups
 *
 * Shared language family constants used across Monaco Editor plugins,
 * providers, and services. Centralises all language ID groupings to
 * avoid duplicated, inconsistent lists scattered across the codebase.
 *
 * Import from here instead of defining inline language arrays.
 */

/* ================================================================== */
/*  JavaScript / TypeScript family                                     */
/* ================================================================== */

/** Core JS/TS language IDs (Monaco-standard identifiers) */
export const JS_FAMILY = new Set([
  "javascript",
  "typescript",
  "javascriptreact",
  "typescriptreact",
  "jsx",
  "tsx",
]);

/** TypeScript-only subset */
export const TS_FAMILY = new Set([
  "typescript",
  "typescriptreact",
  "tsx",
]);

/** Helper to check JS family membership */
export function isJSFamily(lang: string): boolean {
  return JS_FAMILY.has(lang);
}

/* ================================================================== */
/*  C-like / curly-brace family                                        */
/* ================================================================== */

export const C_FAMILY = new Set([
  "c",
  "cpp",
  "csharp",
  "objective-c",
  "java",
  "kotlin",
]);

/* ================================================================== */
/*  Tag / markup languages (HTML-like opening + closing tags)          */
/* ================================================================== */

/**
 * Languages that use HTML/XML-style tags requiring auto-close,
 * linked editing (tag rename), and Emmet expansion.
 */
export const TAG_LANGUAGES = new Set([
  // Core markup
  "html",
  "xml",
  "svg",
  "xsl",
  "mathml",
  // Component frameworks / templates
  "vue",
  "svelte",
  "astro",
  "angular",
  "handlebars",
  "lwc",
  "razor",
  "twig",
  "liquid",
  "freemarker2",
  // JSX / TSX
  "jsx",
  "tsx",
  "javascriptreact",
  "typescriptreact",
  // React / Next.js (JSX-based frameworks)
  "react",
  "nextjs",
  // Extended markup
  "mdx",
  // Server-side with embedded HTML
  "php",
  // Markup alias used by Prism / lightweight editor
  "markup",
]);

/**
 * Superset of TAG_LANGUAGES that also includes JS/TS (since they can
 * contain JSX when used inside React / frameworks).
 */
export const AUTO_CLOSE_TAG_LANGUAGES = new Set([
  ...TAG_LANGUAGES,
  "javascript",
  "typescript",
  "markdown",
]);

/** Void / self-closing HTML elements that should NOT get a closing tag */
export const VOID_ELEMENTS = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input",
  "link", "meta", "param", "source", "track", "wbr",
  // common self-closing SVG/MathML elements
  "circle", "ellipse", "line", "path", "polygon", "polyline", "rect", "use",
]);

/* ================================================================== */
/*  Emmet languages                                                    */
/* ================================================================== */

/** Languages where Emmet HTML abbreviation expansion is active */
export const EMMET_MARKUP_LANGUAGES = new Set([
  "html",
  "xml",
  "svg",
  "xsl",
  "vue",
  "svelte",
  "astro",
  "angular",
  "handlebars",
  "lwc",
  "razor",
  "twig",
  "liquid",
  "freemarker2",
  "jsx",
  "tsx",
  "javascriptreact",
  "typescriptreact",
  "react",
  "nextjs",
  "mdx",
  "php",
  "markdown",
  "erb",
  "markup",
]);

/** Languages where Emmet CSS abbreviation expansion is active */
export const EMMET_STYLE_LANGUAGES = new Set([
  "css",
  "scss",
  "less",
  "sass",
  "stylus",
]);

/** Combined Emmet languages (markup + styles) */
export const EMMET_LANGUAGES = new Set([
  ...EMMET_MARKUP_LANGUAGES,
  ...EMMET_STYLE_LANGUAGES,
]);

/* ================================================================== */
/*  CSS family                                                         */
/* ================================================================== */

export const CSS_FAMILY = new Set([
  "css",
  "scss",
  "less",
  "sass",
  "stylus",
]);

/* ================================================================== */
/*  Color-capable languages (hex, rgb, hsl, named colors)              */
/* ================================================================== */

/** Languages where inline color swatches / color picker should appear */
export const COLOR_LANGUAGES = new Set([
  // Stylesheets
  "css", "scss", "less", "sass", "stylus", "tailwindcss",
  // Markup / template (often contain inline styles)
  "html", "svg", "xml", "vue", "svelte", "astro", "php",
  "angular", "handlebars", "lwc", "razor", "twig", "liquid",
  "freemarker2", "mdx",
  // Scripting (CSS-in-JS, theme objects, etc.)
  "javascript", "typescript", "javascriptreact", "typescriptreact",
  "jsx", "tsx", "react", "nextjs", "shadcn",
  // Data / config (color values in themes, manifests)
  "json", "jsonc", "json5", "toml", "yaml",
  // Languages with color literals
  "python", "ruby", "swift", "dart", "kotlin",
]);

/** CSS languages where named color previews apply */
export const CSS_COLOR_LANGUAGES = new Set([
  "css", "scss", "less", "sass", "stylus",
  "html", "svg", "vue", "svelte", "astro", "php",
  "angular", "handlebars",
]);

/* ================================================================== */
/*  JSON family                                                        */
/* ================================================================== */

export const JSON_FAMILY = new Set([
  "json",
  "jsonc",
  "json5",
]);

/* ================================================================== */
/*  Shell family                                                       */
/* ================================================================== */

export const SHELL_FAMILY = new Set([
  "shell",
  "shellscript",
  "bash",
  "sh",
  "zsh",
  "fish",
]);

/* ================================================================== */
/*  SQL family                                                         */
/* ================================================================== */

export const SQL_FAMILY = new Set([
  "sql",
  "mysql",
  "pgsql",
  "redshift",
  "msdax",
  "sparql",
  "cypher",
]);

/* ================================================================== */
/*  Parameter hints languages (function signature help)                */
/* ================================================================== */

export const PARAMETER_HINT_LANGUAGES = new Set([
  "javascript",
  "typescript",
  "javascriptreact",
  "typescriptreact",
  "jsx",
  "tsx",
  "python",
  "go",
  "rust",
  "java",
  "kotlin",
  "csharp",
  "cpp",
  "c",
  "objective-c",
  "swift",
  "dart",
  "php",
  "ruby",
  "scala",
  "lua",
  "elixir",
  "r",
  "perl",
  "julia",
  "clojure",
  "haskell",
  "fsharp",
  "ocaml",
]);

/* ================================================================== */
/*  Context Engine languages (from @enjoys/context-engine manifest)     */
/* ================================================================== */

/**
 * All 94 language IDs from @enjoys/context-engine v1.8.0 manifest.
 * Each has full provider data (completion, hover, definition, etc.).
 * @see https://cdn.jsdelivr.net/npm/@enjoys/context-engine@1.8.0/data/manifest.json
 */
export const CONTEXT_ENGINE_LANGUAGES = [
  "abap", "angular", "apex", "awk", "azcli",
  "bicep", "c", "caddy", "cameligo", "clojure",
  "coffee", "cpp", "crontab", "csharp", "css",
  "cypher", "dart", "docker-compose", "dockerfile", "doctest",
  "dotenv", "ecl", "elixir", "flow9", "freemarker2",
  "go", "graphql", "hcl", "html", "ini",
  "java", "javascript", "json", "julia", "kotlin",
  "less", "lexon", "liquid", "lua", "m3",
  "makefile", "markdown", "mdx", "mips", "msdax",
  "mysql", "nestjs", "nextjs", "nginx", "objective-c",
  "pascal", "pascaligo", "perl", "pgsql", "php",
  "pla", "postiats", "powerquery", "powershell", "protobuf",
  "python", "qsharp", "r", "razor", "react",
  "redis", "redis-cli", "redshift", "restructuredtext", "ruby",
  "rust", "sb", "scala", "scheme", "scss",
  "shadcn", "shell", "sol", "sparql", "sql",
  "ssh_config", "st", "swift", "systemd", "systemverilog",
  "tailwindcss", "tcl", "toml", "twig", "typescript",
  "vb", "wgsl", "xml", "yaml",
] as const;

/* ================================================================== */
/*  All supported languages (master set)                               */
/* ================================================================== */

/** Union of all language IDs the editor actively supports with tooling */
export const ALL_LANGUAGES = new Set<string>([
  ...CONTEXT_ENGINE_LANGUAGES,
  // Extra completion-directory languages not in main array
  "bash", "zsh",
  // Monaco-specific aliases & variants
  "javascriptreact", "typescriptreact", "jsx", "tsx",
  "jsonc", "json5",
  "shellscript", "sh", "fish",
  "sass", "stylus",
  "svg", "xsl", "mathml",
  "erb", "markup",
  // Additional languages not in manifest
  "groovy", "fsharp", "ocaml", "haskell", "erlang",
  "zig", "elm", "solidity",
  "prisma", "latex",
  "svelte", "astro", "vue", "handlebars", "lwc",
  "plaintext",
]);
