/**
 * @module editor/core/detect-lang
 * Language detection from file name / extension.
 * Maps extensions to human-readable names and Prism.js grammar identifiers.
 */

/** Human-readable language name for status bar display */
const DISPLAY_MAP: Record<string, string> = {
    js: "JavaScript", jsx: "JavaScript (JSX)", ts: "TypeScript", tsx: "TypeScript (TSX)",
    py: "Python", rb: "Ruby", go: "Go", rs: "Rust", java: "Java", kt: "Kotlin",
    c: "C", cpp: "C++", h: "C Header", cs: "C#", swift: "Swift",
    html: "HTML", htm: "HTML", css: "CSS", scss: "SCSS", less: "LESS",
    json: "JSON", yaml: "YAML", yml: "YAML", toml: "TOML", xml: "XML",
    md: "Markdown", sh: "Shell", bash: "Bash", zsh: "Zsh",
    sql: "SQL", graphql: "GraphQL", dockerfile: "Dockerfile",
    env: "Environment", conf: "Config", ini: "INI", cfg: "Config",
    txt: "Plain Text", log: "Log", lua: "Lua", php: "PHP",
    r: "R", scala: "Scala", perl: "Perl", pl: "Perl",
};

/** Prism.js grammar identifiers per file extension */
const PRISM_MAP: Record<string, string> = {
    js: "javascript", jsx: "jsx", ts: "typescript", tsx: "tsx",
    py: "python", rb: "ruby", go: "go", rs: "rust", java: "java", kt: "kotlin",
    c: "c", cpp: "cpp", h: "c", cs: "csharp", swift: "swift",
    html: "markup", htm: "markup", css: "css", scss: "scss", less: "css",
    json: "json", yaml: "yaml", yml: "yaml", toml: "toml", xml: "markup",
    md: "markdown", sh: "bash", bash: "bash", zsh: "bash",
    sql: "sql", graphql: "graphql", dockerfile: "docker",
    ini: "ini", conf: "ini", cfg: "ini",
    lua: "lua", php: "php", r: "r", scala: "scala", perl: "perl", pl: "perl",
};

/** Extract the extension from a file name (lowercase, no dot) */
function extOf(name: string): string {
    return name.split(".").pop()?.toLowerCase() ?? "";
}

/**
 * Detect the human-readable language label from a file name.
 * Falls back to "Plain Text" for unknown extensions.
 */
export function detectLanguage(name: string): string {
    if (name.toLowerCase() === "dockerfile") return "Dockerfile";
    if (name.toLowerCase().startsWith(".env")) return "Environment";
    return DISPLAY_MAP[extOf(name)] ?? "Plain Text";
}

/**
 * Detect the Prism.js grammar identifier from a file name.
 * Returns `null` when no grammar is available.
 */
export function detectPrismLanguage(name: string): string | null {
    if (name.toLowerCase() === "dockerfile") return "docker";
    if (name.toLowerCase().startsWith(".env")) return "bash"; // .env ≈ bash-like
    return PRISM_MAP[extOf(name)] ?? null;
}

/**
 * Get the file extension (lowercase, no dot).
 */
export function getExtension(name: string): string {
    return extOf(name);
}
