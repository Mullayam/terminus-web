/**
 * @module monaco-editor/plugins/code-quality/settings
 *
 * Persistent settings store for Prettier & ESLint code quality plugins.
 * Settings are saved to localStorage and can be toggled at runtime.
 */

const STORAGE_KEY = "terminus-code-quality-settings";

// ── Prettier options ───────────────────────────────────────────
export interface PrettierSettings {
  printWidth: number;
  tabWidth: number;
  useTabs: boolean;
  semi: boolean;
  singleQuote: boolean;
  trailingComma: "all" | "es5" | "none";
  bracketSpacing: boolean;
  arrowParens: "always" | "avoid";
  jsxSingleQuote: boolean;
  bracketSameLine: boolean;
  proseWrap: "always" | "never" | "preserve";
  htmlWhitespaceSensitivity: "css" | "strict" | "ignore";
  endOfLine: "lf" | "crlf" | "cr" | "auto";
  singleAttributePerLine: boolean;
  formatOnSave: boolean;
}

// ── ESLint options ─────────────────────────────────────────────
export interface EslintSettings {
  /** Custom rule overrides (merged on top of defaults) */
  rules: Record<string, unknown>;
  /** Debounce ms for lint-on-change */
  debounceMs: number;
  /** Show inline decorations for warnings */
  showWarnings: boolean;
  /** Show inline decorations for errors */
  showErrors: boolean;
}

// ── Combined store ─────────────────────────────────────────────
export interface CodeQualitySettings {
  prettierEnabled: boolean;
  eslintEnabled: boolean;
  prettier: PrettierSettings;
  eslint: EslintSettings;
}

const DEFAULTS: CodeQualitySettings = {
  prettierEnabled: true,
  eslintEnabled: true,
  prettier: {
    printWidth: 80,
    tabWidth: 2,
    useTabs: false,
    semi: true,
    singleQuote: false,
    trailingComma: "all",
    bracketSpacing: true,
    arrowParens: "always",
    jsxSingleQuote: false,
    bracketSameLine: false,
    proseWrap: "preserve",
    htmlWhitespaceSensitivity: "css",
    endOfLine: "lf",
    singleAttributePerLine: false,
    formatOnSave: false,
  },
  eslint: {
    rules: {},
    debounceMs: 400,
    showWarnings: true,
    showErrors: true,
  },
};

// ── Load / Save ────────────────────────────────────────────────
function load(): CodeQualitySettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULTS,
      ...parsed,
      prettier: { ...DEFAULTS.prettier, ...parsed.prettier },
      eslint: { ...DEFAULTS.eslint, ...parsed.eslint },
    };
  } catch {
    return { ...DEFAULTS };
  }
}

function save(settings: CodeQualitySettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch { /* noop */ }
}

// ── Singleton instance ─────────────────────────────────────────
let _settings: CodeQualitySettings | null = null;
type Listener = (settings: CodeQualitySettings) => void;
const listeners = new Set<Listener>();

export function getCodeQualitySettings(): CodeQualitySettings {
  if (!_settings) _settings = load();
  return _settings;
}

export function updateCodeQualitySettings(
  patch: Partial<CodeQualitySettings> & {
    prettier?: Partial<PrettierSettings>;
    eslint?: Partial<EslintSettings>;
  },
): CodeQualitySettings {
  const current = getCodeQualitySettings();
  const next: CodeQualitySettings = {
    ...current,
    ...patch,
    prettier: { ...current.prettier, ...patch.prettier },
    eslint: { ...current.eslint, ...patch.eslint },
  };
  _settings = next;
  save(next);
  for (const fn of listeners) {
    try { fn(next); } catch { /* noop */ }
  }
  return next;
}

export function subscribeCodeQualitySettings(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function resetCodeQualitySettings(): CodeQualitySettings {
  _settings = { ...DEFAULTS, prettier: { ...DEFAULTS.prettier }, eslint: { ...DEFAULTS.eslint } };
  save(_settings);
  for (const fn of listeners) {
    try { fn(_settings); } catch { /* noop */ }
  }
  return _settings;
}
