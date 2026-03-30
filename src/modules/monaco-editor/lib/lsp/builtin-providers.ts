/**
 * @module monaco-editor/lib/lsp/builtin-providers
 *
 * Built-in CodeLens and CodeAction providers that work without an LSP server.
 * Provides real quick-fixes, refactorings, diagnostics, and symbol lenses
 * via static analysis (regex + AST-lite patterns) of the editor content.
 *
 * Features:
 *  - CodeLens: reference counting, symbol info, test runners
 *  - CodeAction quick-fixes: common error patterns per language
 *  - CodeAction refactors: extract, surround, convert patterns
 *  - Diagnostics: lightweight linting (unused vars, common mistakes)
 *
 * Usage:
 *   import { registerBuiltinProviders } from "./builtin-providers";
 *   const dispose = registerBuiltinProviders(monaco, "typescript");
 *   // later: dispose();
 */

import type * as monacoNs from "monaco-editor";

type Monaco = typeof monacoNs;
type ITextModel = monacoNs.editor.ITextModel;
type IRange = monacoNs.IRange;
type CodeAction = monacoNs.languages.CodeAction;
type CodeLens = monacoNs.languages.CodeLens;
type IMarkerData = monacoNs.editor.IMarkerData;

/* ════════════════════════════════════════════════════════════
   Shared helpers
   ════════════════════════════════════════════════════════════ */

/** Languages where these providers are most useful */
const JS_FAMILY = new Set([
  "javascript", "typescript", "javascriptreact", "typescriptreact",
]);
const C_FAMILY = new Set(["c", "cpp", "csharp", "java", "kotlin"]);
const ALL_LANGUAGES = new Set([
  ...JS_FAMILY, ...C_FAMILY,
  "python", "go", "rust", "php", "ruby", "lua", "swift",
  "shell", "shellscript", "bash", "powershell",
  "sql", "mysql", "pgsql",
  "yaml", "json", "jsonc", "toml", "xml",
  "html", "css", "scss", "less",
  "markdown", "plaintext",
  "dart", "scala", "elixir", "r", "perl",
]);

function isJSFamily(lang: string): boolean { return JS_FAMILY.has(lang); }

/** Count how many times `word` appears as a whole word in `text` */
function countWordOccurrences(text: string, word: string): number {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`\\b${escaped}\\b`, "g");
  return (text.match(re) || []).length;
}

/** Make a single-file workspace edit */
function makeEdit(
  model: ITextModel,
  range: IRange,
  text: string,
): monacoNs.languages.WorkspaceEdit {
  return {
    edits: [{
      resource: model.uri,
      textEdit: { range, text },
      versionId: model.getVersionId(),
    }],
  };
}

/* ════════════════════════════════════════════════════════════
   1. DIAGNOSTICS — lightweight client-side linting
   ════════════════════════════════════════════════════════════ */

interface DiagnosticRule {
  /** Languages this rule applies to (empty = all) */
  languages?: Set<string>;
  /** Pattern to match on a single line */
  pattern: RegExp;
  /** Severity (1=Error, 2=Warning, 4=Hint in Monaco) */
  severity: "error" | "warning" | "info" | "hint";
  /** Message to display */
  message: string | ((match: RegExpMatchArray, line: string) => string);
  /** Diagnostic code for quick-fix matching */
  code: string;
}

