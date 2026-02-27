/**
 * @module lib/monaco/registerAutoClose
 *
 * Registers a CompletionItemProvider that auto-closes HTML and JSX tags
 * when the user types `>`.
 *
 * Example: typing `<div>` inserts `</div>` and places the cursor between.
 */

import type * as monacoNs from "monaco-editor";

type Monaco = typeof monacoNs;

/** Languages where auto-close tags should be active */
const AUTO_CLOSE_LANGUAGES = [
  "html",
  "javascript",
  "typescript",
  "javascriptreact",
  "typescriptreact",
  "xml",
  "svg",
  "vue",
  "svelte",
  "astro",
];

/** Void / self-closing HTML elements that should NOT get a closing tag */
const VOID_ELEMENTS = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input",
  "link", "meta", "param", "source", "track", "wbr",
]);

/**
 * Register auto-close tag functionality for HTML/JSX languages.
 *
 * @param monaco  The Monaco namespace
 * @param editor  The editor instance
 * @returns Array of disposables to clean up
 *
 * ```ts
 * import { registerAutoClose } from "@/modules/monaco-editor";
 *
 * const disposables = registerAutoClose(monaco, editor);
 * // cleanup: disposables.forEach(d => d.dispose());
 * ```
 */
export function registerAutoClose(
  monaco: Monaco,
  editor: monacoNs.editor.IStandaloneCodeEditor,
): monacoNs.IDisposable[] {
  const disposables: monacoNs.IDisposable[] = [];

  // Listen for content changes to detect ">" insertion in supported languages
  const changeDisposable = editor.onDidChangeModelContent((e) => {
    // Only handle single-character insertions of ">"
    for (const change of e.changes) {
      if (change.text !== ">") continue;

      const model = editor.getModel();
      if (!model) continue;

      const langId = model.getLanguageId();
      if (!AUTO_CLOSE_LANGUAGES.includes(langId)) continue;

      const position = editor.getPosition();
      if (!position) continue;

      // Get text from the beginning of the line up to cursor
      const lineContent = model.getLineContent(position.lineNumber);
      const textBeforeCursor = lineContent.substring(0, position.column - 1);

      // Match an opening tag: <tagName ...attributes>
      const tagMatch = textBeforeCursor.match(/<([a-zA-Z][a-zA-Z0-9._-]*)(?:\s[^>]*)?>$/);
      if (!tagMatch) continue;

      const tagName = tagMatch[1].toLowerCase();

      // Don't close void elements
      if (VOID_ELEMENTS.has(tagName)) continue;

      // Don't close if the last char before > is / (self-closing)
      if (textBeforeCursor.endsWith("/>")) continue;

      // Insert the closing tag
      const closingTag = `</${tagMatch[1]}>`;

      // Use setTimeout to avoid interfering with the current edit operation
      setTimeout(() => {
        editor.executeEdits("auto-close-tag", [
          {
            range: {
              startLineNumber: position.lineNumber,
              startColumn: position.column,
              endLineNumber: position.lineNumber,
              endColumn: position.column,
            },
            text: closingTag,
          },
        ]);

        // Move cursor back between the tags
        editor.setPosition({
          lineNumber: position.lineNumber,
          column: position.column,
        });
      }, 0);
    }
  });

  disposables.push(changeDisposable);

  // Also handle slash after < for auto-completing closing tags
  // When user types </ we suggest the matching unclosed tag
  for (const langId of AUTO_CLOSE_LANGUAGES) {
    const providerDisposable = monaco.languages.registerCompletionItemProvider(langId, {
      triggerCharacters: ["/"],
      provideCompletionItems(model, position) {
        const lineContent = model.getLineContent(position.lineNumber);
        const textBeforeCursor = lineContent.substring(0, position.column - 1);

        // Check if we just typed </
        if (!textBeforeCursor.endsWith("</")) {
          return { suggestions: [] };
        }

        // Find the nearest unclosed tag by scanning backwards
        const fullText = model.getValue();
        const offset = model.getOffsetAt(position);
        const textBefore = fullText.substring(0, offset);

        const openTags: string[] = [];
        const tagRegex = /<\/?([a-zA-Z][a-zA-Z0-9._-]*)[^>]*>/g;
        let match: RegExpExecArray | null;

        while ((match = tagRegex.exec(textBefore)) !== null) {
          const isClosing = match[0].startsWith("</");
          const isSelfClosing = match[0].endsWith("/>");
          const tag = match[1];

          if (!isClosing && !isSelfClosing && !VOID_ELEMENTS.has(tag.toLowerCase())) {
            openTags.push(tag);
          } else if (isClosing) {
            // Remove the last matching open tag
            const idx = openTags.lastIndexOf(tag);
            if (idx !== -1) openTags.splice(idx, 1);
          }
        }

        if (openTags.length === 0) return { suggestions: [] };

        const lastOpenTag = openTags[openTags.length - 1];
        const word = model.getWordUntilPosition(position);
        const range: monacoNs.IRange = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        };

        return {
          suggestions: [
            {
              label: `/${lastOpenTag}>`,
              kind: monaco.languages.CompletionItemKind.Property,
              insertText: `${lastOpenTag}>`,
              detail: `Close <${lastOpenTag}>`,
              range,
              sortText: "0", // Sort first
            },
          ],
        };
      },
    });

    disposables.push(providerDisposable);
  }

  return disposables;
}
