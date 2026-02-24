/**
 * @module editor/core/snippets
 * Basic snippet expansion engine.
 *
 * Type a trigger word and press Tab to expand it into a code snippet.
 * Supports per-language snippet definitions with cursor placeholders ($0).
 *
 * Usage by the editor:
 *   - On Tab keypress, check if the word before cursor matches a snippet trigger
 *   - If matched, replace the trigger with the snippet body
 *   - Position cursor at $0 placeholder (or end of snippet)
 */

export interface Snippet {
    /** Trigger text (prefix) */
    trigger: string;
    /** Display label */
    label: string;
    /** Snippet body (use $0 for cursor position) */
    body: string;
    /** Optional description */
    description?: string;
}

/** Built-in snippets organized by language/extension */
const SNIPPETS: Record<string, Snippet[]> = {
    // JavaScript / TypeScript
    javascript: [
        { trigger: "clg", label: "console.log", body: "console.log($0);", description: "Log to console" },
        { trigger: "cle", label: "console.error", body: "console.error($0);", description: "Error to console" },
        { trigger: "fn", label: "Function", body: "function $0() {\n  \n}", description: "Function declaration" },
        { trigger: "afn", label: "Arrow function", body: "const $0 = () => {\n  \n};", description: "Arrow function" },
        { trigger: "iife", label: "IIFE", body: "(() => {\n  $0\n})();", description: "Immediately invoked function" },
        { trigger: "forof", label: "for...of", body: "for (const $0 of ) {\n  \n}", description: "For...of loop" },
        { trigger: "forin", label: "for...in", body: "for (const $0 in ) {\n  \n}", description: "For...in loop" },
        { trigger: "trycatch", label: "try/catch", body: "try {\n  $0\n} catch (error) {\n  console.error(error);\n}", description: "Try/catch block" },
        { trigger: "imp", label: "import", body: "import { $0 } from '';", description: "Import statement" },
        { trigger: "exp", label: "export", body: "export $0", description: "Export statement" },
        { trigger: "ternary", label: "Ternary", body: "$0 ? : ", description: "Ternary expression" },
        { trigger: "prom", label: "Promise", body: "new Promise((resolve, reject) => {\n  $0\n});", description: "New Promise" },
        { trigger: "asyncfn", label: "Async function", body: "async function $0() {\n  \n}", description: "Async function" },
    ],
    typescript: [], // will inherit from javascript
    jsx: [],
    tsx: [],

    // React
    react: [
        { trigger: "rfc", label: "React FC", body: "export function $0() {\n  return (\n    <div>\n      \n    </div>\n  );\n}", description: "React functional component" },
        { trigger: "ustate", label: "useState", body: "const [$0, set] = useState();", description: "React useState" },
        { trigger: "ueffect", label: "useEffect", body: "useEffect(() => {\n  $0\n}, []);", description: "React useEffect" },
        { trigger: "uref", label: "useRef", body: "const $0 = useRef(null);", description: "React useRef" },
        { trigger: "umemo", label: "useMemo", body: "const $0 = useMemo(() => {\n  \n}, []);", description: "React useMemo" },
        { trigger: "ucallback", label: "useCallback", body: "const $0 = useCallback(() => {\n  \n}, []);", description: "React useCallback" },
    ],

    // Python
    python: [
        { trigger: "def", label: "Function", body: "def $0():\n    pass", description: "Function definition" },
        { trigger: "cls", label: "Class", body: "class $0:\n    def __init__(self):\n        pass", description: "Class definition" },
        { trigger: "ifmain", label: "if __main__", body: 'if __name__ == "__main__":\n    $0', description: "Main guard" },
        { trigger: "trycatch", label: "try/except", body: "try:\n    $0\nexcept Exception as e:\n    print(e)", description: "Try/except block" },
        { trigger: "with", label: "with statement", body: "with $0 as f:\n    pass", description: "With statement" },
        { trigger: "fori", label: "for i in range", body: "for i in range($0):\n    pass", description: "For loop with range" },
        { trigger: "lcomp", label: "List comprehension", body: "[$0 for x in ]", description: "List comprehension" },
        { trigger: "imp", label: "import", body: "import $0", description: "Import" },
        { trigger: "from", label: "from import", body: "from $0 import ", description: "From import" },
    ],

    // Go
    go: [
        { trigger: "func", label: "Function", body: "func $0() {\n\t\n}", description: "Function declaration" },
        { trigger: "main", label: "main func", body: "func main() {\n\t$0\n}", description: "Main function" },
        { trigger: "iferr", label: "if err", body: "if err != nil {\n\t$0\n}", description: "Error check" },
        { trigger: "fori", label: "for i", body: "for i := 0; i < $0; i++ {\n\t\n}", description: "For loop" },
        { trigger: "forr", label: "for range", body: "for _, $0 := range  {\n\t\n}", description: "For range" },
        { trigger: "struct", label: "struct", body: "type $0 struct {\n\t\n}", description: "Struct definition" },
    ],

    // Rust
    rust: [
        { trigger: "fn", label: "Function", body: "fn $0() {\n    \n}", description: "Function declaration" },
        { trigger: "pfn", label: "Public function", body: "pub fn $0() {\n    \n}", description: "Public function" },
        { trigger: "impl", label: "Implementation", body: "impl $0 {\n    \n}", description: "Impl block" },
        { trigger: "matchs", label: "match", body: "match $0 {\n    _ => {},\n}", description: "Match expression" },
        { trigger: "struct", label: "struct", body: "struct $0 {\n    \n}", description: "Struct definition" },
    ],

    // HTML
    markup: [
        { trigger: "html5", label: "HTML5 template", body: '<!DOCTYPE html>\n<html lang="en">\n<head>\n    <meta charset="UTF-8">\n    <meta name="viewport" content="width=device-width, initial-scale=1.0">\n    <title>$0</title>\n</head>\n<body>\n    \n</body>\n</html>', description: "HTML5 boilerplate" },
        { trigger: "div", label: "div", body: "<div>\n    $0\n</div>", description: "Div element" },
        { trigger: "link", label: "stylesheet link", body: '<link rel="stylesheet" href="$0">', description: "Stylesheet link" },
        { trigger: "script", label: "script tag", body: '<script src="$0"></script>', description: "Script tag" },
    ],

    // Shell
    bash: [
        { trigger: "shebang", label: "Shebang", body: "#!/bin/bash\n$0", description: "Bash shebang" },
        { trigger: "iff", label: "if statement", body: 'if [ "$0" ]; then\n    \nfi', description: "If statement" },
        { trigger: "forr", label: "for loop", body: "for $0 in ; do\n    \ndone", description: "For loop" },
        { trigger: "func", label: "function", body: "$0() {\n    \n}", description: "Function definition" },
    ],

    // SQL
    sql: [
        { trigger: "sel", label: "SELECT", body: "SELECT $0\nFROM \nWHERE ;", description: "Select statement" },
        { trigger: "ins", label: "INSERT", body: "INSERT INTO $0 ()\nVALUES ();", description: "Insert statement" },
        { trigger: "upd", label: "UPDATE", body: "UPDATE $0\nSET \nWHERE ;", description: "Update statement" },
        { trigger: "crt", label: "CREATE TABLE", body: "CREATE TABLE $0 (\n    id SERIAL PRIMARY KEY,\n    \n);", description: "Create table" },
    ],

    // JSON
    json: [
        { trigger: "obj", label: "Object", body: '{\n  "$0": \n}', description: "JSON object" },
        { trigger: "arr", label: "Array", body: '[\n  $0\n]', description: "JSON array" },
    ],

    // CSS
    css: [
        { trigger: "flex", label: "Flex container", body: "display: flex;\nalign-items: $0;\njustify-content: ;", description: "Flexbox" },
        { trigger: "grid", label: "Grid container", body: "display: grid;\ngrid-template-columns: $0;\ngap: ;", description: "CSS Grid" },
        { trigger: "media", label: "Media query", body: "@media (max-width: $0px) {\n  \n}", description: "Media query" },
    ],

    // YAML
    yaml: [
        { trigger: "svc", label: "K8s Service", body: "apiVersion: v1\nkind: Service\nmetadata:\n  name: $0\nspec:\n  selector:\n    app: \n  ports:\n    - port: 80\n      targetPort: 8080", description: "Kubernetes Service" },
    ],

    // Dockerfile
    docker: [
        { trigger: "from", label: "FROM", body: "FROM $0\nWORKDIR /app\nCOPY . .\nRUN \nCMD []", description: "Dockerfile template" },
    ],
};

