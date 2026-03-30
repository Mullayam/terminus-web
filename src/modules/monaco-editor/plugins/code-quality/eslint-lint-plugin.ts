/**
 * @module monaco-editor/plugins/code-quality/eslint-lint-plugin
 *
 * Monaco Plugin that provides real-time ESLint linting via a Web Worker.
 * - Loads eslint-linter-browserify lazily on first supported language
 * - Runs linting in a dedicated worker (no main-thread blocking)
 * - Debounces content changes, shows results as editor markers
 * - Supports JS, JSX, TS, TSX (core ESLint rules only)
 * - Reads user preferences from code-quality settings store
 * - Adds context menu actions for toggle and manual lint
 */

import type { MonacoPlugin, PluginContext } from "../../types";
import { ESLINT_SUPPORTED_LANGUAGES } from "./cdn-loader";
import {
  getCodeQualitySettings,
  updateCodeQualitySettings,
  subscribeCodeQualitySettings,
} from "./settings";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — Vite worker import
import EslintWorker from "./eslint.worker?worker";

const OWNER = "eslint-lint-plugin";

export const eslintLintPlugin: MonacoPlugin = {
  id: "builtin-eslint-lint",
  name: "ESLint Linting",
  version: "1.1.0",
  description:
    "Real-time ESLint linting via Web Worker (JS/TS, core rules)",
  priority: -10, // low priority — runs after other plugins

  onMount(ctx: PluginContext) {
    let worker: Worker | null = null;
    let requestId = 0;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let currentLanguage = ctx.getLanguage();
    let active = ESLINT_SUPPORTED_LANGUAGES.has(currentLanguage);

    function getDebounceMs(): number {
      return getCodeQualitySettings().eslint.debounceMs;
    }

    // ── Worker lifecycle ─────────────────────────────────────
    function ensureWorker(): Worker {
      if (!worker) {
        worker = new EslintWorker();
        worker.onmessage = handleWorkerMessage;
        worker.onerror = (e) => {
          console.warn("[eslint-lint-plugin] Worker error:", e.message);
        };
      }
      return worker;
    }

    function terminateWorker() {
      if (worker) {
        worker.terminate();
        worker = null;
      }
    }

    // ── Handle lint results ──────────────────────────────────
    function handleWorkerMessage(e: MessageEvent) {
      const { type, markers } = e.data;
      if (type === "result" && Array.isArray(markers)) {
        const settings = getCodeQualitySettings();
        const filtered = markers.filter((m: { severity: number }) => {
          // Monaco MarkerSeverity: 4=Warning, 8=Error
          if (m.severity === 4 && !settings.eslint.showWarnings) return false;
          if (m.severity === 8 && !settings.eslint.showErrors) return false;
          return true;
        });
        ctx.setModelMarkers(OWNER, filtered);
      }
    }

    // ── Trigger lint ─────────────────────────────────────────
    function lint() {
      const settings = getCodeQualitySettings();
      if (!settings.eslintEnabled || !active) return;

      const code = ctx.getContent();
      if (!code.trim()) {
        ctx.setModelMarkers(OWNER, []);
        return;
      }

      const id = ++requestId;
      const w = ensureWorker();

      // Merge user rule overrides
      const userRules = settings.eslint.rules;
      const config = Object.keys(userRules).length > 0
        ? { rules: userRules }
        : undefined;

      w.postMessage({
        id,
        type: "lint",
        code,
        languageId: currentLanguage,
        ...(config && { config }),
      });
    }

    function debouncedLint() {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(lint, getDebounceMs());
    }

    // ── Activate/deactivate on language change ───────────────
    function onLanguageSwitch(lang: string) {
      currentLanguage = lang;
      const wasActive = active;
      active = ESLINT_SUPPORTED_LANGUAGES.has(lang);

      if (active) {
        lint();
      } else if (wasActive) {
        ctx.setModelMarkers(OWNER, []);
        terminateWorker();
      }
    }

    // ── Content change listener ──────────────────────────────
    ctx.addDisposable(
      ctx.editor.onDidChangeModelContent(() => {
        if (active && getCodeQualitySettings().eslintEnabled) debouncedLint();
      }),
    );

    // ── Listen for language changes via event bus ─────────────
    ctx.addDisposable(
      ctx.on("language-changed", (data) => {
        onLanguageSwitch((data as { languageId: string }).languageId);
      }),
    );

    // ── Initial lint if language is supported ─────────────────
    if (active) lint();

    // ── Context menu: "ESLint: Lint Now" ─────────────────────
    ctx.addAction({
      id: "eslint.lintNow",
      label: "ESLint: Lint This File",
      contextMenuGroupId: "1_modification",
      contextMenuOrder: 2.0,
      precondition: undefined,
      run: () => lint(),
    });

    // ── Context menu: "ESLint: Clear Diagnostics" ────────────
    ctx.addAction({
      id: "eslint.clearDiagnostics",
      label: "ESLint: Clear Diagnostics",
      contextMenuGroupId: "z_commands",
      contextMenuOrder: 10.1,
      run: () => ctx.setModelMarkers(OWNER, []),
    });

    // ── Context menu: "ESLint: Toggle Enable/Disable" ────────
    ctx.addAction({
      id: "eslint.toggle",
      label: "ESLint: Toggle Enable/Disable",
      contextMenuGroupId: "z_commands",
      contextMenuOrder: 10.2,
      run: () => {
        const s = getCodeQualitySettings();
        updateCodeQualitySettings({ eslintEnabled: !s.eslintEnabled });
        const state = !s.eslintEnabled ? "enabled" : "disabled";
        ctx.notify(`ESLint ${state}`, "info");
        if (!s.eslintEnabled) {
          // Re-enabled → re-lint
          lint();
        } else {
          // Disabled → clear markers
          ctx.setModelMarkers(OWNER, []);
          terminateWorker();
        }
      },
    });

    // ── Expose manual trigger via event bus ───────────────────
    ctx.addDisposable(
      ctx.on("eslint:lint-now", () => lint()),
    );

    // ── React to settings changes ────────────────────────────
    const unsubscribe = subscribeCodeQualitySettings((settings) => {
      if (!settings.eslintEnabled && worker) {
        ctx.setModelMarkers(OWNER, []);
        terminateWorker();
      } else if (settings.eslintEnabled && active && !worker) {
        lint();
      }
    });
    ctx.addDisposable({ dispose: unsubscribe });

    // ── Cleanup ──────────────────────────────────────────────
    ctx.addDisposable({
      dispose() {
        if (debounceTimer) clearTimeout(debounceTimer);
        terminateWorker();
      },
    });
  },

  onLanguageChange(language: string, ctx: PluginContext) {
    ctx.emit("language-changed", { languageId: language });
  },

  onDispose() {
    // Worker is cleaned up via addDisposable above
  },
};
