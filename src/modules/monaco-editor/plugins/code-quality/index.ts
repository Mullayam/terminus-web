/**
 * @module monaco-editor/plugins/code-quality
 *
 * Barrel export for ESLint + Prettier code quality plugins.
 *
 * Architecture:
 * ┌─────────────────────────────────────────────────────────────┐
 * │  cdn-loader.ts          — CacheStorage-backed CDN importer  │
 * │  eslint.worker.ts       — Off-thread ESLint linting         │
 * │  prettier-service.ts    — Lazy Prettier format service       │
 * │  eslint-lint-plugin.ts  — MonacoPlugin: lint → markers       │
 * │  prettier-format-plugin.ts — MonacoPlugin: format provider   │
 * │  settings.ts            — Persistent user preferences store  │
 * └─────────────────────────────────────────────────────────────┘
 *
 * Nothing is loaded until a supported language is active.
 * Each parser/plugin is loaded once and cached in CacheStorage + memory.
 */

export { eslintLintPlugin } from "./eslint-lint-plugin";
export { prettierFormatPlugin } from "./prettier-format-plugin";
export { clearCdnCache, loadExternalModule } from "./cdn-loader";
export { preloadPrettier, isPrettierSupported } from "./prettier-service";
export {
  ESLINT_SUPPORTED_LANGUAGES,
  LANGUAGE_PRETTIER_MAP,
  PRETTIER_EXTERNAL_PLUGINS,
} from "./cdn-loader";

// Settings store
export {
  getCodeQualitySettings,
  updateCodeQualitySettings,
  subscribeCodeQualitySettings,
  resetCodeQualitySettings,
} from "./settings";
export type {
  CodeQualitySettings,
  PrettierSettings,
  EslintSettings,
} from "./settings";
