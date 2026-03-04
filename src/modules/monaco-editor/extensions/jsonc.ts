/**
 * @module monaco-editor/extensions/jsonc
 *
 * State-machine JSONC (JSON with Comments) stripper.
 *
 * Correctly handles line comments and block comments while respecting
 * string boundaries — will NOT corrupt comment-like text inside quotes.
 *
 * This replaces the naive regex approach that corrupted values like
 * folding marker patterns or snippet bodies containing double slashes.
 */

/**
 * Strip `//` line comments and `/* block comments *​/` from JSONC text,
 * leaving the result as valid JSON.
 *
 * Example:
 * ```ts
 * stripJsoncComments('{ "a": 1, // comment\n "b": "http://x" }')
 * // → '{ "a": 1, \n "b": "http://x" }'
 * ```
 */
export function stripJsoncComments(text: string): string {
  const len = text.length;
  const result: string[] = [];
  let i = 0;

  while (i < len) {
    const ch = text[i];

    // ── Inside a string literal ──────────────────────────
    if (ch === '"') {
      // Copy the entire string including delimiters
      result.push(ch);
      i++;
      while (i < len) {
        const sc = text[i];
        result.push(sc);
        if (sc === '\\') {
          // Escaped character — copy next char too
          i++;
          if (i < len) {
            result.push(text[i]);
            i++;
          }
          continue;
        }
        if (sc === '"') {
          i++;
          break;
        }
        i++;
      }
      continue;
    }

    // ── Line comment: // ─────────────────────────────────
    if (ch === '/' && i + 1 < len && text[i + 1] === '/') {
      // Skip until end of line
      i += 2;
      while (i < len && text[i] !== '\n') i++;
      continue;
    }

    // ── Block comment: /* ... */ ─────────────────────────
    if (ch === '/' && i + 1 < len && text[i + 1] === '*') {
      i += 2;
      while (i < len) {
        if (text[i] === '*' && i + 1 < len && text[i + 1] === '/') {
          i += 2;
          break;
        }
        i++;
      }
      continue;
    }

    // ── Normal character ─────────────────────────────────
    result.push(ch);
    i++;
  }

  // Strip trailing commas before ] or } (invalid in JSON, common in JSONC)
  return result.join('').replace(/,\s*([\]}])/g, '$1');
}
