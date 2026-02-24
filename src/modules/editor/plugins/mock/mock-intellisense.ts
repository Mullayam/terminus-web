/**
 * @module editor/plugins/mock/mock-intellisense
 *
 * Mock IntelliSense Plugin.
 *
 * Simulates smart, context-aware completions including:
 *   - Property access after "." (e.g. `console.` → log, error, warn …)
 *   - Import path suggestions after quotes
 *   - Symbol-aware completions extracted from the current document
 *   - Diagnostics (mock lint warnings / errors) on content change
 *
 * Demonstrates:
 *   - CompletionProvider with trigger characters
 *   - `onContentChange` for diagnostics
 *   - `setDiagnostics` / `clearDiagnostics`
 *   - Inline annotations for type hints
 *
 * Usage:
 * ```ts
 * import { createMockIntelliSensePlugin } from "./plugins/mock";
 * <FileEditor plugins={[createMockIntelliSensePlugin()]} … />
 * ```
 */
import type {
    ExtendedEditorPlugin,
    ExtendedPluginAPI,
    CompletionProvider,
    CompletionItem,
    CompletionContext,
    Diagnostic,
    InlineAnnotation,
} from "../types";

// ── Mock property databases ──────────────────────────────────

const PROPERTY_DB: Record<string, Array<{ name: string; detail: string; kind: CompletionItem["kind"] }>> = {
    console: [
        { name: "log",       detail: "(...args: any[]) => void",      kind: "method" },
        { name: "error",     detail: "(...args: any[]) => void",      kind: "method" },
        { name: "warn",      detail: "(...args: any[]) => void",      kind: "method" },
        { name: "info",      detail: "(...args: any[]) => void",      kind: "method" },
        { name: "debug",     detail: "(...args: any[]) => void",      kind: "method" },
        { name: "table",     detail: "(data: any) => void",           kind: "method" },
        { name: "clear",     detail: "() => void",                    kind: "method" },
        { name: "time",      detail: "(label?: string) => void",      kind: "method" },
        { name: "timeEnd",   detail: "(label?: string) => void",      kind: "method" },
    ],
    Math: [
        { name: "abs",       detail: "(x: number) => number",         kind: "method" },
        { name: "ceil",      detail: "(x: number) => number",         kind: "method" },
        { name: "floor",     detail: "(x: number) => number",         kind: "method" },
        { name: "max",       detail: "(...values: number[]) => number", kind: "method" },
        { name: "min",       detail: "(...values: number[]) => number", kind: "method" },
        { name: "random",    detail: "() => number",                   kind: "method" },
        { name: "round",     detail: "(x: number) => number",         kind: "method" },
        { name: "PI",        detail: "3.141592653589793",              kind: "property" },
        { name: "E",         detail: "2.718281828459045",              kind: "property" },
    ],
    document: [
        { name: "getElementById",    detail: "(id: string) => Element | null",     kind: "method" },
        { name: "querySelector",     detail: "(sel: string) => Element | null",    kind: "method" },
        { name: "querySelectorAll",  detail: "(sel: string) => NodeListOf<Element>", kind: "method" },
        { name: "createElement",     detail: "(tag: string) => HTMLElement",       kind: "method" },
        { name: "body",              detail: "HTMLBodyElement",                    kind: "property" },
        { name: "title",             detail: "string",                             kind: "property" },
        { name: "addEventListener",  detail: "(type: string, fn: Function) => void", kind: "method" },
    ],
    window: [
        { name: "innerWidth",   detail: "number",                          kind: "property" },
        { name: "innerHeight",  detail: "number",                          kind: "property" },
        { name: "location",     detail: "Location",                        kind: "property" },
        { name: "localStorage", detail: "Storage",                         kind: "property" },
        { name: "setTimeout",   detail: "(fn: Function, ms: number) => number", kind: "method" },
        { name: "setInterval",  detail: "(fn: Function, ms: number) => number", kind: "method" },
        { name: "fetch",        detail: "(url: string, init?: RequestInit) => Promise<Response>", kind: "method" },
        { name: "addEventListener", detail: "(type: string, fn: Function) => void", kind: "method" },
    ],
    JSON: [
        { name: "parse",     detail: "(text: string) => any",             kind: "method" },
        { name: "stringify",  detail: "(value: any) => string",           kind: "method" },
    ],
    Object: [
        { name: "keys",      detail: "(obj: object) => string[]",         kind: "method" },
        { name: "values",    detail: "(obj: object) => any[]",            kind: "method" },
        { name: "entries",   detail: "(obj: object) => [string, any][]",  kind: "method" },
        { name: "assign",    detail: "(target: object, ...sources: object[]) => object", kind: "method" },
        { name: "freeze",    detail: "(obj: object) => Readonly<object>", kind: "method" },
    ],
    Array: [
        { name: "isArray",   detail: "(arg: any) => boolean",             kind: "method" },
        { name: "from",      detail: "(iterable: Iterable) => any[]",     kind: "method" },
        { name: "of",        detail: "(...items: any[]) => any[]",        kind: "method" },
    ],
    Promise: [
        { name: "all",       detail: "(promises: Promise[]) => Promise",  kind: "method" },
        { name: "race",      detail: "(promises: Promise[]) => Promise",  kind: "method" },
        { name: "resolve",   detail: "(value?: any) => Promise",          kind: "method" },
        { name: "reject",    detail: "(reason?: any) => Promise",         kind: "method" },
        { name: "allSettled", detail: "(promises: Promise[]) => Promise", kind: "method" },
    ],
};

// ── Shell / DevOps subcommand databases ─────────────────────
// Maps CLI tool names → subcommands & common flags.
// Used for space-triggered completions (e.g. "docker " → run, build …)

