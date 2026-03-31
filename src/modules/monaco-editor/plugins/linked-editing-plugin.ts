/**
 * @module monaco-editor/plugins/linked-editing-plugin
 *
 * Auto-renames matching open/close HTML/JSX tags simultaneously.
 * When you edit an opening tag name, the closing tag updates to match,
 * and vice versa.
 */

import type { MonacoPlugin, PluginContext } from "../types";

import { TAG_LANGUAGES } from "../lib/language/language-groups";

export const linkedEditingPlugin: MonacoPlugin = {
  id: "builtin-linked-editing",
  name: "Linked Editing Ranges",
  version: "1.0.0",
  description: "Auto-rename matching HTML/JSX open and close tags",

  onMount(ctx: PluginContext) {
    ctx.registerLinkedEditingRangeProvider([...TAG_LANGUAGES], {
      provideLinkedEditingRanges(model, position) {
        const line = model.getLineContent(position.lineNumber);
        const text = model.getValue();

        // Check if cursor is on a tag name
        const wordInfo = model.getWordAtPosition(position);
        if (!wordInfo) return null;

        const word = wordInfo.word;
        const col = position.column;

        // Check if we're inside an opening or closing tag
        const before = line.substring(0, col - 1);
        const isClosing = before.lastIndexOf("</") > before.lastIndexOf("<") &&
          !before.substring(before.lastIndexOf("</")).includes(">");
        const isOpening = !isClosing &&
          before.lastIndexOf("<") >= 0 &&
          before.lastIndexOf("<") > before.lastIndexOf(">") &&
          !before.substring(before.lastIndexOf("<")).startsWith("</");

        if (!isOpening && !isClosing) return null;

        // Find the matching tag
        const offset = model.getOffsetAt(position);

        if (isOpening) {
          // Find closing tag: </tagName>
          const closeRe = new RegExp(`</${escapeRegex(word)}>`, "g");
          const openRe = new RegExp(`<${escapeRegex(word)}[\\s>/]`, "g");

          let depth = 0;
          // Start scanning after the current opening tag
          const searchStart = text.indexOf(">", offset);
          if (searchStart < 0) return null;

          const subText = text.substring(searchStart);
          openRe.lastIndex = 0;
          closeRe.lastIndex = 0;

          // Collect all open/close positions
          const events: { pos: number; isOpen: boolean }[] = [];

          let m: RegExpExecArray | null;
          const openReG = new RegExp(openRe.source, "g");
          const closeReG = new RegExp(closeRe.source, "g");

          while ((m = openReG.exec(subText)) !== null) {
            events.push({ pos: m.index, isOpen: true });
          }
          while ((m = closeReG.exec(subText)) !== null) {
            events.push({ pos: m.index, isOpen: false });
          }

          events.sort((a, b) => a.pos - b.pos);

          depth = 0;
          for (const ev of events) {
            if (ev.isOpen) {
              depth++;
            } else {
              if (depth === 0) {
                // Found the matching close tag
                const absPos = searchStart + ev.pos + 2; // skip </
                const closeStart = model.getPositionAt(absPos);
                const closeEnd = model.getPositionAt(absPos + word.length);

                return {
                  ranges: [
                    {
                      startLineNumber: position.lineNumber,
                      startColumn: wordInfo.startColumn,
                      endLineNumber: position.lineNumber,
                      endColumn: wordInfo.endColumn,
                    },
                    {
                      startLineNumber: closeStart.lineNumber,
                      startColumn: closeStart.column,
                      endLineNumber: closeEnd.lineNumber,
                      endColumn: closeEnd.column,
                    },
                  ],
                  wordPattern: /[a-zA-Z][a-zA-Z0-9-]*/,
                };
              }
              depth--;
            }
          }
        } else {
          // isClosing — find the opening tag
          const closeOffset = offset;
          const textBefore = text.substring(0, closeOffset);

          const openRe = new RegExp(`<${escapeRegex(word)}[\\s>/]`, "g");
          const closeRe = new RegExp(`</${escapeRegex(word)}>`, "g");

          const events: { pos: number; isOpen: boolean }[] = [];
          let m: RegExpExecArray | null;

          while ((m = openRe.exec(textBefore)) !== null) {
            events.push({ pos: m.index, isOpen: true });
          }
          while ((m = closeRe.exec(textBefore)) !== null) {
            events.push({ pos: m.index, isOpen: false });
          }

          events.sort((a, b) => b.pos - a.pos); // reverse order

          let depth = 0;
          for (const ev of events) {
            if (!ev.isOpen) {
              depth++;
            } else {
              if (depth === 0) {
                const openStart = model.getPositionAt(ev.pos + 1); // skip <
                const openEnd = model.getPositionAt(ev.pos + 1 + word.length);

                return {
                  ranges: [
                    {
                      startLineNumber: openStart.lineNumber,
                      startColumn: openStart.column,
                      endLineNumber: openEnd.lineNumber,
                      endColumn: openEnd.column,
                    },
                    {
                      startLineNumber: position.lineNumber,
                      startColumn: wordInfo.startColumn,
                      endLineNumber: position.lineNumber,
                      endColumn: wordInfo.endColumn,
                    },
                  ],
                  wordPattern: /[a-zA-Z][a-zA-Z0-9-]*/,
                };
              }
              depth--;
            }
          }
        }

        return null;
      },
    });
  },
};

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
