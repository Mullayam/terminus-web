/**
 * @module editor/plugins/builtin/snippet-manager
 *
 * Built-in snippet expansion for common patterns.
 */
import type { ExtendedEditorPlugin, CompletionProvider, CompletionItem, CompletionContext } from "../types";

interface Snippet {
    prefix: string;
    body: string;
    description: string;
    languages?: string[];
}

const SNIPPETS: Snippet[] = [
    // JavaScript / TypeScript
    { prefix: "clg", body: "console.log($1);", description: "Console log", languages: ["javascript", "typescript", "jsx", "tsx"] },
    { prefix: "cle", body: "console.error($1);", description: "Console error", languages: ["javascript", "typescript", "jsx", "tsx"] },
    { prefix: "clw", body: "console.warn($1);", description: "Console warn", languages: ["javascript", "typescript", "jsx", "tsx"] },
    { prefix: "clf", body: "console.log(`$1:`, $1);", description: "Console log with label", languages: ["javascript", "typescript", "jsx", "tsx"] },
    { prefix: "afn", body: "const $1 = async ($2) => {\n  $3\n};", description: "Async arrow function", languages: ["javascript", "typescript", "jsx", "tsx"] },
    { prefix: "fn", body: "function $1($2) {\n  $3\n}", description: "Function declaration", languages: ["javascript", "typescript", "jsx", "tsx"] },
    { prefix: "iife", body: "(() => {\n  $1\n})();", description: "IIFE", languages: ["javascript", "typescript"] },
    { prefix: "ternary", body: "$1 ? $2 : $3", description: "Ternary expression", languages: ["javascript", "typescript", "jsx", "tsx"] },
    { prefix: "trycatch", body: "try {\n  $1\n} catch (error) {\n  console.error(error);\n}", description: "Try-catch block", languages: ["javascript", "typescript", "jsx", "tsx"] },
    { prefix: "promise", body: "new Promise((resolve, reject) => {\n  $1\n});", description: "New Promise", languages: ["javascript", "typescript"] },
    { prefix: "foreach", body: "$1.forEach(($2) => {\n  $3\n});", description: "Array forEach", languages: ["javascript", "typescript", "jsx", "tsx"] },
    { prefix: "map", body: "$1.map(($2) => $3)", description: "Array map", languages: ["javascript", "typescript", "jsx", "tsx"] },
    { prefix: "filter", body: "$1.filter(($2) => $3)", description: "Array filter", languages: ["javascript", "typescript", "jsx", "tsx"] },
    { prefix: "reduce", body: "$1.reduce(($2, $3) => {\n  $4\n}, $5)", description: "Array reduce", languages: ["javascript", "typescript", "jsx", "tsx"] },
    { prefix: "destruct", body: "const { $2 } = $1;", description: "Destructure object", languages: ["javascript", "typescript", "jsx", "tsx"] },

    // React
    { prefix: "rfc", body: "export default function $1() {\n  return (\n    <div>\n      $2\n    </div>\n  );\n}", description: "React functional component", languages: ["jsx", "tsx"] },
    { prefix: "us", body: "const [$1, set$2] = useState($3);", description: "useState hook", languages: ["jsx", "tsx"] },
    { prefix: "ue", body: "useEffect(() => {\n  $1\n  return () => {\n    $2\n  };\n}, [$3]);", description: "useEffect hook", languages: ["jsx", "tsx"] },
    { prefix: "um", body: "const $1 = useMemo(() => $2, [$3]);", description: "useMemo hook", languages: ["jsx", "tsx"] },
    { prefix: "uc", body: "const $1 = useCallback(($2) => {\n  $3\n}, [$4]);", description: "useCallback hook", languages: ["jsx", "tsx"] },

    // Python
    { prefix: "def", body: "def $1($2):\n    $3", description: "Function definition", languages: ["python"] },
    { prefix: "cls", body: "class $1:\n    def __init__(self$2):\n        $3", description: "Class definition", languages: ["python"] },
    { prefix: "ifmain", body: 'if __name__ == "__main__":\n    $1', description: "Main guard", languages: ["python"] },
    { prefix: "with", body: "with open($1, '$2') as f:\n    $3", description: "With open file", languages: ["python"] },
    { prefix: "comprehension", body: "[$2 for $1 in $3]", description: "List comprehension", languages: ["python"] },

    // General
    { prefix: "todo", body: "// TODO: $1", description: "TODO comment" },
    { prefix: "fixme", body: "// FIXME: $1", description: "FIXME comment" },
    { prefix: "note", body: "// NOTE: $1", description: "NOTE comment" },
];

class SnippetCompletionProvider implements CompletionProvider {
    id = "snippet-manager:completions";
    triggerCharacters = [];

    provideCompletions(ctx: CompletionContext): CompletionItem[] {
        const word = ctx.wordBeforeCursor.toLowerCase();
        if (word.length < 2) return [];

        const lang = ctx.language.toLowerCase();
        const items: CompletionItem[] = [];

        for (const snippet of SNIPPETS) {
            if (!snippet.prefix.toLowerCase().startsWith(word)) continue;
            if (snippet.languages && !snippet.languages.includes(lang)) continue;

            items.push({
                label: snippet.prefix,
                kind: "snippet",
                insertText: snippet.body.replace(/\$\d/g, ""),
                detail: snippet.description,
                documentation: snippet.body,
                sortOrder: 0,
            });
        }

        return items.slice(0, 20);
    }
}

export function createSnippetManagerPlugin(): ExtendedEditorPlugin {
    return {
        id: "snippet-manager",
        name: "Snippet Manager",
        version: "1.0.0",
        description: "Built-in code snippets for common patterns",
        category: "tools",
        defaultEnabled: true,
        completionProviders: [new SnippetCompletionProvider()],
    };
}
