/**
 * @module editor/core/bracket-colorizer
 * Bracket pair colorization engine.
 *
 * Scans content for bracket pairs (), [], {} and assigns nesting-depth
 * color classes. Returns HTML string with colored bracket spans for overlay.
 *
 * Colors cycle through 6 levels: --bracket-color-1 through --bracket-color-6.
 * Mismatched brackets get --bracket-error color.
 */

const OPENERS = new Set(["(", "[", "{"]);
const CLOSERS = new Set([")", "]", "}"]);
const MATCH_MAP: Record<string, string> = {
    ")": "(", "]": "[", "}": "{",
};

const BRACKET_COLORS = 6; // number of cycling colors

/**
 * Given already-HTML-escaped content, inject bracket color spans.
 * This runs AFTER Prism highlighting, so it looks for literal bracket chars.
 *
 * Note: Brackets inside string/comment tokens may still be colored.
 * This is acceptable for an overview colorization approach.
 */
export function colorizeBrackets(htmlContent: string): string {
    // We work on the raw text to find bracket positions, then splice color spans in.
    // Strategy: parse character by character, track nesting depth per bracket type.
    let depth = 0;
    const stack: string[] = [];
    let result = "";
    let i = 0;

    while (i < htmlContent.length) {
        // Skip HTML tags entirely (e.g. <span class="token...">)
        if (htmlContent[i] === "<") {
            const closeIdx = htmlContent.indexOf(">", i);
            if (closeIdx >= 0) {
                result += htmlContent.substring(i, closeIdx + 1);
                i = closeIdx + 1;
                continue;
            }
        }

        // Skip HTML entities like &amp; &lt; &gt;
        if (htmlContent[i] === "&") {
            const semiIdx = htmlContent.indexOf(";", i);
            if (semiIdx >= 0 && semiIdx - i < 8) {
                const entity = htmlContent.substring(i, semiIdx + 1);
                result += entity;
                i = semiIdx + 1;
                continue;
            }
        }

        const ch = htmlContent[i];

        if (OPENERS.has(ch)) {
            depth++;
            stack.push(ch);
            const colorIdx = ((depth - 1) % BRACKET_COLORS) + 1;
            result += `<span class="bracket-color-${colorIdx}">${ch}</span>`;
            i++;
            continue;
        }

        if (CLOSERS.has(ch)) {
            const expected = MATCH_MAP[ch];
            if (stack.length > 0 && stack[stack.length - 1] === expected) {
                const colorIdx = ((depth - 1) % BRACKET_COLORS) + 1;
                result += `<span class="bracket-color-${colorIdx}">${ch}</span>`;
                stack.pop();
                depth = Math.max(0, depth - 1);
            } else {
                // Mismatched bracket
                result += `<span class="bracket-error">${ch}</span>`;
            }
            i++;
            continue;
        }

        result += ch;
        i++;
    }

    return result;
}

/**
 * Check if bracket colorization should run based on content size.
 * Disable for very large files to avoid performance issues.
 */
export function shouldColorizeBrackets(contentLength: number): boolean {
    return contentLength < 100_000; // ~100KB limit
}
