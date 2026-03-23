/**
 * @module monaco-editor/languages/dotenv
 *
 * Custom "dotenv" language definition for Monaco.
 * Provides syntax highlighting for .env files (KEY=VALUE with comments,
 * export keyword, and variable interpolation in double-quoted strings).
 */

import type { CustomLanguageDef } from "../types";

/**
 * Regex that matches .env filenames:
 *   .env, .env.local, .env.production, .env_staging, .env-test,
 *   production.env, app.env.local, etc.
 */
const ENV_FILE_RE = /\.env(?:$|[._-])/i;

/**
 * Check whether a filename (basename, no directory) is a dotenv file.
 */
export function isDotenvFile(fileName: string): boolean {
  const base = fileName.split(/[/\\]/).pop() ?? fileName;
  return ENV_FILE_RE.test(base);
}

export const dotenvLanguageDef: CustomLanguageDef = {
  id: "dotenv",
  extensions: [".env"],
  aliases: ["DotEnv", "dotenv", ".env"],
  mimetypes: ["application/x-dotenv"],

  monarchTokens: {
    tokenizer: {
      root: [
        // Comments
        [/#.*$/, "comment"],
        // export keyword before variable
        [/\b(export)\s+/, "keyword"],
        // Key (before =)
        [/[A-Za-z_][A-Za-z0-9_]*(?=\s*=)/, "variable"],
        // Equals delimiter
        [/=/, "delimiter"],
        // Double-quoted string
        [/"/, "string", "@doubleQuotedString"],
        // Single-quoted string
        [/'/, "string", "@singleQuotedString"],
        // Unquoted value
        [/[^\s#]+/, "string"],
      ],
      doubleQuotedString: [
        [/\$\{[^}]*\}/, "variable"],
        [/\$[A-Za-z_][A-Za-z0-9_]*/, "variable"],
        [/\\./, "string.escape"],
        [/[^"$\\]+/, "string"],
        [/"/, "string", "@pop"],
      ],
      singleQuotedString: [
        [/[^']+/, "string"],
        [/'/, "string", "@pop"],
      ],
    },
  } as CustomLanguageDef["monarchTokens"],

  languageConfig: {
    comments: { lineComment: "#" },
    brackets: [],
    autoClosingPairs: [
      { open: '"', close: '"' },
      { open: "'", close: "'" },
      { open: "${", close: "}" },
    ],
    surroundingPairs: [
      { open: '"', close: '"' },
      { open: "'", close: "'" },
    ],
  },
};