const DIAGNOSTIC_RULES: DiagnosticRule[] = [
  // JS/TS: console.log left in code
  {
    languages: JS_FAMILY,
    pattern: /\bconsole\.(log|debug|info)\s*\(/,
    severity: "warning",
    message: (m) => `console.${m[1]}() statement — consider removing before production`,
    code: "no-console",
  },
  // JS/TS: debugger statement
  {
    languages: JS_FAMILY,
    pattern: /^\s*debugger\s*;?\s*$/,
    severity: "warning",
    message: "debugger statement left in code",
    code: "no-debugger",
  },
  // JS/TS: == instead of ===
  {
    languages: JS_FAMILY,
    pattern: /[^!=<>]==[^=]/,
    severity: "info",
    message: "Use === instead of == for strict equality",
    code: "eqeqeq",
  },
  // JS/TS: != instead of !==
  {
    languages: JS_FAMILY,
    pattern: /[^!]!=[^=]/,
    severity: "info",
    message: "Use !== instead of != for strict inequality",
    code: "no-neq",
  },
  // JS/TS: var usage
  {
    languages: JS_FAMILY,
    pattern: /^\s*var\s+/,
    severity: "info",
    message: "Use 'let' or 'const' instead of 'var'",
    code: "no-var",
  },
  // JS/TS: empty catch block
  {
    languages: JS_FAMILY,
    pattern: /catch\s*\([^)]*\)\s*\{\s*\}/,
    severity: "warning",
    message: "Empty catch block — errors will be silently swallowed",
    code: "no-empty-catch",
  },
  // JS/TS: alert()
  {
    languages: JS_FAMILY,
    pattern: /\balert\s*\(/,
    severity: "warning",
    message: "alert() blocks the UI thread — use a notification component instead",
    code: "no-alert",
  },
  // All: very long line
  {
    pattern: /^.{200,}$/,
    severity: "hint",
    message: "Line exceeds 200 characters — consider breaking it up",
    code: "max-line-length",
  },
  // Python: bare except
  {
    languages: new Set(["python"]),
    pattern: /^\s*except\s*:/,
    severity: "warning",
    message: "Bare 'except:' catches all exceptions including KeyboardInterrupt — specify an exception type",
    code: "bare-except",
  },
  // Python: mutable default argument
  {
    languages: new Set(["python"]),
    pattern: /def\s+\w+\s*\([^)]*=\s*(\[\]|\{\})\s*[,)]/,
    severity: "warning",
    message: "Mutable default argument — use None and assign inside the function",
    code: "mutable-default",
  },
  // Go: error not checked (basic heuristic)
  {
    languages: new Set(["go"]),
    pattern: /^\s*\w+,\s*_\s*:?=/,
    severity: "hint",
    message: "Discarded error value — consider checking it",
    code: "unchecked-error",
  },
  // Shell: command without quoting variable
  {
    languages: new Set(["shell", "shellscript", "bash"]),
    pattern: /\$\w+(?!\w|"|})/,
    severity: "info",
    message: "Unquoted variable — wrap in double quotes to prevent word splitting",
    code: "unquoted-var",
  },
  // Rust: unwrap() usage
  {
    languages: new Set(["rust"]),
    pattern: /\.unwrap\(\)/,
    severity: "info",
    message: ".unwrap() will panic on None/Err — consider using ? or match",
    code: "no-unwrap",
  },
  // SQL: SELECT *
  {
    languages: new Set(["sql", "mysql", "pgsql"]),
    pattern: /SELECT\s+\*/i,
    severity: "info",
    message: "SELECT * is discouraged — specify column names explicitly",
    code: "no-select-star",
  },
  // CSS: !important usage
  {
    languages: new Set(["css", "scss", "less"]),
    pattern: /!\s*important/,
    severity: "info",
    message: "!important overrides normal cascading — use more specific selectors instead",
    code: "no-important",
  },
];

function runDiagnostics(
  monaco: Monaco,
  model: ITextModel,
  languageId: string,
): IMarkerData[] {
  const markers: IMarkerData[] = [];
  const lineCount = model.getLineCount();
  const severityMap = {
    error: monaco.MarkerSeverity.Error,
    warning: monaco.MarkerSeverity.Warning,
    info: monaco.MarkerSeverity.Info,
    hint: monaco.MarkerSeverity.Hint,
  };

  for (let i = 1; i <= lineCount; i++) {
    const line = model.getLineContent(i);

    for (const rule of DIAGNOSTIC_RULES) {
      if (rule.languages && !rule.languages.has(languageId)) continue;
      const match = line.match(rule.pattern);
      if (!match) continue;

      const col = (match.index ?? 0) + 1;
      const endCol = col + (match[0]?.length ?? 1);
      markers.push({
        severity: severityMap[rule.severity],
        message: typeof rule.message === "function" ? rule.message(match, line) : rule.message,
        source: "builtin-lint",
        code: rule.code,
        startLineNumber: i,
        startColumn: col,
        endLineNumber: i,
        endColumn: endCol,
      });
    }
  }

  // JS/TS: detect unused variables (simple: declared but used only once = declaration)
  if (isJSFamily(languageId)) {
    const content = model.getValue();
    const varDecl = /\b(?:const|let|var)\s+(\w+)\s*[=:]/g;
    let m: RegExpExecArray | null;
    while ((m = varDecl.exec(content)) !== null) {
      const name = m[1];
      if (name.startsWith("_") || name === "React") continue;
      const count = countWordOccurrences(content, name);
      if (count === 1) {
        const pos = model.getPositionAt(m.index + m[0].indexOf(name));
        markers.push({
          severity: monaco.MarkerSeverity.Hint,
          message: `'${name}' is declared but never used`,
          source: "builtin-lint",
          code: "no-unused-vars",
          startLineNumber: pos.lineNumber,
          startColumn: pos.column,
          endLineNumber: pos.lineNumber,
          endColumn: pos.column + name.length,
          tags: [1], // Unnecessary — Monaco renders as faded
        });
      }
    }
  }

  return markers;
}

/* ════════════════════════════════════════════════════════════
   2. CODE ACTIONS — quick-fixes + refactorings
   ════════════════════════════════════════════════════════════ */

/** Quick-fix generators keyed by diagnostic code */
const QUICK_FIXES: Record<string, (
  monaco: Monaco, model: ITextModel, marker: IMarkerData,
) => CodeAction[]> = {

  "no-console": (_monaco, model, marker) => [{
    title: "Remove console statement",
    kind: "quickfix",
    isPreferred: true,
    diagnostics: [marker],
    edit: makeEdit(model, {
      startLineNumber: marker.startLineNumber,
      startColumn: 1,
      endLineNumber: marker.startLineNumber + 1,
      endColumn: 1,
    }, ""),
  }],

  "no-debugger": (_monaco, model, marker) => [{
    title: "Remove debugger statement",
    kind: "quickfix",
    isPreferred: true,
    diagnostics: [marker],
    edit: makeEdit(model, {
      startLineNumber: marker.startLineNumber,
      startColumn: 1,
      endLineNumber: marker.startLineNumber + 1,
      endColumn: 1,
    }, ""),
  }],

  "eqeqeq": (_monaco, model, marker) => {
    const line = model.getLineContent(marker.startLineNumber);
    const fixed = line.replace(/([^!=<>])==([^=])/g, "$1===$2");
    return [{
      title: "Replace == with ===",
      kind: "quickfix",
      isPreferred: true,
      diagnostics: [marker],
      edit: makeEdit(model, {
        startLineNumber: marker.startLineNumber,
        startColumn: 1,
        endLineNumber: marker.startLineNumber,
        endColumn: line.length + 1,
      }, fixed),
    }];
  },

  "no-neq": (_monaco, model, marker) => {
    const line = model.getLineContent(marker.startLineNumber);
    const fixed = line.replace(/([^!])!=([^=])/g, "$1!==$2");
    return [{
      title: "Replace != with !==",
      kind: "quickfix",
      isPreferred: true,
      diagnostics: [marker],
      edit: makeEdit(model, {
        startLineNumber: marker.startLineNumber,
        startColumn: 1,
        endLineNumber: marker.startLineNumber,
        endColumn: line.length + 1,
      }, fixed),
    }];
  },

  "no-var": (_monaco, model, marker) => {
    const line = model.getLineContent(marker.startLineNumber);
    return [
      {
        title: "Replace 'var' with 'const'",
        kind: "quickfix",
        isPreferred: true,
        diagnostics: [marker],
        edit: makeEdit(model, {
          startLineNumber: marker.startLineNumber, startColumn: 1,
          endLineNumber: marker.startLineNumber, endColumn: line.length + 1,
        }, line.replace(/\bvar\b/, "const")),
      },
      {
        title: "Replace 'var' with 'let'",
        kind: "quickfix",
        diagnostics: [marker],
        edit: makeEdit(model, {
          startLineNumber: marker.startLineNumber, startColumn: 1,
          endLineNumber: marker.startLineNumber, endColumn: line.length + 1,
        }, line.replace(/\bvar\b/, "let")),
      },
    ];
  },

  "no-empty-catch": (_monaco, model, marker) => {
    const line = model.getLineContent(marker.startLineNumber);
    const paramMatch = line.match(/catch\s*\((\w+)\)/);
    const param = paramMatch?.[1] ?? "error";
    const indent = line.match(/^(\s*)/)?.[1] ?? "";
    return [{
      title: "Add error logging to catch block",
      kind: "quickfix",
      isPreferred: true,
      diagnostics: [marker],
      edit: makeEdit(model, {
        startLineNumber: marker.startLineNumber, startColumn: 1,
        endLineNumber: marker.startLineNumber, endColumn: line.length + 1,
      }, line.replace(
        /catch\s*\([^)]*\)\s*\{\s*\}/,
        `catch (${param}) {\n${indent}  console.error(${param});\n${indent}}`,
      )),
    }];
  },

  "no-alert": (_monaco, model, marker) => {
    const line = model.getLineContent(marker.startLineNumber);
    // Extract the argument from alert(...)
    const argMatch = line.match(/\balert\s*\(([^)]*)\)/);
    const arg = argMatch?.[1] ?? '""';
    return [{
      title: "Replace alert() with console.warn()",
      kind: "quickfix",
      isPreferred: true,
      diagnostics: [marker],
      edit: makeEdit(model, {
        startLineNumber: marker.startLineNumber, startColumn: 1,
        endLineNumber: marker.startLineNumber, endColumn: line.length + 1,
      }, line.replace(/\balert\s*\([^)]*\)/, `console.warn(${arg})`)),
    }];
  },

  "no-unused-vars": (_monaco, model, marker) => {
    // Offer to prefix with _ to indicate intentionally unused
    const name = marker.message.match(/'(\w+)'/)?.[1];
    if (!name) return [];
    const line = model.getLineContent(marker.startLineNumber);
    return [
      {
        title: `Prefix with underscore: _${name}`,
        kind: "quickfix",
        diagnostics: [marker],
        edit: makeEdit(model, {
          startLineNumber: marker.startLineNumber, startColumn: 1,
          endLineNumber: marker.startLineNumber, endColumn: line.length + 1,
        }, line.replace(new RegExp(`\\b${name}\\b`), `_${name}`)),
      },
      {
        title: "Remove declaration",
        kind: "quickfix",
        diagnostics: [marker],
        edit: makeEdit(model, {
          startLineNumber: marker.startLineNumber, startColumn: 1,
          endLineNumber: marker.startLineNumber + 1, endColumn: 1,
        }, ""),
      },
    ];
  },

  "bare-except": (_monaco, model, marker) => {
    const line = model.getLineContent(marker.startLineNumber);
    return [{
      title: "Catch specific exception: except Exception:",
      kind: "quickfix",
      isPreferred: true,
      diagnostics: [marker],
      edit: makeEdit(model, {
        startLineNumber: marker.startLineNumber, startColumn: 1,
        endLineNumber: marker.startLineNumber, endColumn: line.length + 1,
      }, line.replace(/except\s*:/, "except Exception:")),
    }];
  },

  "mutable-default": (_monaco, model, marker) => {
    const line = model.getLineContent(marker.startLineNumber);
    const fixed = line
      .replace(/=\s*\[\]/, "=None")
      .replace(/=\s*\{\}/, "=None");
    return [{
      title: "Use None as default instead of mutable",
      kind: "quickfix",
      isPreferred: true,
      diagnostics: [marker],
      edit: makeEdit(model, {
        startLineNumber: marker.startLineNumber, startColumn: 1,
        endLineNumber: marker.startLineNumber, endColumn: line.length + 1,
      }, fixed),
    }];
  },

  "no-unwrap": (_monaco, model, marker) => {
    const line = model.getLineContent(marker.startLineNumber);
    return [
      {
        title: "Replace .unwrap() with .unwrap_or_default()",
        kind: "quickfix",
        isPreferred: true,
        diagnostics: [marker],
        edit: makeEdit(model, {
          startLineNumber: marker.startLineNumber, startColumn: 1,
          endLineNumber: marker.startLineNumber, endColumn: line.length + 1,
        }, line.replace(/\.unwrap\(\)/, ".unwrap_or_default()")),
      },
      {
        title: "Replace .unwrap() with ?",
        kind: "quickfix",
        diagnostics: [marker],
        edit: makeEdit(model, {
          startLineNumber: marker.startLineNumber, startColumn: 1,
          endLineNumber: marker.startLineNumber, endColumn: line.length + 1,
        }, line.replace(/\.unwrap\(\)/, "?")),
      },
    ];
  },

  "unquoted-var": (_monaco, model, marker) => {
    const line = model.getLineContent(marker.startLineNumber);
    const fixed = line.replace(/\$(\w+)/g, '"$$$1"');
    return [{
      title: "Wrap variable in double quotes",
      kind: "quickfix",
      isPreferred: true,
      diagnostics: [marker],
      edit: makeEdit(model, {
        startLineNumber: marker.startLineNumber, startColumn: 1,
        endLineNumber: marker.startLineNumber, endColumn: line.length + 1,
      }, fixed),
    }];
  },
};

