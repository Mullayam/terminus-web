/**
 * @module monaco-editor/lib/context-engine
 *
 * Monaco-specific context-engine provider registration.
 *
 * The shared context-engine layer (API + IndexedDB storage) lives in
 * `@/lib/context-engine/` and is used by both Monaco and SSH terminal.
 * This sub-module contains only the Monaco provider registration and
 * converter adapters that translate IndexedDB data → Monaco providers.
 */
export {
  registerContextEngineProviders,
  registerContextEngineForLanguage,
  disposeContextEngineProviders,
} from "./contextEngineProviders";
