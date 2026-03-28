/**
 * @module editor/plugins/builtin/toggle-comment
 *
 * Toggle line comments for the current line or selection.
 */
import type { ExtendedEditorPlugin, ExtendedPluginAPI } from "../types";

const COMMENT_MAP: Record<string, { line: string; blockStart?: string; blockEnd?: string }> = {
    javascript: { line: "//", blockStart: "/*", blockEnd: "*/" },
    typescript: { line: "//", blockStart: "/*", blockEnd: "*/" },
    jsx: { line: "//", blockStart: "/*", blockEnd: "*/" },
    tsx: { line: "//", blockStart: "/*", blockEnd: "*/" },
    python: { line: "#" },
    ruby: { line: "#" },
    go: { line: "//", blockStart: "/*", blockEnd: "*/" },
    rust: { line: "//", blockStart: "/*", blockEnd: "*/" },
    java: { line: "//", blockStart: "/*", blockEnd: "*/" },
    c: { line: "//", blockStart: "/*", blockEnd: "*/" },
    cpp: { line: "//", blockStart: "/*", blockEnd: "*/" },
    csharp: { line: "//", blockStart: "/*", blockEnd: "*/" },
    php: { line: "//", blockStart: "/*", blockEnd: "*/" },
    swift: { line: "//", blockStart: "/*", blockEnd: "*/" },
    kotlin: { line: "//", blockStart: "/*", blockEnd: "*/" },
    scala: { line: "//", blockStart: "/*", blockEnd: "*/" },
    html: { line: "<!--", blockStart: "<!--", blockEnd: "-->" },
    xml: { line: "<!--", blockStart: "<!--", blockEnd: "-->" },
    css: { line: "/*", blockStart: "/*", blockEnd: "*/" },
    scss: { line: "//", blockStart: "/*", blockEnd: "*/" },
    less: { line: "//", blockStart: "/*", blockEnd: "*/" },
    sql: { line: "--", blockStart: "/*", blockEnd: "*/" },
    lua: { line: "--", blockStart: "--[[", blockEnd: "]]" },
    shell: { line: "#" },
    bash: { line: "#" },
    yaml: { line: "#" },
    toml: { line: "#" },
    ini: { line: ";" },
    powershell: { line: "#", blockStart: "<#", blockEnd: "#>" },
    r: { line: "#" },
    perl: { line: "#" },
    elixir: { line: "#" },
    haskell: { line: "--", blockStart: "{-", blockEnd: "-}" },
    clojure: { line: ";;" },
    erlang: { line: "%" },
};

function normalizeLanguage(language: string): string {
    const map: Record<string, string> = {
        "JavaScript": "javascript", "JavaScript (JSX)": "jsx",
        "TypeScript": "typescript", "TypeScript (TSX)": "tsx",
        "Python": "python", "Go": "go", "Rust": "rust",
        "HTML": "html", "CSS": "css", "Shell": "shell",
    };
    return map[language] ?? language.toLowerCase();
}

function toggleLineComment(api: ExtendedPluginAPI) {
    const content = api.getContent();
    const { language } = api.getFileInfo();
    const lang = normalizeLanguage(language);
    const commentDef = COMMENT_MAP[lang];
    if (!commentDef) return;

    const { line: cursorLine } = api.getCursorPosition();
    const lines = content.split("\n");
    if (cursorLine < 1 || cursorLine > lines.length) return;

    const idx = cursorLine - 1;
    const trimmed = lines[idx].trimStart();
    const indent = lines[idx].substring(0, lines[idx].length - trimmed.length);
    const prefix = commentDef.line + " ";

    if (trimmed.startsWith(prefix)) {
        lines[idx] = indent + trimmed.slice(prefix.length);
    } else if (trimmed.startsWith(commentDef.line)) {
        lines[idx] = indent + trimmed.slice(commentDef.line.length);
    } else {
        lines[idx] = indent + prefix + trimmed;
    }

    api.setContent(lines.join("\n"));
}

export function createToggleCommentPlugin(): ExtendedEditorPlugin {
    return {
        id: "toggle-comment",
        name: "Toggle Comment",
        version: "1.0.0",
        description: "Toggle line comments for the current line",
        category: "editor",
        defaultEnabled: true,

        onActivate(api) {
            api.registerCommand("toggleComment", () => toggleLineComment(api));

            api.registerKeybinding({
                id: "toggle-comment:line",
                label: "Toggle Line Comment",
                keys: "Ctrl+/",
                handler: (e) => { e.preventDefault(); toggleLineComment(api); },
                when: "editor",
                category: "Edit",
            });
        },
    };
}
