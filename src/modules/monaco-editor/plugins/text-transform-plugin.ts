/**
 * @module monaco-editor/plugins/text-transform-plugin
 *
 * Command palette actions for text transformation:
 * UPPERCASE, lowercase, Title Case, camelCase, snake_case,
 * kebab-case, PascalCase, CONSTANT_CASE, and more.
 */

import type { MonacoPlugin, PluginContext } from "../types";

function toTitleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

function toCamelCase(s: string): string {
  return s
    .replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ""))
    .replace(/^./, (c) => c.toLowerCase());
}

function toPascalCase(s: string): string {
  return s
    .replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ""))
    .replace(/^./, (c) => c.toUpperCase());
}

function toSnakeCase(s: string): string {
  return s
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .replace(/[-\s]+/g, "_")
    .toLowerCase();
}

function toKebabCase(s: string): string {
  return s
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/[_\s]+/g, "-")
    .toLowerCase();
}

function toConstantCase(s: string): string {
  return toSnakeCase(s).toUpperCase();
}

function toSentenceCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function reverseString(s: string): string {
  return s.split("").reverse().join("");
}

function toSortLines(s: string): string {
  return s.split("\n").sort((a, b) => a.localeCompare(b)).join("\n");
}

function toSortLinesReverse(s: string): string {
  return s.split("\n").sort((a, b) => b.localeCompare(a)).join("\n");
}

function toUniqueLines(s: string): string {
  return [...new Set(s.split("\n"))].join("\n");
}

export const textTransformPlugin: MonacoPlugin = {
  id: "builtin-text-transform",
  name: "Text Transform",
  version: "1.0.0",
  description: "Transform text: uppercase, camelCase, snake_case, etc.",

  onMount(ctx: PluginContext) {
    const transform = (fn: (s: string) => string) => {
      const sel = ctx.editor.getSelection();
      const model = ctx.editor.getModel();
      if (!sel || !model || sel.isEmpty()) return;

      const text = model.getValueInRange(sel);
      const result = fn(text);
      if (result !== text) {
        ctx.editor.executeEdits("text-transform", [{ range: sel, text: result }]);
        // Restore selection
        ctx.editor.setSelection(new ctx.monaco.Range(
          sel.startLineNumber, sel.startColumn,
          sel.startLineNumber + result.split("\n").length - 1,
          result.includes("\n")
            ? result.split("\n").pop()!.length + 1
            : sel.startColumn + result.length,
        ));
      }
    };

    const actions: [string, string, (s: string) => string, number[]?][] = [
      ["transform.uppercase", "Transform to UPPERCASE", (s) => s.toUpperCase()],
      ["transform.lowercase", "Transform to lowercase", (s) => s.toLowerCase()],
      ["transform.titlecase", "Transform to Title Case", toTitleCase],
      ["transform.sentencecase", "Transform to Sentence case", toSentenceCase],
      ["transform.camelcase", "Transform to camelCase", toCamelCase],
      ["transform.pascalcase", "Transform to PascalCase", toPascalCase],
      ["transform.snakecase", "Transform to snake_case", toSnakeCase],
      ["transform.kebabcase", "Transform to kebab-case", toKebabCase],
      ["transform.constantcase", "Transform to CONSTANT_CASE", toConstantCase],
      ["transform.reverse", "Reverse Text", reverseString],
      ["transform.sortlines", "Sort Lines Ascending", toSortLines],
      ["transform.sortlines-desc", "Sort Lines Descending", toSortLinesReverse],
      ["transform.uniquelines", "Remove Duplicate Lines", toUniqueLines],
    ];

    for (const [id, label, fn, keybindings] of actions) {
      ctx.addAction({
        id,
        label,
        keybindings,
        run: () => transform(fn),
      });
    }
  },
};
