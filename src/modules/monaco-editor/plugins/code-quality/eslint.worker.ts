/**
 * @module monaco-editor/plugins/code-quality/eslint.worker
 *
 * Dedicated Web Worker that runs ESLint linting off the main thread.
 * Lazily loads eslint-linter-browserify from CDN on first use.
 *
 * Protocol:
 *   Main → Worker: { id, type: "lint", code, languageId, config? }
 *   Worker → Main: { id, type: "result", markers: IMarkerData[] }
 *                | { id, type: "error", message: string }
 */

const CACHE_NAME = "terminus-code-quality-v1";
const ESLINT_CDN =
  "https://cdn.jsdelivr.net/npm/eslint-linter-browserify@10.1.0/linter.mjs";

// ── Types ──────────────────────────────────────────────────────
interface LintRequest {
  id: number;
  type: "lint";
  code: string;
  languageId: string;
  config?: Record<string, unknown>;
}

interface LintMessage {
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
  message: string;
  ruleId: string | null;
  severity: 1 | 2;
}

interface MarkerData {
  severity: number; // 1=Hint, 2=Info, 4=Warning, 8=Error (Monaco MarkerSeverity)
  message: string;
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
  source: string;
}

// ── Severity mapping (ESLint → Monaco) ─────────────────────────
// ESLint: 1=warning, 2=error
// Monaco MarkerSeverity: 1=Hint, 2=Info, 4=Warning, 8=Error
function toMonacoSeverity(eslintSeverity: 1 | 2): number {
  return eslintSeverity === 2 ? 8 : 4;
}

// ── Lazy Linter singleton ──────────────────────────────────────
let LinterClass: (new () => any) | null = null;
let linterInstance: any = null;

async function getLinter(): Promise<any> {
  if (linterInstance) return linterInstance;

  if (!LinterClass) {
    // Fetch with CacheStorage
    let source: string;
    if ("caches" in globalThis) {
      try {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(ESLINT_CDN);
        if (cached) {
          source = await cached.text();
        } else {
          const res = await fetch(ESLINT_CDN);
          if (!res.ok) throw new Error(`ESLint CDN fetch failed: ${res.status}`);
          const clone = res.clone();
          await cache.put(ESLINT_CDN, clone);
          source = await res.text();
        }
      } catch {
        const res = await fetch(ESLINT_CDN);
        source = await res.text();
      }
    } else {
      const res = await fetch(ESLINT_CDN);
      source = await res.text();
    }

    const blob = new Blob([source], { type: "application/javascript" });
    const blobUrl = URL.createObjectURL(blob);
    try {
      const mod = await import(/* @vite-ignore */ blobUrl);
      LinterClass = mod.Linter;
    } finally {
      URL.revokeObjectURL(blobUrl);
    }
  }

  linterInstance = new LinterClass!();
  return linterInstance;
}

// ── Default ESLint configs per language ────────────────────────
function getDefaultConfig(languageId: string) {
  const isTS = languageId === "typescript" || languageId === "typescriptreact";
  const isJSX =
    languageId === "javascriptreact" || languageId === "typescriptreact";

  return {
    languageOptions: {
      ecmaVersion: "latest" as const,
      sourceType: "module" as const,
      ...(isJSX && {
        parserOptions: {
          ecmaFeatures: { jsx: true },
        },
      }),
      // For TS files we still use default parser (core JS rules only)
      // @typescript-eslint parser is not available in browser
    },
    rules: {
      // Safe subset of core rules that work well for JS and TS
      "no-undef": isTS ? "off" : "warn",
      "no-unused-vars": "warn",
      "no-extra-semi": "error",
      "no-dupe-keys": "error",
      "no-duplicate-case": "error",
      "no-unreachable": "warn",
      "no-constant-condition": "warn",
      "no-empty": "warn",
      "no-ex-assign": "error",
      "no-func-assign": "error",
      "no-irregular-whitespace": "warn",
      "no-sparse-arrays": "warn",
      "use-isnan": "error",
      "valid-typeof": "error",
      eqeqeq: ["warn", "always"],
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-debugger": "warn",
      "no-alert": "warn",
      "no-var": "warn",
      "prefer-const": "warn",
    },
  };
}

// ── Extension → filename mapping for ESLint ────────────────────
function getFilename(languageId: string): string {
  switch (languageId) {
    case "typescript":
      return "file.ts";
    case "typescriptreact":
      return "file.tsx";
    case "javascriptreact":
      return "file.jsx";
    default:
      return "file.js";
  }
}

// ── Message handler ────────────────────────────────────────────
self.onmessage = async (e: MessageEvent<LintRequest>) => {
  const { id, type, code, languageId, config } = e.data;

  if (type !== "lint") return;

  try {
    const linter = await getLinter();
    const lintConfig = config || getDefaultConfig(languageId);

    const messages: LintMessage[] = linter.verify(code, lintConfig, {
      filename: getFilename(languageId),
    });

    const markers: MarkerData[] = messages.map((msg) => ({
      severity: toMonacoSeverity(msg.severity),
      message: msg.ruleId ? `${msg.message} (${msg.ruleId})` : msg.message,
      startLineNumber: msg.line,
      startColumn: msg.column,
      endLineNumber: msg.endLine ?? msg.line,
      endColumn: msg.endColumn ?? msg.column + 1,
      source: "eslint",
    }));

    self.postMessage({ id, type: "result", markers });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    self.postMessage({ id, type: "error", message });
  }
};
