/**
 * @module editor/plugins/builtin/auto-completion
 *
 * Auto-completion engine plugin.
 * Provides context-aware word completions, keyword completions,
 * and snippet-based suggestions based on the current language.
 */
import type { ExtendedEditorPlugin, ExtendedPluginAPI, CompletionItem, CompletionContext, CompletionProvider } from "../types";

// ── Language keyword maps ────────────────────────────────────

const KEYWORDS: Record<string, string[]> = {
    javascript: [
        "const", "let", "var", "function", "return", "if", "else", "for", "while", "do",
        "switch", "case", "break", "continue", "new", "delete", "typeof", "instanceof",
        "try", "catch", "finally", "throw", "class", "extends", "super", "import", "export",
        "default", "from", "as", "async", "await", "yield", "of", "in", "this", "null",
        "undefined", "true", "false", "void", "debugger", "with",
    ],
    typescript: [
        "const", "let", "var", "function", "return", "if", "else", "for", "while", "do",
        "switch", "case", "break", "continue", "new", "delete", "typeof", "instanceof",
        "try", "catch", "finally", "throw", "class", "extends", "super", "import", "export",
        "default", "from", "as", "async", "await", "yield", "of", "in", "this", "null",
        "undefined", "true", "false", "void", "debugger", "with",
        "interface", "type", "enum", "namespace", "module", "declare", "abstract",
        "implements", "readonly", "keyof", "infer", "never", "unknown", "any",
        "string", "number", "boolean", "object", "symbol", "bigint",
    ],
    python: [
        "def", "class", "return", "if", "elif", "else", "for", "while", "break",
        "continue", "try", "except", "finally", "raise", "import", "from", "as",
        "with", "yield", "lambda", "pass", "del", "global", "nonlocal", "assert",
        "True", "False", "None", "and", "or", "not", "is", "in",
    ],
    go: [
        "func", "return", "if", "else", "for", "range", "switch", "case", "default",
        "break", "continue", "go", "select", "chan", "defer", "fallthrough", "goto",
        "var", "const", "type", "struct", "interface", "map", "package", "import",
        "true", "false", "nil", "iota", "append", "copy", "delete", "len", "cap",
        "make", "new", "panic", "recover", "close", "print", "println",
    ],
    rust: [
        "fn", "let", "mut", "const", "static", "if", "else", "for", "while", "loop",
        "match", "break", "continue", "return", "struct", "enum", "impl", "trait",
        "type", "where", "pub", "mod", "use", "crate", "super", "self", "Self",
        "async", "await", "move", "ref", "unsafe", "extern", "dyn", "box",
        "true", "false", "Some", "None", "Ok", "Err", "Vec", "String", "Option", "Result",
    ],
    html: [
        "div", "span", "p", "a", "img", "ul", "ol", "li", "table", "tr", "td", "th",
        "form", "input", "button", "select", "option", "textarea", "label",
        "header", "footer", "nav", "main", "section", "article", "aside",
        "h1", "h2", "h3", "h4", "h5", "h6", "br", "hr", "pre", "code",
        "script", "style", "link", "meta", "title", "head", "body", "html",
    ],
    css: [
        "display", "position", "top", "right", "bottom", "left", "width", "height",
        "margin", "padding", "border", "background", "color", "font-size", "font-weight",
        "text-align", "flex", "grid", "gap", "justify-content", "align-items",
        "overflow", "z-index", "opacity", "transform", "transition", "animation",
        "box-shadow", "border-radius", "cursor", "pointer-events",
    ],
    json: [],
    yaml: ["true", "false", "null", "yes", "no", "on", "off"],
    shell: [
        "echo", "cd", "ls", "mkdir", "rm", "cp", "mv", "cat", "grep", "find",
        "awk", "sed", "chmod", "chown", "export", "source", "alias", "if", "then",
        "else", "elif", "fi", "for", "do", "done", "while", "case", "esac",
        "function", "return", "exit", "read", "printf", "test", "set", "unset",
    ],
};

// Map Prism language names to our keyword map keys
const LANG_MAP: Record<string, string> = {
    javascript: "javascript", jsx: "javascript",
    typescript: "typescript", tsx: "typescript",
    python: "python", ruby: "python",
    go: "go", rust: "rust",
    markup: "html", html: "html",
    css: "css", scss: "css", less: "css",
    json: "json", yaml: "yaml",
    bash: "shell", shell: "shell",
};

/** Extract all identifiers from content for word-based completion */
function extractIdentifiers(content: string): Set<string> {
    const ids = new Set<string>();
    const regex = /\b[a-zA-Z_$][a-zA-Z0-9_$]*\b/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
        if (match[0].length >= 2) {
            ids.add(match[0]);
        }
    }
    return ids;
}

class WordCompletionProvider implements CompletionProvider {
    id = "auto-completion:words";
    triggerCharacters = ["."];

    provideCompletions(ctx: CompletionContext): CompletionItem[] {
        const word = ctx.wordBeforeCursor.toLowerCase();
        if (word.length < 1) return [];

        const items: CompletionItem[] = [];
        const seen = new Set<string>();

        // Keywords for this language
        const langKey = LANG_MAP[ctx.language] ?? ctx.language;
        const keywords = KEYWORDS[langKey] ?? [];
        for (const kw of keywords) {
            if (kw.toLowerCase().startsWith(word) && kw.toLowerCase() !== word) {
                if (!seen.has(kw)) {
                    seen.add(kw);
                    items.push({
                        label: kw,
                        kind: "keyword",
                        insertText: kw,
                        detail: "keyword",
                        sortOrder: 0,
                    });
                }
            }
        }

        // Words from document
        const identifiers = extractIdentifiers(ctx.content);
        for (const id of identifiers) {
            if (id.toLowerCase().startsWith(word) && id.toLowerCase() !== word && !seen.has(id)) {
                seen.add(id);
                items.push({
                    label: id,
                    kind: "text",
                    insertText: id,
                    detail: "word",
                    sortOrder: 2,
                });
            }
        }

        return items.slice(0, 50); // Limit completions
    }
}

export function createAutoCompletionPlugin(): ExtendedEditorPlugin {
    return {
        id: "auto-completion",
        name: "Auto-Completion Engine",
        version: "1.0.0",
        description: "Context-aware word and keyword completions",
        category: "editor",
        defaultEnabled: true,

        completionProviders: [new WordCompletionProvider()],

        onActivate(api) {
            api.registerCommand("triggerCompletion", () => {
                // Trigger completion externally – handled by CompletionWidget
            });
        },
    };
}