/** Refactoring actions available on selection or cursor */
function getRefactorActions(
  model: ITextModel,
  range: IRange,
  languageId: string,
): CodeAction[] {
  const actions: CodeAction[] = [];
  const selectedText = model.getValueInRange(range);
  const line = model.getLineContent(range.startLineNumber);
  const indent = line.match(/^(\s*)/)?.[1] ?? "";

  // ── Selection-based refactors ──
  if (selectedText.length > 0) {
    // Explain selected code
    actions.push({
      title: "💡 Explain this code",
      kind: "refactor",
      command: {
        id: "terminus.explainCode",
        title: "Explain this code",
        arguments: [selectedText],
      },
    });

    // Extract to variable
    if (isJSFamily(languageId)) {
      actions.push({
        title: "Extract to const variable",
        kind: "refactor.extract.constant",
        edit: makeEdit(model, range, `extractedVariable`),
      });
    }
    if (languageId === "python") {
      actions.push({
        title: "Extract to variable",
        kind: "refactor.extract",
        edit: makeEdit(model, range, "extracted_variable"),
      });
    }

    // Surround with try/catch (JS/TS)
    if (isJSFamily(languageId)) {
      actions.push({
        title: "Surround with try/catch",
        kind: "refactor.rewrite",
        edit: makeEdit(model, range,
          `try {\n${indent}  ${selectedText}\n${indent}} catch (error) {\n${indent}  console.error(error);\n${indent}}`),
      });
    }

    // Surround with try/except (Python)
    if (languageId === "python") {
      actions.push({
        title: "Surround with try/except",
        kind: "refactor.rewrite",
        edit: makeEdit(model, range,
          `try:\n${indent}    ${selectedText}\n${indent}except Exception as e:\n${indent}    print(f"Error: {e}")`),
      });
    }

    // Surround with if
    if (isJSFamily(languageId) || C_FAMILY.has(languageId) || languageId === "go" || languageId === "rust") {
      actions.push({
        title: "Surround with if",
        kind: "refactor.rewrite",
        edit: makeEdit(model, range,
          `if (condition) {\n${indent}  ${selectedText}\n${indent}}`),
      });
    }

    // Wrap in function (JS/TS)
    if (isJSFamily(languageId)) {
      actions.push({
        title: "Extract to function",
        kind: "refactor.extract.function",
        edit: makeEdit(model, {
          startLineNumber: range.startLineNumber,
          startColumn: 1,
          endLineNumber: range.endLineNumber,
          endColumn: model.getLineMaxColumn(range.endLineNumber),
        }, `${indent}function extracted() {\n${indent}  ${selectedText}\n${indent}}\n\n${indent}extracted();`),
      });
    }
  }

  // ── Line-based refactors (no selection needed) ──

  // Convert arrow function ↔ regular function (JS/TS)
  if (isJSFamily(languageId)) {
    // arrow to function
    const arrowMatch = line.match(/^(\s*)(?:export\s+)?(?:const|let)\s+(\w+)\s*=\s*(?:async\s+)?\(([^)]*)\)\s*(?::\s*\w+)?\s*=>\s*\{?/);
    if (arrowMatch) {
      const [, ws, name, params] = arrowMatch;
      const isAsync = line.includes("async");
      actions.push({
        title: `Convert to ${isAsync ? "async " : ""}function declaration`,
        kind: "refactor.rewrite",
        edit: makeEdit(model, {
          startLineNumber: range.startLineNumber, startColumn: 1,
          endLineNumber: range.startLineNumber, endColumn: line.length + 1,
        }, `${ws}${isAsync ? "async " : ""}function ${name}(${params}) {`),
      });
    }

    // function to arrow
    const funcMatch = line.match(/^(\s*)(?:export\s+)?(async\s+)?function\s+(\w+)\s*\(([^)]*)\)/);
    if (funcMatch) {
      const [, ws, asyncKw, name, params] = funcMatch;
      actions.push({
        title: "Convert to arrow function",
        kind: "refactor.rewrite",
        edit: makeEdit(model, {
          startLineNumber: range.startLineNumber, startColumn: 1,
          endLineNumber: range.startLineNumber, endColumn: line.length + 1,
        }, `${ws}const ${name} = ${asyncKw ?? ""}(${params}) => {`),
      });
    }

    // String: single quotes ↔ double quotes
    if (line.includes("'") && !line.includes("`")) {
      const flipped = line.replace(/(?<!\\)'([^'\\]*(?:\\.[^'\\]*)*)'/g, '"$1"');
      if (flipped !== line) {
        actions.push({
          title: "Convert single quotes to double quotes",
          kind: "refactor.rewrite",
          edit: makeEdit(model, {
            startLineNumber: range.startLineNumber, startColumn: 1,
            endLineNumber: range.startLineNumber, endColumn: line.length + 1,
          }, flipped),
        });
      }
    }
    if (line.includes('"') && !line.includes("`")) {
      const flipped = line.replace(/(?<!\\)"([^"\\]*(?:\\.[^"\\]*)*)"/g, "'$1'");
      if (flipped !== line) {
        actions.push({
          title: "Convert double quotes to single quotes",
          kind: "refactor.rewrite",
          edit: makeEdit(model, {
            startLineNumber: range.startLineNumber, startColumn: 1,
            endLineNumber: range.startLineNumber, endColumn: line.length + 1,
          }, flipped),
        });
      }
    }

    // Convert string concatenation to template literal
    if (/["'].*\+.*["']/.test(line) || /\+\s*["']/.test(line)) {
      actions.push({
        title: "Convert to template literal",
        kind: "refactor.rewrite",
      });
    }

    // Add JSDoc to function
    const jsdocFuncMatch = line.match(/^(\s*)(?:export\s+)?(?:async\s+)?(?:function\s+\w+|(?:const|let)\s+\w+\s*=\s*(?:async\s+)?\()/);
    if (jsdocFuncMatch) {
      const prevLine = range.startLineNumber > 1
        ? model.getLineContent(range.startLineNumber - 1).trim()
        : "";
      if (!prevLine.endsWith("*/")) {
        const ws = jsdocFuncMatch[1];
        actions.push({
          title: "Add JSDoc comment",
          kind: "refactor.rewrite",
          edit: makeEdit(model, {
            startLineNumber: range.startLineNumber, startColumn: 1,
            endLineNumber: range.startLineNumber, endColumn: 1,
          }, `${ws}/**\n${ws} * Description\n${ws} */\n`),
        });
      }
    }
  }

  // ── Source actions (always available) ──
  if (isJSFamily(languageId)) {
    actions.push({
      title: "Sort imports",
      kind: "source.sortImports",
    });
    actions.push({
      title: "Organize imports",
      kind: "source.organizeImports",
    });
    actions.push({
      title: "Remove all console statements",
      kind: "source",
    });
  }

  return actions;
}

/* ════════════════════════════════════════════════════════════
   3. CODE LENS — symbol info + reference counts
   ════════════════════════════════════════════════════════════ */

import {
  SYMBOL_PATTERNS as SHARED_SYMBOL_PATTERNS,
  type SymbolPatternFamily,
} from "../symbol-patterns";

/**
 * Build a language → RegExp[] index from the shared SYMBOL_PATTERNS.
 * Lazy-initialised once.
 */
let _patternIndex: Map<string, RegExp[]> | null = null;

function getPatternIndex(): Map<string, RegExp[]> {
  if (!_patternIndex) {
    _patternIndex = new Map();
    for (const family of SHARED_SYMBOL_PATTERNS) {
      for (const lang of family.langs) {
        _patternIndex.set(lang, family.patterns);
      }
    }
  }
  return _patternIndex;
}

function getLanguagePatterns(lang: string): RegExp[] {
  const idx = getPatternIndex();
  return idx.get(lang) ?? idx.get("javascript") ?? [];
}

function buildCodeLenses(model: ITextModel, languageId: string): CodeLens[] {
  const lenses: CodeLens[] = [];
  const lineCount = model.getLineCount();
  const content = model.getValue();
  const patterns = getLanguagePatterns(languageId);

  for (let lineNumber = 1; lineNumber <= lineCount; lineNumber++) {
    const lineContent = model.getLineContent(lineNumber);

    for (const pattern of patterns) {
      const match = lineContent.match(pattern);
      if (!match || !match[1]) continue;
      // Skip control-flow keywords that look like functions
      if (["if", "for", "while", "switch", "catch", "return"].includes(match[1])) continue;

      const symbolName = match[1];
      const refCount = countWordOccurrences(content, symbolName);
      // Subtract 1 for the declaration itself
      const usageCount = Math.max(0, refCount - 1);

      const range = {
        startLineNumber: lineNumber,
        startColumn: 1,
        endLineNumber: lineNumber,
        endColumn: 1,
      };

      lenses.push({
        range,
        command: {
          id: "editor.action.referenceSearch.trigger",
          title: `${usageCount} reference${usageCount !== 1 ? "s" : ""}`,
        },
      });

      // Explain lens — triggers inline Explain action on the symbol
      lenses.push({
        range,
        command: {
          id: "terminus.explainSymbol",
          title: `💡 Explain`,
          arguments: [symbolName],
        },
      });

      break; // only first matching pattern per line
    }

    // Test lens for JS/TS test files
    if (isJSFamily(languageId)) {
      const testMatch = lineContent.match(/^\s*(describe|it|test)\s*\(\s*(['"`])(.*?)\2/);
      if (testMatch) {
        const range = {
          startLineNumber: lineNumber,
          startColumn: 1,
          endLineNumber: lineNumber,
          endColumn: 1,
        };
        lenses.push({
          range,
          command: {
            id: "testing.runAtCursor",
            title: `▶ Run "${testMatch[3]}"`,
          },
        });
      }
    }
  }

  return lenses;
}

/* ════════════════════════════════════════════════════════════
   4. PROVIDER REGISTRATION
   ════════════════════════════════════════════════════════════ */

interface BuiltinDiagnosticsHandle extends monacoNs.IDisposable {
  /** Pause linting (e.g. when an LSP server takes over diagnostics) */
  pause: () => void;
  /** Resume linting */
  resume: () => void;
}

function registerBuiltinDiagnostics(
  monaco: Monaco,
  languageId: string,
): BuiltinDiagnosticsHandle {
  let disposed = false;
  let paused = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const clearMarkers = () => {
    for (const model of monaco.editor.getModels()) {
      monaco.editor.setModelMarkers(model, "builtin-lint", []);
    }
  };

  const runLint = () => {
    if (disposed || paused) return;
    const models = monaco.editor.getModels();
    for (const model of models) {
      if (model.getLanguageId() !== languageId) continue;
      const markers = runDiagnostics(monaco, model, languageId);
      monaco.editor.setModelMarkers(model, "builtin-lint", markers);
    }
  };

  // Debounced lint on content changes — listen per model
  const modelDisposables: monacoNs.IDisposable[] = [];
  for (const model of monaco.editor.getModels()) {
    if (model.getLanguageId() !== languageId) continue;
    modelDisposables.push(
      model.onDidChangeContent(() => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(runLint, 600);
      }),
    );
  }

  // Run once immediately
  setTimeout(runLint, 300);

  return {
    pause: () => {
      paused = true;
      if (timer) clearTimeout(timer);
      clearMarkers();
    },
    resume: () => {
      paused = false;
      setTimeout(runLint, 300);
    },
    dispose: () => {
      disposed = true;
      if (timer) clearTimeout(timer);
      for (const d of modelDisposables) d.dispose();
      clearMarkers();
    },
  };
}

function registerBuiltinCodeActions(
  monaco: Monaco,
  languageId: string,
): monacoNs.IDisposable {
  return monaco.languages.registerCodeActionProvider(languageId, {
    provideCodeActions(model, range, context) {
      const actions: CodeAction[] = [];

      // Quick-fixes for our diagnostics
      for (const marker of context.markers) {
        const code = typeof marker.code === "object"
          ? String((marker.code as { value: string }).value)
          : String(marker.code ?? "");

        const fixGen = QUICK_FIXES[code];
        if (fixGen) {
          actions.push(...fixGen(monaco, model, marker));
        }

        // Generic "Suppress warning" action for any builtin-lint marker
        if (marker.source === "builtin-lint" && isJSFamily(languageId)) {
          const line = model.getLineContent(marker.startLineNumber);
          const ws = line.match(/^(\s*)/)?.[1] ?? "";
          actions.push({
            title: `Suppress: // eslint-disable-next-line ${code}`,
            kind: "quickfix",
            diagnostics: [marker],
            edit: makeEdit(model, {
              startLineNumber: marker.startLineNumber,
              startColumn: 1,
              endLineNumber: marker.startLineNumber,
              endColumn: 1,
            }, `${ws}// eslint-disable-next-line ${code}\n`),
          });
        }
      }

      // Refactoring actions
      actions.push(...getRefactorActions(model, range, languageId));

      return { actions, dispose: () => {} };
    },
  });
}

function registerBuiltinCodeLens(
  monaco: Monaco,
  languageId: string,
): monacoNs.IDisposable {
  return monaco.languages.registerCodeLensProvider(languageId, {
    provideCodeLenses(model) {
      const lenses = buildCodeLenses(model, languageId);
      return { lenses, dispose: () => {} };
    },
  });
}

/* ════════════════════════════════════════════════════════════
   PUBLIC API
   ════════════════════════════════════════════════════════════ */

export interface BuiltinProvidersHandle {
  /** Dispose all providers */
  dispose: () => void;
  /** Pause all builtin providers (diagnostics, CodeLens, CodeActions) — call when LSP takes over */
  pause: () => void;
  /** Resume all builtin providers — call when LSP disconnects */
  resume: () => void;
}

/**
 * Register built-in CodeLens, CodeAction (quick-fixes + refactors),
 * and lightweight diagnostics for the given language.
 *
 * Returns a handle with dispose + pause/resume for diagnostics.
 */
export function registerBuiltinProviders(
  monaco: Monaco,
  languageId: string,
): BuiltinProvidersHandle {
  let paused = false;

  const diagnostics = registerBuiltinDiagnostics(monaco, languageId);
  const codeActions = registerBuiltinCodeActions(monaco, languageId);
  const codeLens = registerBuiltinCodeLens(monaco, languageId);

  // Register Explain commands
  const explainSymbolCmd = monaco.editor.registerCommand(
    "terminus.explainSymbol",
    (_accessor, symbolName: string) => {
      const editor = monaco.editor.getEditors()[0];
      if (editor) {
        const model = editor.getModel();
        const langId = model?.getLanguageId() ?? languageId;
        const prompt = `Explain the "${symbolName}" symbol (${langId})`;
        window.dispatchEvent(new CustomEvent("terminus:explain", {
          detail: { type: "symbol", name: symbolName, language: langId, prompt },
        }));
      }
    },
  );

  const explainCodeCmd = monaco.editor.registerCommand(
    "terminus.explainCode",
    (_accessor, code: string) => {
      window.dispatchEvent(new CustomEvent("terminus:explain", {
        detail: { type: "selection", code, prompt: `Explain this code:\n\`\`\`\n${code}\n\`\`\`` },
      }));
    },
  );

  // When paused, dispose CodeLens + CodeActions so LSP's versions take precedence.
  // We re-register them on resume. Diagnostics have their own pause/resume.
  let currentCodeActions = codeActions;
  let currentCodeLens = codeLens;

  console.log(`[builtin-providers] Registered for "${languageId}"`);

  return {
    dispose: () => {
      diagnostics.dispose();
      currentCodeActions.dispose();
      currentCodeLens.dispose();
      explainSymbolCmd.dispose();
      explainCodeCmd.dispose();
      console.log(`[builtin-providers] Disposed all for "${languageId}"`);
    },
    pause: () => {
      if (paused) return;
      paused = true;
      diagnostics.pause();
      currentCodeActions.dispose();
      currentCodeLens.dispose();
      console.log(`[builtin-providers] Paused for "${languageId}" — LSP active`);
    },
    resume: () => {
      if (!paused) return;
      paused = false;
      diagnostics.resume();
      currentCodeActions = registerBuiltinCodeActions(monaco, languageId);
      currentCodeLens = registerBuiltinCodeLens(monaco, languageId);
      console.log(`[builtin-providers] Resumed for "${languageId}" — LSP disconnected`);
    },
  };
}