const SHELL_COMMAND_DB: Record<string, Array<{ name: string; detail: string; kind: CompletionItem["kind"] }>> = {
    // ── Docker ────────────────────────────────────────────
    docker: [
        { name: "run",         detail: "Run a command in a new container",            kind: "function" },
        { name: "build",       detail: "Build an image from a Dockerfile",            kind: "function" },
        { name: "pull",        detail: "Download an image from a registry",           kind: "function" },
        { name: "push",        detail: "Upload an image to a registry",              kind: "function" },
        { name: "ps",          detail: "List running containers",                     kind: "function" },
        { name: "images",      detail: "List images",                                 kind: "function" },
        { name: "exec",        detail: "Execute a command in a running container",   kind: "function" },
        { name: "stop",        detail: "Stop one or more running containers",        kind: "function" },
        { name: "start",       detail: "Start one or more stopped containers",       kind: "function" },
        { name: "restart",     detail: "Restart one or more containers",             kind: "function" },
        { name: "rm",          detail: "Remove one or more containers",              kind: "function" },
        { name: "rmi",         detail: "Remove one or more images",                  kind: "function" },
        { name: "logs",        detail: "Fetch the logs of a container",              kind: "function" },
        { name: "inspect",     detail: "Return low-level info on Docker objects",    kind: "function" },
        { name: "compose",     detail: "Docker Compose commands",                    kind: "function" },
        { name: "volume",      detail: "Manage volumes",                             kind: "function" },
        { name: "network",     detail: "Manage networks",                            kind: "function" },
        { name: "system",      detail: "Manage Docker system",                       kind: "function" },
        { name: "tag",         detail: "Tag an image",                               kind: "function" },
        { name: "cp",          detail: "Copy files between container and host",      kind: "function" },
        { name: "stats",       detail: "Display live resource usage statistics",     kind: "function" },
        { name: "top",         detail: "Display running processes of a container",   kind: "function" },
        { name: "login",       detail: "Log in to a registry",                       kind: "function" },
        { name: "logout",      detail: "Log out from a registry",                    kind: "function" },
        { name: "--help",      detail: "Show help",                                  kind: "keyword" },
        { name: "-d",          detail: "Detached mode",                              kind: "keyword" },
        { name: "-it",         detail: "Interactive + TTY",                          kind: "keyword" },
        { name: "-p",          detail: "Publish port(s)",                            kind: "keyword" },
        { name: "-v",          detail: "Bind mount a volume",                        kind: "keyword" },
        { name: "--name",      detail: "Assign a name to the container",             kind: "keyword" },
        { name: "--rm",        detail: "Remove container when it exits",             kind: "keyword" },
    ],
    "docker-compose": [
        { name: "up",          detail: "Create and start containers",                 kind: "function" },
        { name: "down",        detail: "Stop and remove containers",                 kind: "function" },
        { name: "build",       detail: "Build or rebuild services",                  kind: "function" },
        { name: "logs",        detail: "View output from containers",                kind: "function" },
        { name: "ps",          detail: "List containers",                            kind: "function" },
        { name: "restart",     detail: "Restart services",                           kind: "function" },
        { name: "exec",        detail: "Execute a command in a running container",   kind: "function" },
        { name: "pull",        detail: "Pull service images",                        kind: "function" },
        { name: "config",      detail: "Validate and view the Compose file",         kind: "function" },
        { name: "-d",          detail: "Detached mode",                              kind: "keyword" },
        { name: "-f",          detail: "Specify compose file",                       kind: "keyword" },
        { name: "--build",     detail: "Build images before starting",               kind: "keyword" },
    ],

    // ── Nginx ─────────────────────────────────────────────
    nginx: [
        { name: "-s",          detail: "Send signal: stop|quit|reload|reopen",       kind: "keyword" },
        { name: "-t",          detail: "Test configuration and exit",                kind: "keyword" },
        { name: "-T",          detail: "Test configuration, dump it and exit",       kind: "keyword" },
        { name: "-c",          detail: "Set configuration file path",                kind: "keyword" },
        { name: "-g",          detail: "Set global directives",                      kind: "keyword" },
        { name: "-p",          detail: "Set prefix path",                            kind: "keyword" },
        { name: "-v",          detail: "Show version",                               kind: "keyword" },
        { name: "-V",          detail: "Show version and configure options",         kind: "keyword" },
        { name: "reload",      detail: "Reload configuration (via -s)",              kind: "function" },
        { name: "stop",        detail: "Fast shutdown (via -s)",                     kind: "function" },
        { name: "quit",        detail: "Graceful shutdown (via -s)",                 kind: "function" },
    ],

    // ── Caddy ─────────────────────────────────────────────
    caddy: [
        { name: "run",         detail: "Start the Caddy server",                     kind: "function" },
        { name: "start",       detail: "Start Caddy in the background",              kind: "function" },
        { name: "stop",        detail: "Stop the running Caddy process",             kind: "function" },
        { name: "reload",      detail: "Reload the Caddy configuration",             kind: "function" },
        { name: "adapt",       detail: "Adapt a config to native JSON",              kind: "function" },
        { name: "reverse-proxy", detail: "Quick reverse proxy",                      kind: "function" },
        { name: "file-server", detail: "Quick static file server",                   kind: "function" },
        { name: "fmt",         detail: "Format a Caddyfile",                         kind: "function" },
        { name: "validate",    detail: "Validate a Caddyfile",                       kind: "function" },
        { name: "trust",       detail: "Install root certificate into OS trust store", kind: "function" },
        { name: "version",     detail: "Print the Caddy version",                   kind: "function" },
        { name: "environ",     detail: "Print the environment",                     kind: "function" },
    ],

    // ── Apache (httpd / apachectl) ────────────────────────
    apachectl: [
        { name: "start",       detail: "Start Apache httpd",                         kind: "function" },
        { name: "stop",        detail: "Stop Apache httpd",                          kind: "function" },
        { name: "restart",     detail: "Restart Apache httpd",                       kind: "function" },
        { name: "graceful",    detail: "Graceful restart",                           kind: "function" },
        { name: "graceful-stop", detail: "Graceful stop",                            kind: "function" },
        { name: "configtest",  detail: "Test the configuration",                     kind: "function" },
        { name: "status",      detail: "Show server status",                         kind: "function" },
        { name: "fullstatus",  detail: "Show full server status",                    kind: "function" },
    ],

    // ── PM2 ───────────────────────────────────────────────
    pm2: [
        { name: "start",       detail: "Start a process",                            kind: "function" },
        { name: "stop",        detail: "Stop a process",                             kind: "function" },
        { name: "restart",     detail: "Restart a process",                          kind: "function" },
        { name: "reload",      detail: "Reload a process (0-downtime)",              kind: "function" },
        { name: "delete",      detail: "Delete a process from PM2 list",             kind: "function" },
        { name: "list",        detail: "List all running processes",                 kind: "function" },
        { name: "ls",          detail: "Alias for list",                             kind: "function" },
        { name: "status",      detail: "Alias for list",                             kind: "function" },
        { name: "logs",        detail: "Display logs",                               kind: "function" },
        { name: "monit",       detail: "Open the monitoring dashboard",              kind: "function" },
        { name: "plus",        detail: "Enable PM2 Plus monitoring",                 kind: "function" },
        { name: "startup",     detail: "Generate startup script",                    kind: "function" },
        { name: "unstartup",   detail: "Remove startup script",                      kind: "function" },
        { name: "save",        detail: "Save the current process list",              kind: "function" },
        { name: "resurrect",   detail: "Restore previously saved process list",      kind: "function" },
        { name: "ecosystem",   detail: "Generate ecosystem.config.js",               kind: "function" },
        { name: "flush",       detail: "Flush all log files",                        kind: "function" },
        { name: "describe",    detail: "Describe process details",                   kind: "function" },
        { name: "env",         detail: "Display process environment",                kind: "function" },
        { name: "--name",      detail: "Set process name",                           kind: "keyword" },
        { name: "-i",          detail: "Number of instances (cluster mode)",         kind: "keyword" },
        { name: "--watch",     detail: "Watch for file changes",                     kind: "keyword" },
    ],

    // ── Node.js ───────────────────────────────────────────
    node: [
        { name: "-e",          detail: "Evaluate script",                            kind: "keyword" },
        { name: "-p",          detail: "Evaluate + print result",                    kind: "keyword" },
        { name: "--inspect",   detail: "Enable inspector agent",                     kind: "keyword" },
        { name: "--inspect-brk", detail: "Enable inspector + break on start",        kind: "keyword" },
        { name: "--watch",     detail: "Run in watch mode (restarts on changes)",    kind: "keyword" },
        { name: "--env-file",  detail: "Load environment from .env file",            kind: "keyword" },
        { name: "--experimental-modules", detail: "Enable ESM support",              kind: "keyword" },
        { name: "--max-old-space-size", detail: "Set V8 max heap size (MB)",         kind: "keyword" },
        { name: "--version",   detail: "Print Node.js version",                      kind: "keyword" },
    ],

    // ── NPM ───────────────────────────────────────────────
    npm: [
        { name: "install",     detail: "Install packages",                           kind: "function" },
        { name: "i",           detail: "Alias for install",                          kind: "function" },
        { name: "uninstall",   detail: "Remove a package",                           kind: "function" },
        { name: "run",         detail: "Run a script from package.json",             kind: "function" },
        { name: "start",       detail: "Run the start script",                       kind: "function" },
        { name: "test",        detail: "Run the test script",                        kind: "function" },
        { name: "build",       detail: "Run the build script",                       kind: "function" },
        { name: "init",        detail: "Initialize a new package.json",              kind: "function" },
        { name: "publish",     detail: "Publish a package to registry",              kind: "function" },
        { name: "update",      detail: "Update packages",                            kind: "function" },
        { name: "outdated",    detail: "Check for outdated packages",                kind: "function" },
        { name: "ls",          detail: "List installed packages",                    kind: "function" },
        { name: "audit",       detail: "Run a security audit",                       kind: "function" },
        { name: "cache",       detail: "Manipulate packages cache",                  kind: "function" },
        { name: "ci",          detail: "Clean install from lockfile",                kind: "function" },
        { name: "link",        detail: "Symlink a package folder",                   kind: "function" },
        { name: "pack",        detail: "Create a tarball from a package",             kind: "function" },
        { name: "--save-dev",  detail: "Save as devDependency",                      kind: "keyword" },
        { name: "-D",          detail: "Alias for --save-dev",                       kind: "keyword" },
        { name: "-g",          detail: "Global install",                             kind: "keyword" },
    ],

    // ── Bun ───────────────────────────────────────────────
    bun: [
        { name: "run",         detail: "Run a file or package.json script",           kind: "function" },
        { name: "install",     detail: "Install dependencies",                       kind: "function" },
        { name: "add",         detail: "Add a dependency",                           kind: "function" },
        { name: "remove",      detail: "Remove a dependency",                        kind: "function" },
        { name: "update",      detail: "Update dependencies",                        kind: "function" },
        { name: "build",       detail: "Bundle TypeScript & JavaScript",             kind: "function" },
        { name: "test",        detail: "Run tests",                                  kind: "function" },
        { name: "init",        detail: "Start an empty Bun project",                 kind: "function" },
        { name: "create",      detail: "Create a new project from a template",       kind: "function" },
        { name: "upgrade",     detail: "Upgrade Bun",                                kind: "function" },
        { name: "link",        detail: "Register or link a local package",           kind: "function" },
        { name: "pm",          detail: "Package manager utilities",                  kind: "function" },
        { name: "x",           detail: "Execute a package binary (bunx)",            kind: "function" },
        { name: "--watch",     detail: "Watch mode",                                 kind: "keyword" },
        { name: "--hot",       detail: "Hot reload mode",                            kind: "keyword" },
        { name: "-d",          detail: "Add as devDependency",                       kind: "keyword" },
    ],

    // ── pnpm ──────────────────────────────────────────────
    pnpm: [
        { name: "install",     detail: "Install all dependencies",                   kind: "function" },
        { name: "add",         detail: "Add a package",                              kind: "function" },
        { name: "remove",      detail: "Remove a package",                           kind: "function" },
        { name: "run",         detail: "Run a script",                               kind: "function" },
        { name: "dev",         detail: "Run the dev script",                         kind: "function" },
        { name: "build",       detail: "Run the build script",                       kind: "function" },
        { name: "dlx",         detail: "Execute a package without installing",       kind: "function" },
        { name: "exec",        detail: "Execute a shell command in scope",           kind: "function" },
        { name: "update",      detail: "Update packages",                            kind: "function" },
        { name: "why",         detail: "Show why a package is installed",             kind: "function" },
        { name: "-D",          detail: "Save as devDependency",                      kind: "keyword" },
        { name: "-g",          detail: "Global install",                             kind: "keyword" },
        { name: "--filter",    detail: "Filter packages in monorepo",                kind: "keyword" },
    ],

    // ── yarn ──────────────────────────────────────────────
    yarn: [
        { name: "add",         detail: "Add a package",                              kind: "function" },
        { name: "remove",      detail: "Remove a package",                           kind: "function" },
        { name: "install",     detail: "Install all dependencies",                   kind: "function" },
        { name: "run",         detail: "Run a script",                               kind: "function" },
        { name: "build",       detail: "Run the build script",                       kind: "function" },
        { name: "dev",         detail: "Run the dev script",                         kind: "function" },
        { name: "dlx",         detail: "Execute a package binary",                   kind: "function" },
        { name: "upgrade",     detail: "Upgrade packages",                           kind: "function" },
        { name: "why",         detail: "Show why a package is installed",             kind: "function" },
        { name: "-D",          detail: "Save as devDependency",                      kind: "keyword" },
    ],

    // ── Git ───────────────────────────────────────────────
    git: [
        { name: "init",        detail: "Initialize a new repository",                kind: "function" },
        { name: "clone",       detail: "Clone a repository",                         kind: "function" },
        { name: "add",         detail: "Stage changes",                              kind: "function" },
        { name: "commit",      detail: "Record changes to the repository",           kind: "function" },
        { name: "push",        detail: "Push commits to remote",                     kind: "function" },
        { name: "pull",        detail: "Fetch and merge from remote",                kind: "function" },
        { name: "fetch",       detail: "Download objects and refs",                  kind: "function" },
        { name: "branch",      detail: "List, create, or delete branches",           kind: "function" },
        { name: "checkout",    detail: "Switch branches or restore files",           kind: "function" },
        { name: "switch",      detail: "Switch branches",                            kind: "function" },
        { name: "merge",       detail: "Merge branches",                             kind: "function" },
        { name: "rebase",      detail: "Rebase current branch",                      kind: "function" },
        { name: "log",         detail: "Show commit logs",                           kind: "function" },
        { name: "status",      detail: "Show working tree status",                   kind: "function" },
        { name: "diff",        detail: "Show changes between commits",               kind: "function" },
        { name: "stash",       detail: "Stash the changes in a dirty working dir",   kind: "function" },
        { name: "reset",       detail: "Reset current HEAD to specified state",      kind: "function" },
        { name: "remote",      detail: "Manage remote repositories",                 kind: "function" },
        { name: "tag",         detail: "Create, list, or delete tags",               kind: "function" },
        { name: "cherry-pick", detail: "Apply changes from specific commits",        kind: "function" },
        { name: "-m",          detail: "Commit message",                             kind: "keyword" },
        { name: "--force",     detail: "Force push",                                 kind: "keyword" },
        { name: "--no-verify", detail: "Skip pre-commit hooks",                      kind: "keyword" },
    ],

    // ── systemctl ─────────────────────────────────────────
    systemctl: [
        { name: "start",       detail: "Start a unit",                               kind: "function" },
        { name: "stop",        detail: "Stop a unit",                                kind: "function" },
        { name: "restart",     detail: "Restart a unit",                             kind: "function" },
        { name: "reload",      detail: "Reload a unit's config",                     kind: "function" },
        { name: "enable",      detail: "Enable a unit to start at boot",             kind: "function" },
        { name: "disable",     detail: "Disable a unit from starting at boot",       kind: "function" },
        { name: "status",      detail: "Show unit status",                           kind: "function" },
        { name: "is-active",   detail: "Check if unit is active",                    kind: "function" },
        { name: "is-enabled",  detail: "Check if unit is enabled",                   kind: "function" },
        { name: "daemon-reload", detail: "Reload systemd manager config",            kind: "function" },
        { name: "list-units",  detail: "List loaded units",                          kind: "function" },
        { name: "list-unit-files", detail: "List installed unit files",              kind: "function" },
        { name: "cat",         detail: "Show unit file contents",                    kind: "function" },
        { name: "edit",        detail: "Edit a unit file",                           kind: "function" },
    ],

    // ── curl ──────────────────────────────────────────────
    curl: [
        { name: "-X",          detail: "Specify request method (GET, POST …)",        kind: "keyword" },
        { name: "-H",          detail: "Pass custom header",                          kind: "keyword" },
        { name: "-d",          detail: "Send data in request body",                   kind: "keyword" },
        { name: "-o",          detail: "Write output to file",                        kind: "keyword" },
        { name: "-O",          detail: "Write output to file named as remote",        kind: "keyword" },
        { name: "-L",          detail: "Follow redirects",                            kind: "keyword" },
        { name: "-s",          detail: "Silent mode",                                 kind: "keyword" },
        { name: "-v",          detail: "Verbose output",                              kind: "keyword" },
        { name: "-k",          detail: "Allow insecure SSL connections",              kind: "keyword" },
        { name: "-u",          detail: "Server user:password",                        kind: "keyword" },
        { name: "--json",      detail: "Send JSON data (shorthand)",                  kind: "keyword" },
        { name: "--compressed", detail: "Request compressed response",                kind: "keyword" },
    ],

    // ── wget ──────────────────────────────────────────────
    wget: [
        { name: "-O",          detail: "Write to specified file",                     kind: "keyword" },
        { name: "-q",          detail: "Quiet mode",                                  kind: "keyword" },
        { name: "-r",          detail: "Recursive download",                          kind: "keyword" },
        { name: "-c",          detail: "Continue partial download",                   kind: "keyword" },
        { name: "--mirror",    detail: "Mirror a website",                            kind: "keyword" },
        { name: "--no-check-certificate", detail: "Skip SSL verification",           kind: "keyword" },
    ],

    // ── SSH ───────────────────────────────────────────────
    ssh: [
        { name: "-p",          detail: "Port to connect to",                          kind: "keyword" },
        { name: "-i",          detail: "Identity file (private key)",                 kind: "keyword" },
        { name: "-L",          detail: "Local port forwarding",                       kind: "keyword" },
        { name: "-R",          detail: "Remote port forwarding",                      kind: "keyword" },
        { name: "-D",          detail: "Dynamic SOCKS proxy",                         kind: "keyword" },
        { name: "-N",          detail: "No remote command (tunnel only)",             kind: "keyword" },
        { name: "-v",          detail: "Verbose mode",                                kind: "keyword" },
        { name: "-o",          detail: "Set ssh option",                              kind: "keyword" },
    ],

    // ── scp ───────────────────────────────────────────────
    scp: [
        { name: "-r",          detail: "Recursively copy directories",                kind: "keyword" },
        { name: "-P",          detail: "Port to connect to",                          kind: "keyword" },
        { name: "-i",          detail: "Identity file (private key)",                 kind: "keyword" },
        { name: "-C",          detail: "Enable compression",                          kind: "keyword" },
    ],

    // ── apt ───────────────────────────────────────────────
    apt: [
        { name: "install",     detail: "Install packages",                            kind: "function" },
        { name: "remove",      detail: "Remove packages",                             kind: "function" },
        { name: "purge",       detail: "Remove packages + config",                    kind: "function" },
        { name: "update",      detail: "Update package index",                        kind: "function" },
        { name: "upgrade",     detail: "Upgrade installed packages",                  kind: "function" },
        { name: "full-upgrade", detail: "Full system upgrade",                        kind: "function" },
        { name: "autoremove",  detail: "Remove unneeded packages",                    kind: "function" },
        { name: "search",      detail: "Search for packages",                         kind: "function" },
        { name: "show",        detail: "Show package details",                        kind: "function" },
        { name: "list",        detail: "List packages",                               kind: "function" },
        { name: "-y",          detail: "Auto-confirm prompts",                        kind: "keyword" },
    ],

    // ── yum / dnf ─────────────────────────────────────────
    yum: [
        { name: "install",     detail: "Install packages",                            kind: "function" },
        { name: "remove",      detail: "Remove packages",                             kind: "function" },
        { name: "update",      detail: "Update packages",                             kind: "function" },
        { name: "search",      detail: "Search for packages",                         kind: "function" },
        { name: "info",        detail: "Show package info",                           kind: "function" },
        { name: "list",        detail: "List packages",                               kind: "function" },
        { name: "clean",       detail: "Clean cached data",                           kind: "function" },
        { name: "-y",          detail: "Auto-confirm prompts",                        kind: "keyword" },
    ],

    // ── tar ───────────────────────────────────────────────
    tar: [
        { name: "-xvf",        detail: "Extract verbose file",                        kind: "keyword" },
        { name: "-cvf",        detail: "Create verbose file",                         kind: "keyword" },
        { name: "-czvf",       detail: "Create gzip compressed archive",              kind: "keyword" },
        { name: "-xzvf",       detail: "Extract gzip compressed archive",             kind: "keyword" },
        { name: "-tf",         detail: "List archive contents",                       kind: "keyword" },
        { name: "-C",          detail: "Change to directory before extracting",       kind: "keyword" },
    ],

    // ── chmod / chown ─────────────────────────────────────
    chmod: [
        { name: "+x",          detail: "Add execute permission",                      kind: "keyword" },
        { name: "-R",          detail: "Recursive",                                   kind: "keyword" },
        { name: "755",         detail: "rwxr-xr-x (common for dirs)",                 kind: "keyword" },
        { name: "644",         detail: "rw-r--r-- (common for files)",                kind: "keyword" },
        { name: "777",         detail: "rwxrwxrwx (full access)",                     kind: "keyword" },
        { name: "600",         detail: "rw------- (owner only)",                      kind: "keyword" },
    ],
    chown: [
        { name: "-R",          detail: "Recursive ownership change",                  kind: "keyword" },
    ],

    // ── grep ──────────────────────────────────────────────
    grep: [
        { name: "-r",          detail: "Recursive search",                            kind: "keyword" },
        { name: "-i",          detail: "Case-insensitive",                            kind: "keyword" },
        { name: "-n",          detail: "Show line numbers",                           kind: "keyword" },
        { name: "-l",          detail: "List matching filenames only",                kind: "keyword" },
        { name: "-v",          detail: "Invert match",                                kind: "keyword" },
        { name: "-E",          detail: "Extended regex",                              kind: "keyword" },
        { name: "-c",          detail: "Count matching lines",                        kind: "keyword" },
        { name: "--include",   detail: "Search only matching files",                  kind: "keyword" },
        { name: "--exclude",   detail: "Skip matching files",                         kind: "keyword" },
        { name: "--color",     detail: "Highlight matches",                           kind: "keyword" },
    ],

    // ── find ──────────────────────────────────────────────
    find: [
        { name: "-name",       detail: "Match filename pattern",                      kind: "keyword" },
        { name: "-iname",      detail: "Case-insensitive filename match",             kind: "keyword" },
        { name: "-type",       detail: "File type (f=file, d=dir, l=link)",           kind: "keyword" },
        { name: "-size",       detail: "Match file size",                             kind: "keyword" },
        { name: "-mtime",      detail: "Modified time (days)",                        kind: "keyword" },
        { name: "-exec",       detail: "Execute command on matches",                  kind: "keyword" },
        { name: "-delete",     detail: "Delete matched files",                        kind: "keyword" },
        { name: "-maxdepth",   detail: "Max directory depth",                         kind: "keyword" },
        { name: "-print",      detail: "Print matched paths",                         kind: "keyword" },
    ],

    // ── sed / awk ─────────────────────────────────────────
    sed: [
        { name: "-i",          detail: "Edit files in place",                         kind: "keyword" },
        { name: "-e",          detail: "Add script to commands",                      kind: "keyword" },
        { name: "-n",          detail: "Suppress automatic printing",                 kind: "keyword" },
        { name: "s/old/new/g", detail: "Substitute pattern globally",                 kind: "snippet" },
    ],
    awk: [
        { name: "-F",          detail: "Set field separator",                         kind: "keyword" },
        { name: "-v",          detail: "Assign variable",                             kind: "keyword" },
        { name: "'{print $1}'", detail: "Print first field",                          kind: "snippet" },
        { name: "'{print NR, $0}'", detail: "Print with line numbers",                kind: "snippet" },
    ],

    // ── ls / cp / mv / rm / mkdir ─────────────────────────
    ls: [
        { name: "-la",         detail: "Long format, all files",                      kind: "keyword" },
        { name: "-lh",         detail: "Long format, human-readable sizes",           kind: "keyword" },
        { name: "-R",          detail: "Recursive listing",                           kind: "keyword" },
        { name: "-t",          detail: "Sort by modification time",                   kind: "keyword" },
        { name: "-S",          detail: "Sort by file size",                           kind: "keyword" },
        { name: "--color",     detail: "Colorize output",                             kind: "keyword" },
    ],
    cp: [
        { name: "-r",          detail: "Copy directories recursively",                kind: "keyword" },
        { name: "-v",          detail: "Verbose output",                              kind: "keyword" },
        { name: "-i",          detail: "Prompt before overwrite",                     kind: "keyword" },
        { name: "-u",          detail: "Copy only when source is newer",              kind: "keyword" },
    ],
    mv: [
        { name: "-v",          detail: "Verbose output",                              kind: "keyword" },
        { name: "-i",          detail: "Prompt before overwrite",                     kind: "keyword" },
        { name: "-n",          detail: "Do not overwrite existing",                   kind: "keyword" },
    ],
    rm: [
        { name: "-r",          detail: "Remove directories recursively",              kind: "keyword" },
        { name: "-f",          detail: "Force removal without prompt",                kind: "keyword" },
        { name: "-rf",         detail: "Force recursive removal",                     kind: "keyword" },
        { name: "-i",          detail: "Prompt before each removal",                  kind: "keyword" },
        { name: "-v",          detail: "Verbose output",                              kind: "keyword" },
    ],
    mkdir: [
        { name: "-p",          detail: "Create parent directories as needed",         kind: "keyword" },
        { name: "-v",          detail: "Verbose output",                              kind: "keyword" },
        { name: "-m",          detail: "Set permission mode",                         kind: "keyword" },
    ],

    // ── ps / kill / top / htop ────────────────────────────
    ps: [
        { name: "aux",         detail: "All processes, full format",                  kind: "keyword" },
        { name: "-ef",         detail: "Full listing of all processes",               kind: "keyword" },
        { name: "-p",          detail: "Select by PID",                               kind: "keyword" },
    ],
    kill: [
        { name: "-9",          detail: "SIGKILL – force kill",                        kind: "keyword" },
        { name: "-15",         detail: "SIGTERM – graceful termination",              kind: "keyword" },
        { name: "-HUP",        detail: "SIGHUP – reload config",                     kind: "keyword" },
    ],

    // ── ufw (firewall) ────────────────────────────────────
    ufw: [
        { name: "enable",      detail: "Enable the firewall",                         kind: "function" },
        { name: "disable",     detail: "Disable the firewall",                        kind: "function" },
        { name: "status",      detail: "Show firewall status",                        kind: "function" },
        { name: "allow",       detail: "Allow a port/service",                        kind: "function" },
        { name: "deny",        detail: "Deny a port/service",                         kind: "function" },
        { name: "delete",      detail: "Delete a rule",                               kind: "function" },
        { name: "reload",      detail: "Reload firewall rules",                       kind: "function" },
        { name: "reset",       detail: "Reset all rules to default",                  kind: "function" },
    ],

    // ── journalctl ────────────────────────────────────────
    journalctl: [
        { name: "-u",          detail: "Show logs for a unit",                        kind: "keyword" },
        { name: "-f",          detail: "Follow log output",                           kind: "keyword" },
        { name: "-n",          detail: "Number of lines to show",                     kind: "keyword" },
        { name: "--since",     detail: "Show logs since date/time",                   kind: "keyword" },
        { name: "--until",     detail: "Show logs until date/time",                   kind: "keyword" },
        { name: "-p",          detail: "Filter by priority",                          kind: "keyword" },
        { name: "--no-pager",  detail: "Do not pipe output into pager",               kind: "keyword" },
    ],

    // ── certbot ───────────────────────────────────────────
    certbot: [
        { name: "certonly",    detail: "Obtain a certificate only",                   kind: "function" },
        { name: "install",     detail: "Install cert in server config",               kind: "function" },
        { name: "renew",       detail: "Renew all certificates",                      kind: "function" },
        { name: "revoke",      detail: "Revoke a certificate",                        kind: "function" },
        { name: "delete",      detail: "Delete a certificate",                        kind: "function" },
        { name: "--nginx",     detail: "Use nginx plugin",                            kind: "keyword" },
        { name: "--apache",    detail: "Use Apache plugin",                           kind: "keyword" },
        { name: "--standalone", detail: "Use standalone server",                      kind: "keyword" },
        { name: "-d",          detail: "Specify domain name",                         kind: "keyword" },
    ],

    // ── python / pip ──────────────────────────────────────
    python: [
        { name: "-m",          detail: "Run library module as a script",              kind: "keyword" },
        { name: "-c",          detail: "Execute code passed as string",               kind: "keyword" },
        { name: "-u",          detail: "Unbuffered stdout/stderr",                    kind: "keyword" },
        { name: "--version",   detail: "Show Python version",                         kind: "keyword" },
        { name: "-i",          detail: "Inspect interactively after running",         kind: "keyword" },
    ],
    pip: [
        { name: "install",     detail: "Install packages",                            kind: "function" },
        { name: "uninstall",   detail: "Uninstall packages",                          kind: "function" },
        { name: "freeze",      detail: "Output installed packages",                   kind: "function" },
        { name: "list",        detail: "List installed packages",                     kind: "function" },
        { name: "show",        detail: "Show package info",                           kind: "function" },
        { name: "search",      detail: "Search PyPI",                                 kind: "function" },
        { name: "-r",          detail: "Install from requirements file",              kind: "keyword" },
        { name: "--upgrade",   detail: "Upgrade to latest version",                   kind: "keyword" },
    ],
};

