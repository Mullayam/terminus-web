/**
 * @module editor/plugins/builtin/auto-close-brackets
 *
 * Auto-close brackets and quotes as you type.
 */
import type { ExtendedEditorPlugin } from "../types";

const PAIRS: Record<string, string> = {
    "(": ")",
    "[": "]",
    "{": "}",
    "'": "'",
    '"': '"',
    "`": "`",
};

export function createAutoCloseBracketsPlugin(): ExtendedEditorPlugin {
    return {
        id: "auto-close-brackets",
        name: "Auto Close Brackets",
        version: "1.0.0",
        description: "Automatically insert matching brackets and quotes",
        category: "editor",
        defaultEnabled: true,

        onContentChange(content, api) {
            const { offset } = api.getCursorPosition();
            if (offset < 1) return;

            const lastChar = content[offset - 1];
            const closing = PAIRS[lastChar];
            if (!closing) return;

            // For quotes, skip if the character before the open quote is an alpha char (likely inside a word)
            if (lastChar === closing) {
                // Check if this is a closing quote rather than an opening one
                const before = content.slice(0, offset - 1);
                const count = (before.match(new RegExp(`\\${lastChar}`, "g")) || []).length;
                if (count % 2 !== 0) return; // Odd count means this is closing
            }

            // Skip if the closing char already follows the cursor
            if (content[offset] === closing) return;

            const newContent = content.slice(0, offset) + closing + content.slice(offset);
            api.setContent(newContent);
        },
    };
}
