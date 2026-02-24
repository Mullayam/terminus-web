/**
 * @module editor/plugins/mock/mock-completion
 *
 * Mock Completion Plugin.
 *
 * Provides a CompletionProvider that returns canned autocomplete items
 * based on the word before the cursor. No backend or AI service required.
 *
 * Demonstrates:
 *   - `completionProviders` array on an ExtendedEditorPlugin
 *   - CompletionProvider.provideCompletions(context)
 *   - Trigger characters
 *   - Different CompletionItem kinds (keyword, function, variable, snippet, etc.)
 *
 * Usage:
 * ```ts
 * import { createMockCompletionPlugin } from "./plugins/mock";
 * <FileEditor plugins={[createMockCompletionPlugin()]} … />
 * ```
 */
import type {
    ExtendedEditorPlugin,
    CompletionProvider,
    CompletionItem,
    CompletionContext,
} from "../types";

// ── Canned completion items ──────────────────────────────────

const MOCK_COMPLETIONS: CompletionItem[] = [
    // Keywords
    { label: "async",       kind: "keyword",  insertText: "async ",      detail: "keyword",        sortOrder: 0 },
    { label: "await",       kind: "keyword",  insertText: "await ",      detail: "keyword",        sortOrder: 0 },
    { label: "export",      kind: "keyword",  insertText: "export ",     detail: "keyword",        sortOrder: 0 },
    { label: "import",      kind: "keyword",  insertText: "import ",     detail: "keyword",        sortOrder: 0 },
    { label: "interface",   kind: "keyword",  insertText: "interface ",  detail: "keyword",        sortOrder: 0 },
    { label: "return",      kind: "keyword",  insertText: "return ",     detail: "keyword",        sortOrder: 0 },
    { label: "type",        kind: "keyword",  insertText: "type ",       detail: "keyword",        sortOrder: 0 },

    // Functions
    { label: "useState",        kind: "function", insertText: "useState()",        detail: "React Hook",        sortOrder: 1 },
    { label: "useEffect",       kind: "function", insertText: "useEffect(() => {\n  \n}, []);", detail: "React Hook", sortOrder: 1 },
    { label: "useCallback",     kind: "function", insertText: "useCallback(() => {\n  \n}, []);", detail: "React Hook", sortOrder: 1 },
    { label: "useMemo",         kind: "function", insertText: "useMemo(() => {\n  \n}, []);", detail: "React Hook", sortOrder: 1 },
    { label: "useRef",          kind: "function", insertText: "useRef(null)",      detail: "React Hook",        sortOrder: 1 },
    { label: "console.log",     kind: "function", insertText: "console.log()",     detail: "Log to console",    sortOrder: 2 },
    { label: "console.error",   kind: "function", insertText: "console.error()",   detail: "Log error",         sortOrder: 2 },
    { label: "JSON.parse",      kind: "function", insertText: "JSON.parse()",      detail: "Parse JSON string", sortOrder: 2 },
    { label: "JSON.stringify",  kind: "function", insertText: "JSON.stringify()",  detail: "Stringify to JSON",  sortOrder: 2 },

    // Variables
    { label: "document",    kind: "variable", insertText: "document",    detail: "DOM Document",  sortOrder: 3 },
    { label: "window",      kind: "variable", insertText: "window",      detail: "Window object", sortOrder: 3 },
    { label: "process",     kind: "variable", insertText: "process",     detail: "Node.js",       sortOrder: 3 },

    // Snippets
    {
        label: "fn→",
        kind: "snippet",
        insertText: "function ${name}(${params}) {\n  ${body}\n}",
        detail: "Function declaration",
        sortOrder: 4,
    },
    {
        label: "cl→",
        kind: "snippet",
        insertText: "class ${Name} {\n  constructor() {\n    \n  }\n}",
        detail: "Class declaration",
        sortOrder: 4,
    },
    {
        label: "iface→",
        kind: "snippet",
        insertText: "interface ${Name} {\n  \n}",
        detail: "Interface declaration",
        sortOrder: 4,
    },
    {
        label: "try→",
        kind: "snippet",
        insertText: "try {\n  \n} catch (err) {\n  console.error(err);\n}",
        detail: "Try/Catch block",
        sortOrder: 4,
    },
    {
        label: "fetch→",
        kind: "snippet",
        insertText: "const response = await fetch(url, {\n  method: \"POST\",\n  headers: { \"Content-Type\": \"application/json\" },\n  body: JSON.stringify(data),\n});",
        detail: "Fetch POST request",
        sortOrder: 4,
    },

    // Properties
    { label: "length",     kind: "property", insertText: "length",     detail: "Array / string length", sortOrder: 5 },
    { label: "prototype",  kind: "property", insertText: "prototype",  detail: "Object prototype",      sortOrder: 5 },

    // Methods
    { label: "map",        kind: "method",   insertText: "map((item) => )",                  detail: "Array.map()",    sortOrder: 5 },
    { label: "filter",     kind: "method",   insertText: "filter((item) => )",               detail: "Array.filter()", sortOrder: 5 },
    { label: "reduce",     kind: "method",   insertText: "reduce((acc, item) => acc, init)", detail: "Array.reduce()", sortOrder: 5 },
    { label: "forEach",    kind: "method",   insertText: "forEach((item) => )",              detail: "Array.forEach()",sortOrder: 5 },
    { label: "includes",   kind: "method",   insertText: "includes()",                       detail: "Array/String",   sortOrder: 5 },
    { label: "toString",   kind: "method",   insertText: "toString()",                       detail: "Object",         sortOrder: 6 },

    // Classes / modules
    { label: "EventEmitter",  kind: "class",  insertText: "EventEmitter",  detail: "Node.js events", sortOrder: 6 },
    { label: "Promise",       kind: "class",  insertText: "Promise",       detail: "ES6 Promise",    sortOrder: 6 },
    { label: "Map",           kind: "class",  insertText: "Map",           detail: "ES6 Map",        sortOrder: 6 },
    { label: "Set",           kind: "class",  insertText: "Set",           detail: "ES6 Set",        sortOrder: 6 },

    // AI-flavored
    { label: "ai:explain",   kind: "ai", insertText: "// AI: explain this code\n",  detail: "AI annotation", sortOrder: 7 },
    { label: "ai:refactor",  kind: "ai", insertText: "// AI: refactor this block\n", detail: "AI annotation", sortOrder: 7 },
    { label: "ai:test",      kind: "ai", insertText: "// AI: generate tests\n",      detail: "AI annotation", sortOrder: 7 },
];

// ── Mock provider implementation ─────────────────────────────

class MockCompletionProvider implements CompletionProvider {
    id = "mock-completion:provider";
    triggerCharacters = [".", "/", "@"];

    provideCompletions(ctx: CompletionContext): CompletionItem[] {
        const word = ctx.wordBeforeCursor.toLowerCase();
        if (word.length < 1) return [];

        return MOCK_COMPLETIONS.filter(
            (item) => item.label.toLowerCase().startsWith(word) && item.label.toLowerCase() !== word,
        ).slice(0, 20);
    }
}

// ═══════════════════════════════════════════════════════════════
//  PLUGIN FACTORY
// ═══════════════════════════════════════════════════════════════

export function createMockCompletionPlugin(): ExtendedEditorPlugin {
    return {
        id: "mock-completion",
        name: "Mock Completion",
        version: "1.0.0",
        description: "Canned autocomplete suggestions for testing (no backend required)",
        category: "editor",
        defaultEnabled: true,

        completionProviders: [new MockCompletionProvider()],

        onActivate(api) {
            api.showToast("Mock Completion", "Plugin activated – start typing to see completions", "default");
        },
    };
}
