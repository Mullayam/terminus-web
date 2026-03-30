/**
 * @module monaco-editor/lib/configureLanguageDefaults
 *
 * Configures Monaco's built-in language services for rich IntelliSense:
 * - TypeScript / JavaScript: compiler options, type acquisition, extra libs
 * - JSON: schema validation
 * - CSS / HTML: built-in validation and suggestions
 *
 * This enables:
 * - Auto-complete suggestions with documentation
 * - Hover information (class docs, function signatures)
 * - Parameter hints
 * - Go to definition (within the same model)
 * - Diagnostics (type errors, syntax errors)
 *
 * Design Pattern: Configuration Module — called once during editor initialization.
 *
 * No external dependencies — uses only Monaco's built-in APIs.
 *
 * NOTE: In monaco-editor ≥0.55, the language service namespaces moved from
 * `monaco.languages.typescript` (deprecated) to top-level `monaco.typescript`,
 * `monaco.json`, `monaco.css`, `monaco.html`.
 */

import {
  typescript as ts,
  json as jsonLang,
  css as cssLang,
  html as htmlLang,
} from "monaco-editor";

let _configured = false;

/**
 * Configure all built-in language services.
 * Safe to call multiple times — only the first call does real work.
 */
export function configureLanguageDefaults(): void {
  if (_configured) return;
  _configured = true;

  configureTypeScript();
  configureJavaScript();
  configureJSON();
  configureCSS();
  configureHTML();
}

/* ────────────────────────────────────────────────────────────
 * TypeScript
 * ──────────────────────────────────────────────────────────── */

function configureTypeScript(): void {
  if (!ts?.typescriptDefaults) return;

  const defaults = ts.typescriptDefaults;

  // Compiler options — enable full type checking and modern JS features
  defaults.setCompilerOptions({
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.NodeJs,
    jsx: ts.JsxEmit.ReactJSX,
    allowJs: true,
    checkJs: false,
    strict: false,
    noEmit: true,
    esModuleInterop: true,
    allowSyntheticDefaultImports: true,
    forceConsistentCasingInFileNames: false,
    resolveJsonModule: true,
    isolatedModules: true,
    skipLibCheck: true,
    lib: ["esnext", "dom", "dom.iterable", "webworker"],
    allowNonTsExtensions: true,
  });

  // Enable IntelliSense features
  defaults.setDiagnosticsOptions({
    noSemanticValidation: false,
    noSyntaxValidation: false,
    noSuggestionDiagnostics: false,
  });

  // Eager model sync so IntelliSense is available immediately
  defaults.setEagerModelSync(true);

  // Add common global type declarations so IntelliSense shows docs
  // for console, document, window, fetch, etc. These are already
  // included via "lib: ['dom']" above, but we can add extra ambient
  // declarations for common Node.js / Web APIs that users expect.
  defaults.addExtraLib(
    `
    /** Process environment variables */
    declare namespace NodeJS {
      interface ProcessEnv {
        readonly NODE_ENV: 'development' | 'production' | 'test';
        readonly [key: string]: string | undefined;
      }
      interface Process {
        env: ProcessEnv;
      }
    }
    declare var process: NodeJS.Process;

    /** Import meta for Vite / ESM */
    interface ImportMeta {
      readonly env: Record<string, string>;
      readonly url: string;
    }
    `,
    "ts:extra/globals.d.ts",
  );

  // Add React types for JSX/TSX IntelliSense
  defaults.addExtraLib(
    `
    declare namespace React {
      type ReactNode = string | number | boolean | null | undefined | React.ReactElement | React.ReactFragment | React.ReactPortal;
      type FC<P = {}> = (props: P) => ReactNode;
      type ReactElement = { type: any; props: any; key: string | null };
      type ReactFragment = {} | ReactNode[];
      type ReactPortal = { key: string | null; children: ReactNode };
      type CSSProperties = Record<string, string | number>;
      type Ref<T> = { current: T | null };
      function useState<T>(initial: T | (() => T)): [T, (v: T | ((prev: T) => T)) => void];
      function useEffect(effect: () => void | (() => void), deps?: any[]): void;
      function useCallback<T extends (...args: any[]) => any>(callback: T, deps: any[]): T;
      function useMemo<T>(factory: () => T, deps: any[]): T;
      function useRef<T>(initial: T): Ref<T>;
      function useContext<T>(context: React.Context<T>): T;
      interface Context<T> { Provider: FC<{ value: T; children?: ReactNode }>; Consumer: FC<{ children: (value: T) => ReactNode }> }
      function createContext<T>(defaultValue: T): Context<T>;
      function createElement(type: any, props?: any, ...children: any[]): ReactElement;
      function Fragment(props: { children?: ReactNode }): ReactElement;
    }
    declare namespace JSX {
      type Element = React.ReactElement;
      interface IntrinsicElements {
        [elemName: string]: any;
      }
    }
    `,
    "ts:extra/react.d.ts",
  );
}

