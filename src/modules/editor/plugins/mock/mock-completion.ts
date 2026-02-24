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

    // ── Shell / DevOps commands ───────────────────────────
    // Docker
    { label: "docker",            kind: "keyword", insertText: "docker ",                     detail: "Container runtime",       sortOrder: 1 },
    { label: "docker-compose",    kind: "keyword", insertText: "docker-compose ",              detail: "Multi-container Docker",  sortOrder: 1 },
    { label: "docker run",        kind: "snippet", insertText: "docker run -d --name ${name} -p ${host}:${container} ${image}", detail: "Run container", sortOrder: 4 },
    { label: "docker build",      kind: "snippet", insertText: "docker build -t ${tag} .",     detail: "Build image",             sortOrder: 4 },
    { label: "docker exec",       kind: "snippet", insertText: "docker exec -it ${container} /bin/bash", detail: "Exec into container", sortOrder: 4 },
    { label: "docker compose up", kind: "snippet", insertText: "docker compose up -d --build", detail: "Start services",          sortOrder: 4 },

    // Nginx
    { label: "nginx",             kind: "keyword", insertText: "nginx ",                       detail: "Web server / reverse proxy", sortOrder: 1 },
    { label: "nginx -t",          kind: "snippet", insertText: "nginx -t && nginx -s reload",  detail: "Test & reload nginx",     sortOrder: 4 },

    // Caddy
    { label: "caddy",             kind: "keyword", insertText: "caddy ",                       detail: "Web server with auto HTTPS", sortOrder: 1 },
    { label: "caddy reverse-proxy", kind: "snippet", insertText: "caddy reverse-proxy --from :${from} --to :${to}", detail: "Quick reverse proxy", sortOrder: 4 },

    // Apache
    { label: "apachectl",         kind: "keyword", insertText: "apachectl ",                   detail: "Apache HTTP server control", sortOrder: 1 },

    // PM2
    { label: "pm2",               kind: "keyword", insertText: "pm2 ",                         detail: "Node.js process manager", sortOrder: 1 },
    { label: "pm2 start",         kind: "snippet", insertText: "pm2 start ${file} --name ${name}", detail: "Start process",        sortOrder: 4 },
    { label: "pm2 ecosystem",     kind: "snippet", insertText: "pm2 ecosystem",                detail: "Generate ecosystem file", sortOrder: 4 },
    { label: "pm2 logs",          kind: "snippet", insertText: "pm2 logs ${name} --lines 100", detail: "View process logs",       sortOrder: 4 },

    // Node.js / Bun / npm / pnpm / yarn
    { label: "node",              kind: "keyword", insertText: "node ",                        detail: "Node.js runtime",         sortOrder: 1 },
    { label: "bun",               kind: "keyword", insertText: "bun ",                         detail: "Bun JavaScript runtime",  sortOrder: 1 },
    { label: "npm",               kind: "keyword", insertText: "npm ",                         detail: "Node package manager",    sortOrder: 1 },
    { label: "npx",               kind: "keyword", insertText: "npx ",                         detail: "Execute npm package bin", sortOrder: 1 },
    { label: "pnpm",              kind: "keyword", insertText: "pnpm ",                        detail: "Fast package manager",    sortOrder: 1 },
    { label: "yarn",              kind: "keyword", insertText: "yarn ",                        detail: "Yarn package manager",    sortOrder: 1 },

    // Git
    { label: "git",               kind: "keyword", insertText: "git ",                         detail: "Version control",         sortOrder: 1 },
    { label: "git commit",        kind: "snippet", insertText: "git commit -m \"${message}\"",   detail: "Commit with message",     sortOrder: 4 },
    { label: "git push origin",   kind: "snippet", insertText: "git push origin ${branch}",    detail: "Push to remote",          sortOrder: 4 },

    // Linux system
    { label: "systemctl",         kind: "keyword", insertText: "systemctl ",                   detail: "Systemd service manager", sortOrder: 1 },
    { label: "journalctl",        kind: "keyword", insertText: "journalctl ",                  detail: "Systemd log viewer",      sortOrder: 1 },
    { label: "apt",               kind: "keyword", insertText: "apt ",                         detail: "Debian package manager",  sortOrder: 1 },
    { label: "yum",               kind: "keyword", insertText: "yum ",                         detail: "RHEL package manager",    sortOrder: 1 },
    { label: "ufw",               kind: "keyword", insertText: "ufw ",                         detail: "Uncomplicated firewall",  sortOrder: 1 },

    // Network / transfer
    { label: "curl",              kind: "keyword", insertText: "curl ",                        detail: "HTTP client",             sortOrder: 1 },
    { label: "wget",              kind: "keyword", insertText: "wget ",                        detail: "File downloader",         sortOrder: 1 },
    { label: "ssh",               kind: "keyword", insertText: "ssh ",                         detail: "Secure shell",            sortOrder: 1 },
    { label: "scp",               kind: "keyword", insertText: "scp ",                         detail: "Secure copy",             sortOrder: 1 },
    { label: "certbot",           kind: "keyword", insertText: "certbot ",                     detail: "Let's Encrypt client",    sortOrder: 1 },
    { label: "curl POST",         kind: "snippet", insertText: "curl -X POST -H \"Content-Type: application/json\" -d '${body}' ${url}", detail: "POST request", sortOrder: 4 },

    // File system
    { label: "ls",                kind: "keyword", insertText: "ls ",                          detail: "List directory",           sortOrder: 1 },
    { label: "cp",                kind: "keyword", insertText: "cp ",                          detail: "Copy files",              sortOrder: 1 },
    { label: "mv",                kind: "keyword", insertText: "mv ",                          detail: "Move/rename files",       sortOrder: 1 },
    { label: "rm",                kind: "keyword", insertText: "rm ",                          detail: "Remove files",            sortOrder: 1 },
    { label: "mkdir",             kind: "keyword", insertText: "mkdir ",                       detail: "Create directory",         sortOrder: 1 },
    { label: "chmod",             kind: "keyword", insertText: "chmod ",                       detail: "Change permissions",       sortOrder: 1 },
    { label: "chown",             kind: "keyword", insertText: "chown ",                       detail: "Change ownership",         sortOrder: 1 },
    { label: "find",              kind: "keyword", insertText: "find ",                        detail: "Find files",              sortOrder: 1 },
    { label: "grep",              kind: "keyword", insertText: "grep ",                        detail: "Search text patterns",    sortOrder: 1 },
    { label: "sed",               kind: "keyword", insertText: "sed ",                         detail: "Stream editor",            sortOrder: 1 },
    { label: "awk",               kind: "keyword", insertText: "awk ",                         detail: "Text processing",          sortOrder: 1 },
    { label: "tar",               kind: "keyword", insertText: "tar ",                         detail: "Archive utility",          sortOrder: 1 },
    { label: "cat",               kind: "keyword", insertText: "cat ",                         detail: "Concatenate files",        sortOrder: 1 },
    { label: "head",              kind: "keyword", insertText: "head ",                        detail: "Output first lines",       sortOrder: 1 },
    { label: "tail",              kind: "keyword", insertText: "tail ",                        detail: "Output last lines",        sortOrder: 1 },
    { label: "tail -f",           kind: "snippet", insertText: "tail -f ${file}",              detail: "Follow file output",       sortOrder: 4 },
    { label: "wc",                kind: "keyword", insertText: "wc ",                          detail: "Word/line/byte count",     sortOrder: 1 },
    { label: "which",             kind: "keyword", insertText: "which ",                       detail: "Locate a command",         sortOrder: 1 },
    { label: "df",                kind: "keyword", insertText: "df -h",                        detail: "Disk free space",          sortOrder: 1 },
    { label: "du",                kind: "keyword", insertText: "du -sh ",                      detail: "Disk usage",               sortOrder: 1 },
    { label: "free",              kind: "keyword", insertText: "free -h",                      detail: "Memory usage",             sortOrder: 1 },

    // Process
    { label: "ps",                kind: "keyword", insertText: "ps ",                          detail: "List processes",           sortOrder: 1 },
    { label: "kill",              kind: "keyword", insertText: "kill ",                        detail: "Send signal to process",   sortOrder: 1 },
    { label: "htop",              kind: "keyword", insertText: "htop",                         detail: "Interactive process viewer", sortOrder: 1 },
    { label: "top",               kind: "keyword", insertText: "top",                          detail: "Process monitor",          sortOrder: 1 },
    { label: "sudo",              kind: "keyword", insertText: "sudo ",                        detail: "Execute as superuser",     sortOrder: 0 },

    // Python
    { label: "python",            kind: "keyword", insertText: "python ",                      detail: "Python interpreter",       sortOrder: 1 },
    { label: "python3",           kind: "keyword", insertText: "python3 ",                     detail: "Python 3 interpreter",     sortOrder: 1 },
    { label: "pip",               kind: "keyword", insertText: "pip ",                         detail: "Python package manager",   sortOrder: 1 },
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
