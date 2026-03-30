/**
 * @module monaco-editor/plugins/code-quality/cdn-loader
 *
 * Lazy CDN loader with CacheStorage for Prettier & ESLint browser bundles.
 * Scripts are fetched once, cached permanently, and loaded as blob URLs.
 */

const CACHE_NAME = "terminus-code-quality-v1";

const CDN_BASE_PRETTIER = "https://cdn.jsdelivr.net/npm/prettier@3.8.1";
const CDN_BASE_ESLINT =
  "https://cdn.jsdelivr.net/npm/eslint-linter-browserify@10.1.0";
const CDN_BASE_EXTERNAL = "https://esm.sh";

// ── Prettier module map ────────────────────────────────────────
export const PRETTIER_MODULES = {
  standalone: `${CDN_BASE_PRETTIER}/standalone.mjs`,
  estree: `${CDN_BASE_PRETTIER}/plugins/estree.mjs`,
  babel: `${CDN_BASE_PRETTIER}/plugins/babel.mjs`,
  typescript: `${CDN_BASE_PRETTIER}/plugins/typescript.mjs`,
  html: `${CDN_BASE_PRETTIER}/plugins/html.mjs`,
  css: `${CDN_BASE_PRETTIER}/plugins/postcss.mjs`,
  markdown: `${CDN_BASE_PRETTIER}/plugins/markdown.mjs`,
  yaml: `${CDN_BASE_PRETTIER}/plugins/yaml.mjs`,
  graphql: `${CDN_BASE_PRETTIER}/plugins/graphql.mjs`,
  angular: `${CDN_BASE_PRETTIER}/plugins/angular.mjs`,
  glimmer: `${CDN_BASE_PRETTIER}/plugins/glimmer.mjs`,
} as const;

// ── ESLint module map ──────────────────────────────────────────
export const ESLINT_MODULES = {
  linter: `${CDN_BASE_ESLINT}/linter.mjs`,
} as const;

// ── External Prettier plugins (third-party, loaded via esm.sh) ─
// Official @prettier/* plugins + popular community plugins.
// Each is a separate npm package; esm.sh bundles dependencies into one ESM response.
export const PRETTIER_EXTERNAL_PLUGINS = {
  // Official
  php:        `${CDN_BASE_EXTERNAL}/@prettier/plugin-php@0.22.3`,
  xml:        `${CDN_BASE_EXTERNAL}/@prettier/plugin-xml@3.4.1`,
  pug:        `${CDN_BASE_EXTERNAL}/@prettier/plugin-pug@3.1.0`,
  // Community
  java:       `${CDN_BASE_EXTERNAL}/prettier-plugin-java@2.7.0`,
  svelte:     `${CDN_BASE_EXTERNAL}/prettier-plugin-svelte@3.3.3`,
  astro:      `${CDN_BASE_EXTERNAL}/prettier-plugin-astro@0.14.1`,
  sql:        `${CDN_BASE_EXTERNAL}/prettier-plugin-sql@0.18.1`,
  toml:       `${CDN_BASE_EXTERNAL}/prettier-plugin-toml@2.0.1`,
  sh:         `${CDN_BASE_EXTERNAL}/prettier-plugin-sh@0.14.0`,
  solidity:   `${CDN_BASE_EXTERNAL}/prettier-plugin-solidity@1.4.2`,
  kotlin:     `${CDN_BASE_EXTERNAL}/prettier-plugin-kotlin@2.1.0`,
  nginx:      `${CDN_BASE_EXTERNAL}/prettier-plugin-nginx@1.0.3`,
  prisma:     `${CDN_BASE_EXTERNAL}/prettier-plugin-prisma@0.33.0`,
  rust:       `${CDN_BASE_EXTERNAL}/prettier-plugin-rust@0.1.9`,
  elm:        `${CDN_BASE_EXTERNAL}/prettier-plugin-elm@0.11.0`,
  goTemplate: `${CDN_BASE_EXTERNAL}/prettier-plugin-go-template@0.0.15`,
  properties: `${CDN_BASE_EXTERNAL}/prettier-plugin-properties@0.3.0`,
  glsl:       `${CDN_BASE_EXTERNAL}/prettier-plugin-glsl@0.2.0`,
  jsonata:    `${CDN_BASE_EXTERNAL}/prettier-plugin-jsonata@3.4.0`,
} as const;

