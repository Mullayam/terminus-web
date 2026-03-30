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
  // JSX / TSX
  "jsx",
  "tsx",
  "javascriptreact",
  "typescriptreact",
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
  "jsx",
  "tsx",
  "javascriptreact",
  "typescriptreact",
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
  "css", "scss", "less", "sass", "stylus",
  // Markup / template (often contain inline styles)
  "html", "svg", "xml", "vue", "svelte", "astro", "php",
  "angular", "handlebars", "lwc", "razor", "twig", "liquid",
  // Scripting (CSS-in-JS, theme objects, etc.)
  "javascript", "typescript", "javascriptreact", "typescriptreact",
  "jsx", "tsx",
  // Data / config (color values in themes, manifests)
  "json", "jsonc", "json5", "toml", "yaml",
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
  "swift",
  "dart",
  "php",
  "ruby",
  "scala",
  "lua",
]);

/* ================================================================== */
/*  All supported languages (master set)                               */
/* ================================================================== */

/** Union of all language IDs the editor actively supports with tooling */
export const ALL_LANGUAGES = new Set([
  ...JS_FAMILY,
  ...C_FAMILY,
  ...CSS_FAMILY,
  ...JSON_FAMILY,
  ...SHELL_FAMILY,
  ...SQL_FAMILY,
  "python", "go", "rust", "php", "ruby", "lua", "swift",
  "powershell",
  "yaml", "toml", "xml", "xsl",
  "html", "svg", "vue", "svelte", "astro", "angular",
  "handlebars", "lwc", "razor", "twig", "liquid",
  "markdown", "mdx", "plaintext",
  "dart", "scala", "elixir", "erlang", "r", "perl",
  "haskell", "fsharp", "ocaml", "clojure",
  "julia", "zig", "solidity", "groovy", "vb", "pascal",
  "elm", "scheme", "graphql",
  "prisma", "protobuf", "dockerfile", "makefile",
  "hcl", "latex", "nginx",
]);