/* ────────────────────────────────────────────────────────────
 * JavaScript
 * ──────────────────────────────────────────────────────────── */

function configureJavaScript(): void {
  if (!ts?.javascriptDefaults) return;

  const defaults = ts.javascriptDefaults;

  defaults.setCompilerOptions({
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.NodeJs,
    jsx: ts.JsxEmit.ReactJSX,
    allowJs: true,
    checkJs: false,
    noEmit: true,
    esModuleInterop: true,
    allowSyntheticDefaultImports: true,
    allowNonTsExtensions: true,
    lib: ["esnext", "dom", "dom.iterable"],
  });

  defaults.setDiagnosticsOptions({
    noSemanticValidation: false,
    noSyntaxValidation: false,
    noSuggestionDiagnostics: false,
  });

  defaults.setEagerModelSync(true);
}

/* ────────────────────────────────────────────────────────────
 * JSON
 * ──────────────────────────────────────────────────────────── */

function configureJSON(): void {
  if (!jsonLang?.jsonDefaults) return;

  jsonLang.jsonDefaults.setDiagnosticsOptions({
    validate: true,
    allowComments: true,
    trailingCommas: "warning",
    schemaValidation: "warning",
    enableSchemaRequest: true,
    schemas: [
      {
        uri: "https://json.schemastore.org/package.json",
        fileMatch: ["package.json"],
      },
      {
        uri: "https://json.schemastore.org/tsconfig.json",
        fileMatch: ["tsconfig.json", "tsconfig.*.json"],
      },
      {
        uri: "https://json.schemastore.org/eslintrc.json",
        fileMatch: [".eslintrc", ".eslintrc.json"],
      },
      {
        uri: "https://json.schemastore.org/prettierrc.json",
        fileMatch: [".prettierrc", ".prettierrc.json"],
      },
    ],
  });
}

/* ────────────────────────────────────────────────────────────
 * CSS / SCSS / LESS
 * ──────────────────────────────────────────────────────────── */

function configureCSS(): void {
  if (!cssLang?.cssDefaults) return;

  cssLang.cssDefaults.setOptions({
    validate: true,
    lint: {
      compatibleVendorPrefixes: "warning",
      duplicateProperties: "warning",
      emptyRules: "warning",
      importStatement: "ignore",
      unknownProperties: "warning",
      unknownVendorSpecificProperties: "ignore",
    },
  });

  if (cssLang.scssDefaults) {
    cssLang.scssDefaults.setOptions({
      validate: true,
      lint: {
        compatibleVendorPrefixes: "warning",
        duplicateProperties: "warning",
        emptyRules: "warning",
        unknownProperties: "warning",
      },
    });
  }

  if (cssLang.lessDefaults) {
    cssLang.lessDefaults.setOptions({
      validate: true,
      lint: {
        compatibleVendorPrefixes: "warning",
        duplicateProperties: "warning",
        emptyRules: "warning",
        unknownProperties: "warning",
      },
    });
  }
}

/* ────────────────────────────────────────────────────────────
 * HTML
 * ──────────────────────────────────────────────────────────── */

function configureHTML(): void {
  if (!htmlLang?.htmlDefaults) return;

  htmlLang.htmlDefaults.setOptions({
    format: {
      tabSize: 2,
      insertSpaces: true,
      wrapLineLength: 120,
      wrapAttributes: "auto",
      indentInnerHtml: true,
      unformatted: "",
      contentUnformatted: "pre,code,textarea",
      preserveNewLines: true,
      maxPreserveNewLines: undefined,
      indentHandlebars: false,
      endWithNewline: false,
      extraLiners: "head, body, /html",
    },
    suggest: {
      html5: true,
    },
  });

  // Handlebars / Razor share the same options API
  if (htmlLang.handlebarDefaults) {
    htmlLang.handlebarDefaults.setOptions({ suggest: { html5: true } });
  }
  if (htmlLang.razorDefaults) {
    htmlLang.razorDefaults.setOptions({ suggest: { html5: true } });
  }
}
