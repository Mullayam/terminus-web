/**
 * @module editor/plugins/builtin/rust-helpers
 *
 * Rust-specific helpers: common derive macros, trait suggestions,
 * error handling patterns, and snippets.
 */
import type { ExtendedEditorPlugin, CompletionProvider, CompletionItem, CompletionContext } from "../types";

const RUST_SNIPPETS: Record<string, { label: string; insertText: string; detail: string }> = {
    "fn": { label: "fn", insertText: "fn () {\n    \n}", detail: "Function" },
    "pfn": { label: "pub fn", insertText: "pub fn () {\n    \n}", detail: "Public function" },
    "impl": { label: "impl", insertText: "impl  {\n    \n}", detail: "Implementation block" },
    "struct": { label: "struct", insertText: "#[derive(Debug, Clone)]\nstruct  {\n    \n}", detail: "Struct with derive" },
    "enum": { label: "enum", insertText: "#[derive(Debug, Clone)]\nenum  {\n    \n}", detail: "Enum with derive" },
    "trait": { label: "trait", insertText: "trait  {\n    \n}", detail: "Trait definition" },
    "test": { label: "#[test]", insertText: "#[test]\nfn test_() {\n    \n}", detail: "Test function" },
    "mod_test": { label: "#[cfg(test)]", insertText: "#[cfg(test)]\nmod tests {\n    use super::*;\n\n    #[test]\n    fn test_() {\n        \n    }\n}", detail: "Test module" },
    "match": { label: "match", insertText: "match  {\n    _ => todo!(),\n}", detail: "Match expression" },
    "iflet": { label: "if let", insertText: "if let Some() =  {\n    \n}", detail: "If let pattern" },
    "unwrap_or": { label: "unwrap_or_else", insertText: ".unwrap_or_else(|e| {\n    \n})", detail: "unwrap_or_else" },
    "map_err": { label: "map_err", insertText: ".map_err(|e| {\n    \n})?", detail: "map_err with ?" },
};

const DERIVE_MACROS = [
    "Debug", "Clone", "Copy", "PartialEq", "Eq", "Hash",
    "PartialOrd", "Ord", "Default", "Serialize", "Deserialize",
];

class RustCompletionProvider implements CompletionProvider {
    id = "rust-helpers:completions";
    triggerCharacters = ["."];

    provideCompletions(ctx: CompletionContext): CompletionItem[] {
        if (ctx.language.toLowerCase() !== "rust") return [];

        const items: CompletionItem[] = [];
        const word = ctx.wordBeforeCursor.toLowerCase();
        if (word.length < 2) return [];

        // Snippets
        for (const [key, snippet] of Object.entries(RUST_SNIPPETS)) {
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

        // Derive macros
        for (const derive of DERIVE_MACROS) {
            if (derive.toLowerCase().startsWith(word)) {
                items.push({
                    label: derive,
                    kind: "keyword",
                    insertText: derive,
                    detail: "Derive macro",
                    sortOrder: 1,
                });
            }
        }

        return items.slice(0, 20);
    }
}

export function createRustHelpersPlugin(): ExtendedEditorPlugin {
    return {
        id: "rust-helpers",
        name: "Rust Helpers",
        version: "1.0.0",
        description: "Rust snippets, derive macros, and common patterns",
        category: "language",
        defaultEnabled: true,

        completionProviders: [new RustCompletionProvider()],
    };
}