// Inherit JavaScript snippets for TS/JSX/TSX
SNIPPETS.typescript = [...(SNIPPETS.javascript ?? [])];
SNIPPETS.jsx = [...(SNIPPETS.javascript ?? []), ...(SNIPPETS.react ?? [])];
SNIPPETS.tsx = [...(SNIPPETS.javascript ?? []), ...(SNIPPETS.react ?? [])];

/**
 * Custom snippet registry allows plugins/users to add snippets at runtime.
 */
const customSnippets: Map<string, Snippet[]> = new Map();

export class SnippetEngine {
    /**
     * Register custom snippets for a language.
     */
    static register(language: string, snippets: Snippet[]): void {
        const existing = customSnippets.get(language) ?? [];
        customSnippets.set(language, [...existing, ...snippets]);
    }

    /**
     * Get all snippets for a given Prism language.
     */
    static getSnippets(prismLang: string | null): Snippet[] {
        if (!prismLang) return [];
        const builtIn = SNIPPETS[prismLang] ?? [];
        const custom = customSnippets.get(prismLang) ?? [];
        return [...builtIn, ...custom];
    }

    /**
     * Try to expand a snippet at the current cursor position.
     * Returns the expansion result or null if no matching snippet.
     */
    static tryExpand(
        content: string,
        cursorPos: number,
        prismLang: string | null,
    ): { newContent: string; cursorPos: number } | null {
        const snippets = this.getSnippets(prismLang);
        if (snippets.length === 0) return null;

        // Extract word before cursor (alphanumeric/underscore)
        let wordStart = cursorPos;
        while (wordStart > 0 && /[\w]/.test(content[wordStart - 1])) {
            wordStart--;
        }
        const word = content.substring(wordStart, cursorPos);
        if (!word) return null;

        // Find matching snippet
        const snippet = snippets.find((s) => s.trigger === word);
        if (!snippet) return null;

        // Determine indentation of current line
        const lineStart = content.lastIndexOf("\n", wordStart - 1) + 1;
        const lineText = content.substring(lineStart, wordStart);
        const indent = lineText.match(/^(\s*)/)?.[1] ?? "";

        // Expand snippet body with indentation
        let body = snippet.body;
        // Indent all lines after the first
        body = body
            .split("\n")
            .map((line, i) => (i === 0 ? line : indent + line))
            .join("\n");

        // Find $0 cursor placeholder
        const placeholderIdx = body.indexOf("$0");
        let newCursorPos: number;

        if (placeholderIdx >= 0) {
            body = body.replace("$0", "");
            newCursorPos = wordStart + placeholderIdx;
        } else {
            newCursorPos = wordStart + body.length;
        }

        const newContent =
            content.substring(0, wordStart) + body + content.substring(cursorPos);

        return { newContent, cursorPos: newCursorPos };
    }
}
