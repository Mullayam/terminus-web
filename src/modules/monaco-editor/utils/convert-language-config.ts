/**
 * @module monaco-editor/utils/convert-language-config
 *
 * Converts a VS Code `language-configuration.json` object into Monaco's
 * `languages.LanguageConfiguration` format.
 *
 * Key differences between the two formats:
 *  - VS Code stores regex patterns as *strings*; Monaco needs `RegExp` objects.
 *  - `autoClosingPairs` can be tuples or objects in VS Code — Monaco expects objects.
 *  - `surroundingPairs` can be tuples or objects — Monaco expects objects.
 *  - `onEnterRules[].action.indent` is a string enum in VS Code, a numeric enum in Monaco.
 */

import * as monacoNs from "monaco-editor";
import type { VSCodeLanguageConfiguration } from "../lib/extractVSIX";

type MonacoLangConfig = monacoNs.languages.LanguageConfiguration;

/**
 * Safely create a RegExp from a string pattern.
 * Returns `undefined` when the pattern is invalid.
 */
function safeRegex(pattern: string | undefined | null): RegExp | undefined {
  if (!pattern) return undefined;
  try {
    return new RegExp(pattern);
  } catch {
    console.warn(`[convert-language-config] Invalid regex: ${pattern}`);
    return undefined;
  }
}

/**
 * Convert a VS Code language-configuration.json into a Monaco LanguageConfiguration.
 */
export function convertVSCodeLanguageConfig(
  raw: VSCodeLanguageConfiguration,
): MonacoLangConfig {
  const config: MonacoLangConfig = {};

  // ── Comments ────────────────────────────────────────────
  if (raw.comments) {
    config.comments = {};
    if (raw.comments.lineComment) {
      config.comments.lineComment = raw.comments.lineComment;
    }
    if (raw.comments.blockComment) {
      config.comments.blockComment = raw.comments.blockComment;
    }
  }

  // ── Brackets ────────────────────────────────────────────
  if (raw.brackets && Array.isArray(raw.brackets)) {
    config.brackets = raw.brackets as [string, string][];
  }

  // ── Auto-closing pairs ──────────────────────────────────
  if (raw.autoClosingPairs && Array.isArray(raw.autoClosingPairs)) {
    config.autoClosingPairs = raw.autoClosingPairs.map((pair) => {
      if (Array.isArray(pair)) {
        return { open: pair[0], close: pair[1] };
      }
      return {
        open: pair.open,
        close: pair.close,
        notIn: pair.notIn,
      };
    });
  }

  // ── Surrounding pairs ──────────────────────────────────
  if (raw.surroundingPairs && Array.isArray(raw.surroundingPairs)) {
    config.surroundingPairs = raw.surroundingPairs.map((pair) => {
      if (Array.isArray(pair)) {
        return { open: pair[0], close: pair[1] };
      }
      return { open: pair.open, close: pair.close };
    });
  }

  // ── Colorized bracket pairs ────────────────────────────
  if (raw.colorizedBracketPairs && Array.isArray(raw.colorizedBracketPairs)) {
    config.colorizedBracketPairs = raw.colorizedBracketPairs as [string, string][];
  }

  // ── Word pattern ───────────────────────────────────────
  if (raw.wordPattern) {
    const regex = safeRegex(raw.wordPattern);
    if (regex) {
      config.wordPattern = regex;
    }
  }

  // ── Indentation rules ──────────────────────────────────
  if (raw.indentationRules) {
    const inc = safeRegex(raw.indentationRules.increaseIndentPattern);
    const dec = safeRegex(raw.indentationRules.decreaseIndentPattern);
    if (inc && dec) {
      config.indentationRules = {
        increaseIndentPattern: inc,
        decreaseIndentPattern: dec,
        indentNextLinePattern: safeRegex(raw.indentationRules.indentNextLinePattern),
        unIndentedLinePattern: safeRegex(raw.indentationRules.unIndentedLinePattern),
      };
    }
  }

  // ── Folding ────────────────────────────────────────────
  if (raw.folding) {
    config.folding = {
      offSide: raw.folding.offSide,
    };
    if (raw.folding.markers) {
      config.folding.markers = {
        start: safeRegex(raw.folding.markers.start) ?? /^\s*$/,
        end: safeRegex(raw.folding.markers.end) ?? /^\s*$/,
      };
    }
  }

  // ── On-enter rules ────────────────────────────────────
  if (raw.onEnterRules && Array.isArray(raw.onEnterRules)) {
    config.onEnterRules = [];
    for (const rule of raw.onEnterRules) {
      const beforeText = safeRegex(rule.beforeText);
      if (!beforeText) continue;

      const action = convertIndentAction(rule.action);
      if (!action) continue;

      const onEnter: monacoNs.languages.OnEnterRule = {
        beforeText,
        action,
      };

      if (rule.afterText) {
        const afterText = safeRegex(rule.afterText);
        if (afterText) onEnter.afterText = afterText;
      }
      if (rule.previousLineText) {
        const prev = safeRegex(rule.previousLineText);
        if (prev) onEnter.previousLineText = prev;
      }

      config.onEnterRules.push(onEnter);
    }
  }

  // ── Auto-close before ─────────────────────────────────
  if (raw.autoCloseBefore) {
    config.autoCloseBefore = raw.autoCloseBefore;
  }

  return config;
}

/**
 * Convert a VS Code indent action string to Monaco's `IndentAction` enum value.
 *
 * Monaco IndentAction enum:
 *   None = 0, Indent = 1, IndentOutdent = 2, Outdent = 3
 */
function convertIndentAction(
  action: { indent: string; appendText?: string; removeText?: number },
): monacoNs.languages.EnterAction | undefined {
  const indentMap: Record<string, number> = {
    none: 0,         // IndentAction.None
    indent: 1,       // IndentAction.Indent
    indentOutdent: 2,// IndentAction.IndentOutdent
    outdent: 3,      // IndentAction.Outdent
  };

  const indentAction = indentMap[action.indent];
  if (indentAction === undefined) return undefined;

  const result: monacoNs.languages.EnterAction = {
    indentAction: indentAction as monacoNs.languages.IndentAction,
  };

  if (action.appendText) result.appendText = action.appendText;
  if (action.removeText !== undefined) result.removeText = action.removeText;

  return result;
}