// Alias "docker compose" to the same as "docker-compose"
SHELL_COMMAND_DB["dnf"] = SHELL_COMMAND_DB["yum"]!;
SHELL_COMMAND_DB["python3"] = SHELL_COMMAND_DB["python"]!;
SHELL_COMMAND_DB["pip3"] = SHELL_COMMAND_DB["pip"]!;
SHELL_COMMAND_DB["sudo"] = [];  // handled specially in provider

const MOCK_IMPORT_PATHS = [
    { label: "react",            detail: "React library" },
    { label: "react-dom",        detail: "React DOM" },
    { label: "react-router-dom", detail: "React Router" },
    { label: "zustand",          detail: "State management" },
    { label: "axios",            detail: "HTTP client" },
    { label: "lodash",           detail: "Utility library" },
    { label: "zod",              detail: "Schema validation" },
    { label: "date-fns",         detail: "Date utilities" },
];

// ── Mock diagnostics patterns ────────────────────────────────

interface DiagPattern {
    pattern: RegExp;
    message: string;
    severity: Diagnostic["severity"];
}

const DIAG_PATTERNS: DiagPattern[] = [
    { pattern: /\bvar\b/,                    message: "Use 'const' or 'let' instead of 'var'",      severity: "warning" },
    { pattern: /console\.(log|debug)\(/,     message: "Unexpected console statement",               severity: "warning" },
    { pattern: /==(?!=)/,                    message: "Use '===' instead of '=='",                  severity: "warning" },
    { pattern: /!=(?!=)/,                    message: "Use '!==' instead of '!='",                  severity: "warning" },
    { pattern: /\bany\b/,                    message: "Avoid using 'any' type",                     severity: "info" },
    { pattern: /TODO:/i,                     message: "TODO comment found",                          severity: "hint" },
    { pattern: /FIXME:/i,                    message: "FIXME comment found",                         severity: "warning" },
    { pattern: /HACK:/i,                     message: "HACK comment found – consider refactoring",   severity: "warning" },
];

// ── Provider implementation ──────────────────────────────────

class MockIntelliSenseProvider implements CompletionProvider {
    id = "mock-intellisense:provider";
    triggerCharacters = [".", "\"", "'", "/", " "];

    provideCompletions(ctx: CompletionContext): CompletionItem[] {
        const beforeCursor = ctx.lineText.slice(0, ctx.column);
        const items: CompletionItem[] = [];

        // ── Property access: "identifier." ───────────────────
        const dotMatch = beforeCursor.match(/(\w+)\.\s*(\w*)$/);
        if (dotMatch) {
            const obj = dotMatch[1];
            const partial = dotMatch[2]?.toLowerCase() ?? "";
            const props = PROPERTY_DB[obj];
            if (props) {
                for (const p of props) {
                    if (!partial || p.name.toLowerCase().startsWith(partial)) {
                        items.push({
                            label: p.name,
                            kind: p.kind,
                            detail: p.detail,
                            insertText: p.name,
                            sortOrder: 0,
                        });
                    }
                }
                return items.slice(0, 30);
            }
        }

        // ── Shell / CLI subcommand completions ───────────────
        // Matches: "<command> <partial>" — e.g. "docker r" → run, restart …
        // Also handles: "sudo <command> <partial>"
        const shellMatch = beforeCursor.match(/^\s*(?:sudo\s+)?(\S+)\s+(\S*)$/);
        if (shellMatch) {
            const cmd = shellMatch[1].toLowerCase();
            const partial = shellMatch[2]?.toLowerCase() ?? "";
            const subCmds = SHELL_COMMAND_DB[cmd];
            if (subCmds) {
                for (const sc of subCmds) {
                    if (!partial || sc.name.toLowerCase().startsWith(partial)) {
                        items.push({
                            label: sc.name,
                            kind: sc.kind,
                            detail: sc.detail,
                            insertText: sc.name,
                            sortOrder: 0,
                        });
                    }
                }
                if (items.length > 0) return items.slice(0, 30);
            }
        }

        // ── Shell command at start of line (no subcommand yet) ─
        // Matches: "dock" → docker, docker-compose
        const lineStart = beforeCursor.match(/^\s*(?:sudo\s+)?(\S+)$/);
        if (lineStart) {
            const partial = lineStart[1].toLowerCase();
            if (partial.length >= 2) {
                for (const cmd of Object.keys(SHELL_COMMAND_DB)) {
                    if (cmd.toLowerCase().startsWith(partial) && cmd.toLowerCase() !== partial) {
                        items.push({
                            label: cmd,
                            kind: "function",
                            detail: "shell command",
                            insertText: cmd,
                            sortOrder: 0,
                        });
                    }
                }
                if (items.length > 0) return items.slice(0, 30);
            }
        }

        // ── Import path suggestions ─────────────────────────
        const importMatch = beforeCursor.match(/(?:from\s+|import\s+|require\s*\(\s*)["']([^"']*)$/);
        if (importMatch) {
            const partial = importMatch[1].toLowerCase();
            for (const mod of MOCK_IMPORT_PATHS) {
                if (!partial || mod.label.toLowerCase().startsWith(partial)) {
                    items.push({
                        label: mod.label,
                        kind: "module",
                        detail: mod.detail,
                        insertText: mod.label,
                        sortOrder: 0,
                    });
                }
            }
            return items.slice(0, 20);
        }

        // ── Fallback: symbol completions from document ──────
        const word = ctx.wordBeforeCursor.toLowerCase();
        if (word.length < 1) return [];

        const symbolRegex = /\b[a-zA-Z_$][a-zA-Z0-9_$]{2,}\b/g;
        const seen = new Set<string>();
        let match: RegExpExecArray | null;
        while ((match = symbolRegex.exec(ctx.content)) !== null) {
            const sym = match[0];
            if (sym.toLowerCase().startsWith(word) && sym.toLowerCase() !== word && !seen.has(sym)) {
                seen.add(sym);
                items.push({
                    label: sym,
                    kind: "variable",
                    detail: "document symbol",
                    insertText: sym,
                    sortOrder: 2,
                });
            }
        }

        return items.slice(0, 20);
    }
}

// ── Diagnostic analysis ──────────────────────────────────────

function analyzeDiagnostics(content: string): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        for (const dp of DIAG_PATTERNS) {
            const match = dp.pattern.exec(line);
            if (match) {
                diagnostics.push({
                    id: `mock-diag:${i + 1}:${match.index}`,
                    line: i + 1,
                    startCol: match.index,
                    endCol: match.index + match[0].length,
                    message: dp.message,
                    severity: dp.severity,
                    source: "mock-intellisense",
                });
            }
        }
    }

    return diagnostics;
}

// ── Type hint annotations ────────────────────────────────────

function extractTypeHints(content: string): InlineAnnotation[] {
    const annotations: InlineAnnotation[] = [];
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // const x = <value>  →  show inferred type hint
        const constMatch = line.match(/^\s*(?:const|let)\s+(\w+)\s*=\s*(.+)/);
        if (constMatch) {
            const value = constMatch[2].trim().replace(/;$/, "");
            let inferredType = "";
            if (/^["'`]/.test(value))                    inferredType = ": string";
            else if (/^\d+$/.test(value))                inferredType = ": number";
            else if (/^\d+\.\d+$/.test(value))           inferredType = ": number";
            else if (/^(true|false)$/.test(value))       inferredType = ": boolean";
            else if (/^\[/.test(value))                  inferredType = ": array";
            else if (/^\{/.test(value))                  inferredType = ": object";
            else if (/^null$/.test(value))               inferredType = ": null";
            else if (/^undefined$/.test(value))          inferredType = ": undefined";

            if (inferredType) {
                annotations.push({
                    id: `mock-type-hint:${i + 1}`,
                    line: i + 1,
                    col: line.length,
                    text: `  ${inferredType}`,
                    style: { color: "var(--editor-muted, #6272a4)", fontStyle: "italic", opacity: 0.7 },
                });
            }
        }
    }

    return annotations;
}

// ═══════════════════════════════════════════════════════════════
//  PLUGIN FACTORY
// ═══════════════════════════════════════════════════════════════

export function createMockIntelliSensePlugin(): ExtendedEditorPlugin {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    return {
        id: "mock-intellisense",
        name: "Mock IntelliSense",
        version: "1.0.0",
        description: "Smart context-aware completions, diagnostics, and type hints (no backend required)",
        category: "language",
        defaultEnabled: true,

        completionProviders: [new MockIntelliSenseProvider()],

        onActivate(api) {
            // Run initial analysis
            const content = api.getContent();
            updateAnalysis(content, api);
            api.showToast("Mock IntelliSense", "Diagnostics & smart completions active", "default");
        },

        onContentChange(content, api) {
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => updateAnalysis(content, api), 500);
        },

        onDeactivate(api) {
            if (debounceTimer) clearTimeout(debounceTimer);
            api.clearDiagnostics("mock-intellisense");
            api.clearInlineAnnotations("mock-intellisense");
        },
    };
}

function updateAnalysis(content: string, api: ExtendedPluginAPI) {
    // Clear stale diagnostics before setting new ones
    // This ensures removed lines don't leave ghost diagnostics behind
    api.clearDiagnostics("mock-intellisense");
    const diagnostics = analyzeDiagnostics(content);
    api.setDiagnostics(diagnostics);

    // Clear stale annotations before setting new ones
    api.clearInlineAnnotations("mock-intellisense");
    const annotations = extractTypeHints(content);
    api.setInlineAnnotations(annotations);
}
