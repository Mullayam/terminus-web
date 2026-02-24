/**
 * @module editor/workers/syntax.worker
 *
 * Web Worker for offloading syntax highlighting to a background thread.
 * Receives content + language, runs Prism highlight, returns HTML string.
 *
 * This keeps the main thread free for user interactions while large files
 * are being highlighted. Supports incremental updates by accepting line ranges.
 *
 * Message protocol:
 *   Request:  { id, type: "highlight", content, language }
 *   Response: { id, type: "highlight", html, duration }
 *
 *   Request:  { id, type: "highlight-range", content, language, startLine, endLine }
 *   Response: { id, type: "highlight-range", html, startLine, endLine, duration }
 */

// Prism can run without DOM — it only needs string operations for highlight()
import Prism from "prismjs";

// Import commonly used language grammars
import "prismjs/components/prism-c";
import "prismjs/components/prism-cpp";
import "prismjs/components/prism-csharp";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-jsx";
import "prismjs/components/prism-tsx";
import "prismjs/components/prism-python";
import "prismjs/components/prism-bash";
import "prismjs/components/prism-json";
import "prismjs/components/prism-yaml";
import "prismjs/components/prism-scss";
import "prismjs/components/prism-markdown";
import "prismjs/components/prism-sql";
import "prismjs/components/prism-go";
import "prismjs/components/prism-rust";
import "prismjs/components/prism-java";
import "prismjs/components/prism-ruby";
import "prismjs/components/prism-docker";
import "prismjs/components/prism-toml";
import "prismjs/components/prism-ini";
import "prismjs/components/prism-kotlin";
import "prismjs/components/prism-swift";
import "prismjs/components/prism-graphql";

/** Maximum content size for highlighting (150KB) */
const HIGHLIGHT_SIZE_LIMIT = 150_000;

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function doHighlight(content: string, language: string | null): string {
    if (!language || content.length > HIGHLIGHT_SIZE_LIMIT) {
        return escapeHtml(content);
    }
    const grammar = Prism.languages[language];
    if (!grammar) return escapeHtml(content);
    try {
        return Prism.highlight(content, grammar, language);
    } catch {
        return escapeHtml(content);
    }
}

// ── Message handler ──────────────────────────────────────────

self.addEventListener("message", (e: MessageEvent) => {
    const { id, type, content, language, startLine, endLine } = e.data;
    const t0 = performance.now();

    if (type === "highlight") {
        const html = doHighlight(content, language);
        self.postMessage({
            id,
            type: "highlight",
            html,
            duration: performance.now() - t0,
        });
    } else if (type === "highlight-range") {
        // Highlight only a specific line range for incremental updates
        const lines = content.split("\n");
        const slice = lines.slice(startLine, endLine).join("\n");
        const html = doHighlight(slice, language);
        self.postMessage({
            id,
            type: "highlight-range",
            html,
            startLine,
            endLine,
            duration: performance.now() - t0,
        });
    }
});
