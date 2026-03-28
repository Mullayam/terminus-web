/**
 * @module editor/plugins/builtin/go-helpers
 *
 * Go-specific helpers: error handling patterns, struct tags,
 * common package completions.
 */
import type { ExtendedEditorPlugin, CompletionProvider, CompletionItem, CompletionContext } from "../types";

const GO_STDLIB_PACKAGES = [
    "fmt", "os", "io", "bufio", "bytes", "strings", "strconv",
    "math", "sort", "time", "sync", "context", "errors", "log",
    "net", "net/http", "encoding/json", "encoding/xml",
    "database/sql", "crypto", "crypto/sha256", "crypto/md5",
    "regexp", "path", "path/filepath", "flag", "testing",
    "reflect", "runtime", "unicode", "html", "html/template",
];

const GO_SNIPPETS: Record<string, { label: string; insertText: string; detail: string }> = {
    "iferr": {
        label: "if err != nil",
        insertText: "if err != nil {\n\treturn err\n}",
        detail: "Error handling pattern",
    },
    "fori": {
        label: "for i := 0",
        insertText: "for i := 0; i < len(); i++ {\n\t\n}",
        detail: "Classic for loop",
    },
    "forr": {
        label: "for range",
        insertText: "for i, v := range  {\n\t\n}",
        detail: "Range for loop",
    },
    "fn": {
        label: "func",
        insertText: "func () {\n\t\n}",
        detail: "Function declaration",
    },
    "meth": {
        label: "method",
        insertText: "func (r *) () {\n\t\n}",
        detail: "Method declaration",
    },
    "struct": {
        label: "type struct",
        insertText: "type  struct {\n\t\n}",
        detail: "Struct declaration",
    },
    "iface": {
        label: "type interface",
        insertText: "type  interface {\n\t\n}",
        detail: "Interface declaration",
    },
    "main": {
        label: "func main",
        insertText: 'package main\n\nimport "fmt"\n\nfunc main() {\n\tfmt.Println("Hello")\n}',
        detail: "Main function boilerplate",
    },
    "test": {
        label: "func Test",
        insertText: "func Test(t *testing.T) {\n\t\n}",
        detail: "Test function",
    },
    "goroutine": {
        label: "go func",
        insertText: "go func() {\n\t\n}()",
        detail: "Goroutine",
    },
    "defer": {
        label: "defer func",
        insertText: "defer func() {\n\t\n}()",
        detail: "Deferred anonymous function",
    },
};

class GoCompletionProvider implements CompletionProvider {
    id = "go-helpers:completions";
    triggerCharacters = ["."];

    provideCompletions(ctx: CompletionContext): CompletionItem[] {
        if (ctx.language.toLowerCase() !== "go") return [];

        const items: CompletionItem[] = [];
        const word = ctx.wordBeforeCursor.toLowerCase();
        if (word.length < 2) return [];

        // Snippets
        for (const [key, snippet] of Object.entries(GO_SNIPPETS)) {
            if (key.startsWith(word) || snippet.label.toLowerCase().startsWith(word)) {
                items.push({
                    label: snippet.label,
                    kind: "snippet",
                    insertText: snippet.insertText,
                    detail: snippet.detail,
                    sortOrder: 0,
                });
            }
        }

        // Packages
        for (const pkg of GO_STDLIB_PACKAGES) {
            const shortName = pkg.split("/").pop()!;
            if (shortName.toLowerCase().startsWith(word)) {
                items.push({
                    label: shortName,
                    kind: "module",
                    insertText: shortName,
                    detail: `import "${pkg}"`,
                    sortOrder: 1,
                });
            }
        }

        return items.slice(0, 20);
    }
}

export function createGoHelpersPlugin(): ExtendedEditorPlugin {
    return {
        id: "go-helpers",
        name: "Go Helpers",
        version: "1.0.0",
        description: "Go snippets, error handling patterns, and stdlib package completions",
        category: "language",
        defaultEnabled: true,

        completionProviders: [new GoCompletionProvider()],
    };
}