// ── Language → Prettier parser + required plugins ──────────────
export type PrettierParserConfig = {
  parser: string;
  plugins: (keyof typeof PRETTIER_MODULES)[];
  /** External third-party plugins (lazy-loaded from separate CDN packages) */
  externalPlugins?: (keyof typeof PRETTIER_EXTERNAL_PLUGINS)[];
};

export const LANGUAGE_PRETTIER_MAP: Record<string, PrettierParserConfig> = {
  javascript: { parser: "babel", plugins: ["babel", "estree"] },
  javascriptreact: { parser: "babel", plugins: ["babel", "estree"] },
  typescript: { parser: "typescript", plugins: ["typescript", "estree"] },
  typescriptreact: { parser: "typescript", plugins: ["typescript", "estree"] },
  json: { parser: "json", plugins: ["babel", "estree"] },
  jsonc: { parser: "jsonc", plugins: ["babel", "estree"] },
  json5: { parser: "json5", plugins: ["babel", "estree"] },
  "json-stringify": { parser: "json-stringify", plugins: ["babel", "estree"] },
  html: { parser: "html", plugins: ["html"] },
  vue: { parser: "vue", plugins: ["html"] },
  lwc: { parser: "lwc", plugins: ["html"] },
  css: { parser: "css", plugins: ["css"] },
  scss: { parser: "scss", plugins: ["css"] },
  less: { parser: "less", plugins: ["css"] },
  markdown: { parser: "markdown", plugins: ["markdown"] },
  mdx: { parser: "mdx", plugins: ["markdown"] },
  yaml: { parser: "yaml", plugins: ["yaml"] },
  graphql: { parser: "graphql", plugins: ["graphql"] },
  angular: { parser: "angular", plugins: ["angular", "html"] },
  handlebars: { parser: "glimmer", plugins: ["glimmer"] },

  // ── External plugin languages (official @prettier/* plugins) ──
  php:            { parser: "php",            plugins: [], externalPlugins: ["php"] },
  xml:            { parser: "xml",            plugins: [], externalPlugins: ["xml"] },
  xsl:            { parser: "xml",            plugins: [], externalPlugins: ["xml"] },
  pug:            { parser: "pug",            plugins: [], externalPlugins: ["pug"] },
  jade:           { parser: "pug",            plugins: [], externalPlugins: ["pug"] },

  // ── External plugin languages (community plugins) ────────────
  java:           { parser: "java",           plugins: [], externalPlugins: ["java"] },
  svelte:         { parser: "svelte",         plugins: [], externalPlugins: ["svelte"] },
  astro:          { parser: "astro",          plugins: [], externalPlugins: ["astro"] },
  sql:            { parser: "sql",            plugins: [], externalPlugins: ["sql"] },
  toml:           { parser: "toml",           plugins: [], externalPlugins: ["toml"] },
  shellscript:    { parser: "sh",             plugins: [], externalPlugins: ["sh"] },
  shell:          { parser: "sh",             plugins: [], externalPlugins: ["sh"] },
  solidity:       { parser: "solidity-parse", plugins: [], externalPlugins: ["solidity"] },
  kotlin:         { parser: "kotlin",         plugins: [], externalPlugins: ["kotlin"] },
  nginx:          { parser: "nginx",          plugins: [], externalPlugins: ["nginx"] },
  prisma:         { parser: "prisma",         plugins: [], externalPlugins: ["prisma"] },
  rust:           { parser: "jinx-rust",      plugins: [], externalPlugins: ["rust"] },
  elm:            { parser: "elm",            plugins: [], externalPlugins: ["elm"] },
  glsl:           { parser: "glsl-parse",     plugins: [], externalPlugins: ["glsl"] },
  properties:     { parser: "dot-properties", plugins: [], externalPlugins: ["properties"] },
  jsonata:        { parser: "jsonata",        plugins: [], externalPlugins: ["jsonata"] },
  gotemplate:     { parser: "go-template",    plugins: [], externalPlugins: ["goTemplate"] },
};

