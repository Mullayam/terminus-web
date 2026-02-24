/**
 * @module editor/core/syntax
 * Prism.js wrapper – lazy-loads grammars and provides a highlight function.
 * Keeps Prism imports centralised so consumers never touch Prism directly.
 */
import Prism from "prismjs";

// ── Language grammar imports ─────────────────────────────────
// Prism grammars are side-effect imports; order matters for dependencies.
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

import { escapeHtml } from "./utils";

/** Maximum content size (bytes) for which syntax highlighting runs */
const HIGHLIGHT_SIZE_LIMIT = 150_000;

/**
 * Highlight `content` using the Prism grammar identified by `prismLang`.
 * Returns raw HTML string safe for `dangerouslySetInnerHTML`.
 * Falls back to escaped HTML when no grammar exists or content is too large.
 */
export function highlightCode(content: string, prismLang: string | null): string {
    if (!prismLang || content.length > HIGHLIGHT_SIZE_LIMIT) {
        return escapeHtml(content);
    }
    const grammar = Prism.languages[prismLang];
    if (!grammar) return escapeHtml(content);
    try {
        return Prism.highlight(content, grammar, prismLang);
    } catch {
        return escapeHtml(content);
    }
}