// ── Language → ESLint support ──────────────────────────────────
export const ESLINT_SUPPORTED_LANGUAGES = new Set([
  "javascript",
  "javascriptreact",
  "typescript",
  "typescriptreact",
]);

// ── Cache-aware fetch ──────────────────────────────────────────
const moduleCache = new Map<string, unknown>();

async function fetchWithCache(url: string): Promise<string> {
  // Try CacheStorage first
  if ("caches" in globalThis) {
    try {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(url);
      if (cached) return cached.text();

      const res = await fetch(url);
      if (!res.ok) throw new Error(`CDN fetch failed: ${url} (${res.status})`);
      const clone = res.clone();
      await cache.put(url, clone);
      return res.text();
    } catch {
      // Fall through to plain fetch
    }
  }

  const res = await fetch(url);
  if (!res.ok) throw new Error(`CDN fetch failed: ${url} (${res.status})`);
  return res.text();
}

/**
 * Load an ESM module from CDN with caching.
 * Returns the module's exports.
 */
export async function loadCdnModule<T = unknown>(url: string): Promise<T> {
  if (moduleCache.has(url)) return moduleCache.get(url) as T;

  const source = await fetchWithCache(url);
  const blob = new Blob([source], { type: "application/javascript" });
  const blobUrl = URL.createObjectURL(blob);

  try {
    const mod = await import(/* @vite-ignore */ blobUrl);
    moduleCache.set(url, mod);
    return mod as T;
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

/**
 * Load an external ESM module via direct dynamic import.
 * Used for third-party prettier plugins hosted on esm.sh that
 * may contain internal import statements (can't use blob URL method).
 */
export async function loadExternalModule<T = unknown>(url: string): Promise<T> {
  if (moduleCache.has(url)) return moduleCache.get(url) as T;
  const mod = await import(/* @vite-ignore */ url);
  moduleCache.set(url, mod);
  return mod as T;
}

/**
 * Load the Prettier standalone core + required plugins for a language.
 * Returns { prettier, plugins } ready for `prettier.format()`.
 */
export async function loadPrettierForLanguage(languageId: string) {
  const config = LANGUAGE_PRETTIER_MAP[languageId];
  if (!config) return null;

  // Load built-in plugins via CacheStorage/blob URL method
  const builtinPromises: Promise<unknown>[] = [
    loadCdnModule<{ format: Function }>(PRETTIER_MODULES.standalone),
    ...config.plugins.map((p) => loadCdnModule(PRETTIER_MODULES[p])),
  ];

  // Load external plugins via direct import (esm.sh handles bundling)
  const externalPromises = (config.externalPlugins ?? []).map((p) =>
    loadExternalModule(PRETTIER_EXTERNAL_PLUGINS[p]),
  );

  const [prettier, ...builtinPlugins] = await Promise.all(builtinPromises);
  const externalPlugins = await Promise.all(externalPromises);

  return {
    prettier,
    plugins: [...builtinPlugins, ...externalPlugins],
    parser: config.parser,
  };
}

/**
 * Load the ESLint Linter class for browser use.
 */
export async function loadEslintLinter() {
  const mod = await loadCdnModule<{ Linter: new () => unknown }>(
    ESLINT_MODULES.linter,
  );
  return mod.Linter;
}

/**
 * Clear the CDN cache (useful for version upgrades).
 */
export async function clearCdnCache(): Promise<void> {
  moduleCache.clear();
  if ("caches" in globalThis) {
    await caches.delete(CACHE_NAME);
  }
}
