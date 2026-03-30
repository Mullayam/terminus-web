/**
 * @module lib/monaco/symbol-patterns
 *
 * Regex patterns that detect function / class / interface / struct / module
 * declarations per language family. Used by:
 *  - **CodeLens** ("✨ Fetch Snippets" buttons on symbols)
 *  - **AI completions** (context extraction)
 *
 * Each entry maps a set of Monaco language IDs to an array of regexes.
 * Every regex MUST have exactly one capture group `(\w+)` for the symbol name.
 */

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface SymbolPatternFamily {
  langs: string[];
  patterns: RegExp[];
}

export interface SymbolLine {
  /** 1-based line number */
  line: number;
  /** Extracted symbol name */
  name: string;
}

/* ------------------------------------------------------------------ */
/*  Patterns                                                           */
/* ------------------------------------------------------------------ */

export const SYMBOL_PATTERNS: SymbolPatternFamily[] = [
  // ── JavaScript / TypeScript ────────────────────────────────
  {
    langs: ["javascript", "typescript", "javascriptreact", "typescriptreact", "jsx", "tsx"],
    patterns: [
      /^\s*(?:export\s+)?(?:async\s+)?function\s*\*?\s+(\w+)/,
      /^\s*(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[a-zA-Z_]\w*)\s*=>/,
      /^\s*(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/,
      /^\s*(?:export\s+)?interface\s+(\w+)/,
      /^\s*(?:export\s+)?type\s+(\w+)/,
      /^\s*(?:export\s+)?enum\s+(\w+)/,
      /^\s*(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?function/,
    ],
  },

  // ── Python ─────────────────────────────────────────────────
  {
    langs: ["python"],
    patterns: [
      /^\s*(?:async\s+)?def\s+(\w+)/,
      /^\s*class\s+(\w+)/,
    ],
  },

  // ── Go ─────────────────────────────────────────────────────
  {
    langs: ["go"],
    patterns: [
      /^\s*func\s+(?:\([^)]+\)\s+)?(\w+)/,
      /^\s*type\s+(\w+)\s+(?:struct|interface)/,
    ],
  },

  // ── Rust ───────────────────────────────────────────────────
  {
    langs: ["rust"],
    patterns: [
      /^\s*(?:pub(?:\([^)]*\))?\s+)?(?:async\s+)?fn\s+(\w+)/,
      /^\s*(?:pub(?:\([^)]*\))?\s+)?(?:struct|enum|trait|union)\s+(\w+)/,
      /^\s*(?:pub(?:\([^)]*\))?\s+)?type\s+(\w+)/,
      /^\s*(?:pub(?:\([^)]*\))?\s+)?mod\s+(\w+)/,
      /^\s*impl(?:<[^>]*>)?\s+(\w+)/,
    ],
  },

  // ── Java ───────────────────────────────────────────────────
  {
    langs: ["java"],
    patterns: [
      /^\s*(?:@\w+\s+)*(?:public|private|protected|static|abstract|final|synchronized|native|\s)*(?:class|interface|enum|record)\s+(\w+)/,
      /^\s*(?:@\w+\s+)*(?:public|private|protected|static|abstract|final|synchronized|native|\s)*[\w<>\[\],\s]+\s+(\w+)\s*\(/,
    ],
  },

  // ── Kotlin ─────────────────────────────────────────────────
  {
    langs: ["kotlin"],
    patterns: [
      /^\s*(?:(?:public|private|protected|internal|open|abstract|sealed|data|inline|value|annotation)\s+)*(?:class|interface|object|enum\s+class)\s+(\w+)/,
      /^\s*(?:(?:public|private|protected|internal|open|abstract|override|inline|suspend)\s+)*fun\s+(?:<[^>]*>\s+)?(\w+)/,
      /^\s*(?:val|var)\s+(\w+)\s*[=:]/,
      /^\s*typealias\s+(\w+)/,
    ],
  },

  // ── C# ─────────────────────────────────────────────────────
  {
    langs: ["csharp"],
    patterns: [
      /^\s*(?:(?:public|private|protected|internal|static|abstract|sealed|partial|readonly|async|virtual|override)\s+)*(?:class|struct|interface|enum|record)\s+(\w+)/,
      /^\s*(?:(?:public|private|protected|internal|static|abstract|virtual|override|async)\s+)*[\w<>\[\]?,\s]+\s+(\w+)\s*[(<]/,
      /^\s*(?:public|private|protected|internal|static|\s)*delegate\s+\w+\s+(\w+)/,
      /^\s*namespace\s+([\w.]+)/,
    ],
  },

  // ── C / C++ ────────────────────────────────────────────────
  {
    langs: ["c", "cpp", "objective-c"],
    patterns: [
      /^\s*(?:(?:static|inline|extern|virtual|explicit|constexpr|consteval|template\s*<[^>]*>)\s+)*(?:class|struct|union|enum(?:\s+class)?)\s+(\w+)/,
      /^\s*(?:(?:static|inline|extern|virtual|constexpr)\s+)*[\w:*&<>\[\]\s]+\s+(\w+)\s*\(/,
      /^\s*(?:typedef\s+)?(?:struct|union|enum)\s+(\w+)/,
      /^\s*namespace\s+(\w+)/,
      /^\s*#define\s+(\w+)/,
    ],
  },

  // ── Swift ──────────────────────────────────────────────────
  {
    langs: ["swift"],
    patterns: [
      /^\s*(?:(?:public|private|fileprivate|internal|open|final|static|class|override)\s+)*(?:class|struct|enum|protocol|actor)\s+(\w+)/,
      /^\s*(?:(?:public|private|fileprivate|internal|open|static|class|override|mutating)\s+)*func\s+(\w+)/,
      /^\s*typealias\s+(\w+)/,
      /^\s*(?:(?:public|private|fileprivate|internal|open|static|class|lazy)\s+)*(?:let|var)\s+(\w+)\s*[=:]/,
    ],
  },

  // ── Dart ───────────────────────────────────────────────────
  {
    langs: ["dart"],
    patterns: [
      /^\s*(?:abstract\s+)?class\s+(\w+)/,
      /^\s*(?:mixin|extension)\s+(\w+)/,
      /^\s*(?:(?:static|Future|Stream|void)\s+)?(\w+)\s*[(<]/,
      /^\s*enum\s+(\w+)/,
      /^\s*typedef\s+(\w+)/,
    ],
  },

  // ── Scala ──────────────────────────────────────────────────
  {
    langs: ["scala"],
    patterns: [
      /^\s*(?:(?:abstract|sealed|final|implicit|lazy|private|protected)\s+)*(?:class|trait|object)\s+(\w+)/,
      /^\s*(?:(?:private|protected|override|implicit|lazy)\s+)*(?:def|val|var)\s+(\w+)/,
      /^\s*type\s+(\w+)/,
      /^\s*(?:case\s+)?class\s+(\w+)/,
    ],
  },

  // ── PHP ────────────────────────────────────────────────────
  {
    langs: ["php"],
    patterns: [
      /^\s*(?:(?:public|private|protected|static|abstract|final)\s+)*function\s+(\w+)/,
      /^\s*(?:(?:abstract|final)\s+)?class\s+(\w+)/,
      /^\s*interface\s+(\w+)/,
      /^\s*trait\s+(\w+)/,
      /^\s*enum\s+(\w+)/,
      /^\s*namespace\s+([\w\\]+)/,
    ],
  },

  // ── Ruby ───────────────────────────────────────────────────
  {
    langs: ["ruby"],
    patterns: [
      /^\s*def\s+(?:self\.)?(\w+[?!=]?)/,
      /^\s*class\s+(\w+)/,
      /^\s*module\s+(\w+)/,
      /^\s*(?:attr_reader|attr_writer|attr_accessor)\s+:(\w+)/,
    ],
  },

  // ── Lua ────────────────────────────────────────────────────
  {
    langs: ["lua"],
    patterns: [
      /^\s*(?:local\s+)?function\s+(?:[\w.:]+\.)?(\w+)/,
      /^\s*(?:local\s+)?(\w+)\s*=\s*function/,
    ],
  },

  // ── Perl ───────────────────────────────────────────────────
  {
    langs: ["perl"],
    patterns: [
      /^\s*sub\s+(\w+)/,
      /^\s*package\s+([\w:]+)/,
    ],
  },

  // ── R ──────────────────────────────────────────────────────
  {
    langs: ["r"],
    patterns: [
      /^\s*(\w+)\s*<-\s*function/,
      /^\s*(\w+)\s*=\s*function/,
    ],
  },

  // ── Shell / Bash ───────────────────────────────────────────
  {
    langs: ["shell", "shellscript", "bash"],
    patterns: [
      /^\s*(?:function\s+)?(\w+)\s*\(\s*\)/,
      /^\s*function\s+(\w+)/,
    ],
  },

  // ── PowerShell ─────────────────────────────────────────────
  {
    langs: ["powershell"],
    patterns: [
      /^\s*function\s+([\w-]+)/i,
      /^\s*class\s+(\w+)/,
      /^\s*enum\s+(\w+)/,
    ],
  },

  // ── Elixir ─────────────────────────────────────────────────
  {
    langs: ["elixir"],
    patterns: [
      /^\s*(?:def|defp|defmacro|defmacrop|defguard|defguardp|defdelegate)\s+(\w+[?!]?)/,
      /^\s*defmodule\s+([\w.]+)/,
      /^\s*defprotocol\s+([\w.]+)/,
      /^\s*defimpl\s+([\w.]+)/,
    ],
  },

  // ── Erlang ─────────────────────────────────────────────────
  {
    langs: ["erlang"],
    patterns: [
      /^(\w+)\s*\(/,
      /^-module\((\w+)\)/,
      /^-export\(\[/,
    ],
  },

  // ── Haskell ────────────────────────────────────────────────
  {
    langs: ["haskell"],
    patterns: [
      /^(\w+)\s*::\s*/,
      /^(?:data|newtype|type)\s+(\w+)/,
      /^class\s+(?:\([^)]*\)\s*=>\s*)?(\w+)/,
      /^instance\s+/,
    ],
  },

  // ── F# ─────────────────────────────────────────────────────
  {
    langs: ["fsharp"],
    patterns: [
      /^\s*let\s+(?:rec\s+)?(?:inline\s+)?(\w+)/,
      /^\s*type\s+(\w+)/,
      /^\s*module\s+(\w+)/,
      /^\s*member\s+(?:this|self|x|_)\.(\w+)/,
    ],
  },

  // ── OCaml ──────────────────────────────────────────────────
  {
    langs: ["ocaml"],
    patterns: [
      /^\s*let\s+(?:rec\s+)?(\w+)/,
      /^\s*type\s+(\w+)/,
      /^\s*module\s+(\w+)/,
      /^\s*val\s+(\w+)/,
    ],
  },

  // ── Clojure ────────────────────────────────────────────────
  {
    langs: ["clojure"],
    patterns: [
      /^\s*\(def(?:n|n-|macro|multi|method|once|protocol|record|type|struct)?\s+(\S+)/,
      /^\s*\(ns\s+([\w.-]+)/,
    ],
  },

  // ── Julia ──────────────────────────────────────────────────
  {
    langs: ["julia"],
    patterns: [
      /^\s*function\s+(\w+)/,
      /^\s*(?:abstract\s+type|struct|mutable\s+struct)\s+(\w+)/,
      /^\s*macro\s+(\w+)/,
      /^\s*module\s+(\w+)/,
      /^\s*(\w+)\(.*\)\s*=/,
    ],
  },

  // ── Zig ────────────────────────────────────────────────────
  {
    langs: ["zig"],
    patterns: [
      /^\s*(?:pub\s+)?fn\s+(\w+)/,
      /^\s*(?:pub\s+)?const\s+(\w+)\s*=\s*(?:struct|enum|union)/,
    ],
  },

  // ── Solidity ───────────────────────────────────────────────
  {
    langs: ["solidity", "sol"],
    patterns: [
      /^\s*(?:contract|library|interface|abstract\s+contract)\s+(\w+)/,
      /^\s*function\s+(\w+)/,
      /^\s*(?:event|error|struct|enum|modifier)\s+(\w+)/,
    ],
  },

  // ── Groovy ─────────────────────────────────────────────────
  {
    langs: ["groovy"],
    patterns: [
      /^\s*(?:(?:public|private|protected|static|abstract|final)\s+)*(?:def\s+)?(\w+)\s*\(/,
      /^\s*(?:(?:abstract|final)\s+)?class\s+(\w+)/,
      /^\s*interface\s+(\w+)/,
      /^\s*trait\s+(\w+)/,
      /^\s*enum\s+(\w+)/,
    ],
  },

  // ── Visual Basic ───────────────────────────────────────────
  {
    langs: ["vb"],
    patterns: [
      /^\s*(?:Public|Private|Protected|Friend|Shared|\s)*(?:Sub|Function)\s+(\w+)/i,
      /^\s*(?:Public|Private|Protected|Friend|\s)*(?:Class|Structure|Interface|Enum|Module)\s+(\w+)/i,
    ],
  },

  // ── Pascal / Delphi ────────────────────────────────────────
  {
    langs: ["pascal"],
    patterns: [
      /^\s*(?:procedure|function)\s+(\w+)/i,
      /^\s*type\s+(\w+)/i,
    ],
  },

  // ── Elm ────────────────────────────────────────────────────
  {
    langs: ["elm"],
    patterns: [
      /^(\w+)\s*:\s*/,
      /^type\s+(?:alias\s+)?(\w+)/,
      /^module\s+([\w.]+)/,
      /^port\s+(\w+)/,
    ],
  },

  // ── Scheme / Racket ────────────────────────────────────────
  {
    langs: ["scheme"],
    patterns: [
      /^\s*\(define\s+(?:\((\w+)|\s*(\w+))/,
      /^\s*\(define-syntax\s+(\w+)/,
    ],
  },

  // ── SQL ────────────────────────────────────────────────────
  {
    langs: ["sql", "mysql", "pgsql"],
    patterns: [
      /^\s*CREATE\s+(?:OR\s+REPLACE\s+)?(?:FUNCTION|PROCEDURE)\s+(?:[\w.]+\.)?(\w+)/i,
      /^\s*CREATE\s+(?:OR\s+REPLACE\s+)?(?:TABLE|VIEW|INDEX|TRIGGER|TYPE)\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:[\w.]+\.)?(\w+)/i,
    ],
  },

  // ── GraphQL ────────────────────────────────────────────────
  {
    langs: ["graphql"],
    patterns: [
      /^\s*(?:type|interface|enum|union|scalar|input|extend\s+type)\s+(\w+)/,
      /^\s*(?:query|mutation|subscription|fragment)\s+(\w+)/,
    ],
  },

  // ── Svelte ─────────────────────────────────────────────────
  // Re-uses JS/TS patterns; script blocks contain standard JS/TS
  {
    langs: ["svelte"],
    patterns: [
      /^\s*(?:export\s+)?(?:async\s+)?function\s+(\w+)/,
      /^\s*(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[a-zA-Z_]\w*)\s*=>/,
      /^\s*(?:export\s+)?class\s+(\w+)/,
    ],
  },

  // ── Astro ──────────────────────────────────────────────────
  {
    langs: ["astro"],
    patterns: [
      /^\s*(?:export\s+)?(?:async\s+)?function\s+(\w+)/,
      /^\s*(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[a-zA-Z_]\w*)\s*=>/,
    ],
  },

  // ── Prisma ─────────────────────────────────────────────────
  {
    langs: ["prisma"],
    patterns: [
      /^\s*model\s+(\w+)/,
      /^\s*enum\s+(\w+)/,
      /^\s*type\s+(\w+)/,
      /^\s*generator\s+(\w+)/,
      /^\s*datasource\s+(\w+)/,
    ],
  },

  // ── TOML (sections) ────────────────────────────────────────
  {
    langs: ["toml"],
    patterns: [
      /^\s*\[+\s*([\w."-]+)\s*\]+/,
    ],
  },

  // ── YAML (top-level keys) ──────────────────────────────────
  {
    langs: ["yaml"],
    patterns: [
      /^(\w[\w-]*)\s*:/,
    ],
  },

  // ── Makefile ───────────────────────────────────────────────
  {
    langs: ["makefile"],
    patterns: [
      /^([\w.-]+)\s*:/,
    ],
  },

  // ── Dockerfile ─────────────────────────────────────────────
  {
    langs: ["dockerfile", "docker"],
    patterns: [
      /^\s*FROM\s+(\S+)/i,
      /^\s*(?:LABEL|ARG|ENV)\s+(\w+)/i,
    ],
  },

  // ── HCL / Terraform ────────────────────────────────────────
  {
    langs: ["hcl"],
    patterns: [
      /^\s*(?:resource|data|variable|output|module|provider|locals|terraform)\s+"?(\w+)"?/,
    ],
  },

  // ── Protobuf ───────────────────────────────────────────────
  {
    langs: ["protobuf"],
    patterns: [
      /^\s*(?:message|enum|service)\s+(\w+)/,
      /^\s*rpc\s+(\w+)/,
    ],
  },

  // ── LaTeX ──────────────────────────────────────────────────
  {
    langs: ["latex"],
    patterns: [
      /\\(?:section|subsection|subsubsection|chapter|part)\*?\{([^}]+)\}/,
      /\\(?:newcommand|renewcommand|providecommand)\{\\(\w+)\}/,
      /\\begin\{(\w+)\}/,
      /\\(?:label)\{([^}]+)\}/,
    ],
  },

  // ── Nginx ──────────────────────────────────────────────────
  {
    langs: ["nginx"],
    patterns: [
      /^\s*(?:server|location|upstream|map)\s+(\S+)?/,
    ],
  },
];

/* ------------------------------------------------------------------ */
/*  Lookup helpers                                                     */
/* ------------------------------------------------------------------ */

/** Index for O(1) language → family lookup (built lazily from static patterns) */
let _langIndex: Map<string, SymbolPatternFamily> | null = null;

function getLangIndex(): Map<string, SymbolPatternFamily> {
  if (!_langIndex) {
    _langIndex = new Map();
    for (const family of SYMBOL_PATTERNS) {
      for (const lang of family.langs) {
        _langIndex.set(lang, family);
      }
    }
  }
  return _langIndex;
}

/** Expose the full pattern index (including CDN-loaded entries) */
export function getSymbolPatternIndex(): Map<string, SymbolPatternFamily> {
  return getLangIndex();
}

/** Blacklisted symbol names (control-flow keywords that accidentally match) */
const KEYWORD_BLACKLIST = new Set([
  "if", "for", "while", "switch", "return", "else", "elif", "elsif",
  "catch", "finally", "throw", "throws", "do", "try", "break", "continue",
  "case", "default", "new", "delete", "sizeof", "typeof", "instanceof",
  "import", "export", "require", "from", "as", "with", "yield", "await",
  "print", "println", "console", "log", "fmt", "System", "Math",
]);

/* ------------------------------------------------------------------ */
/*  Context Engine CDN — dynamic symbol pattern loading                */
/* ------------------------------------------------------------------ */

/**
 * @enjoys/context-engine provides documentSymbol regex data for 94 languages.
 * We lazy-load patterns from the CDN for any language that lacks static patterns.
 * Data is cached in CacheStorage for offline / instant reuse.
 *
 * CDN URL: https://cdn.jsdelivr.net/npm/@enjoys/context-engine@latest/data/documentSymbol/{langId}.json
 */

const DOC_SYMBOL_CDN =
  "https://cdn.jsdelivr.net/npm/@enjoys/context-engine@latest/data/documentSymbol";
const SYMBOL_CACHE_NAME = "terminus-doc-symbols-v1";

/** SymbolKind values worth extracting (skip noisy Property/Variable/Event) */
const RELEVANT_SYMBOL_KINDS = new Set([
  1,  // Module
  4,  // Class
  5,  // Method
  8,  // Constructor
  9,  // Enum
  10, // Interface
  11, // Function
  22, // Struct
  25, // TypeAlias
]);

interface CDNSymbolEntry {
  name: string;
  pattern: string;
  captureGroup: number;
  kind: number;
  type?: string;
  detail?: string;
}

interface CDNDocumentSymbolData {
  language: string;
  symbolPatterns: CDNSymbolEntry[];
}

/** Track languages already attempted (loaded or failed) */
const _cdnAttempted = new Set<string>();

/**
 * Preload symbol patterns from @enjoys/context-engine CDN for a language.
 * Adds patterns to the shared index so `findSymbolLines()` can use them.
 * Only loads for languages that don't already have static patterns.
 * Safe to call multiple times — no-ops after the first call per language.
 */
export async function preloadCDNSymbolPatterns(langId: string): Promise<void> {
  if (_cdnAttempted.has(langId)) return;
  _cdnAttempted.add(langId);

  const idx = getLangIndex();
  // Already have static patterns — no need for CDN
  if (idx.has(langId)) return;

  try {
    const url = `${DOC_SYMBOL_CDN}/${langId}.json`;
    let text: string;

    if (typeof caches !== "undefined") {
      const cache = await caches.open(SYMBOL_CACHE_NAME);
      const cached = await cache.match(url);
      if (cached) {
        text = await cached.text();
      } else {
        const resp = await fetch(url);
        if (!resp.ok) return;
        await cache.put(url, resp.clone());
        text = await resp.text();
      }
    } else {
      const resp = await fetch(url);
      if (!resp.ok) return;
      text = await resp.text();
    }

    const data: CDNDocumentSymbolData = JSON.parse(text);
    const patterns: RegExp[] = [];

    for (const entry of data.symbolPatterns) {
      if (!RELEVANT_SYMBOL_KINDS.has(entry.kind)) continue;
      try {
        patterns.push(new RegExp(entry.pattern));
      } catch {
        /* skip invalid regex */
      }
    }

    if (patterns.length > 0) {
      idx.set(langId, { langs: [langId], patterns });
    }
  } catch {
    /* CDN is an optional enhancement — silent fail */
  }
}

/**
 * Preload CDN symbol patterns for multiple languages at once.
 */
export function preloadCDNSymbolPatternsMany(langIds: string[]): Promise<void[]> {
  return Promise.all(langIds.map((id) => preloadCDNSymbolPatterns(id)));
}

/* ------------------------------------------------------------------ */
/*  Public API — symbol scanning                                       */
/* ------------------------------------------------------------------ */

/**
 * Scan source code for symbol declarations (functions, classes, etc.).
 * Returns an array of `{ line, name }` where `line` is 1-based.
 * Uses static patterns + any CDN-preloaded patterns.
 */
export function findSymbolLines(content: string, languageId: string): SymbolLine[] {
  const family = getLangIndex().get(languageId);
  if (!family) return [];

  const lines = content.split("\n");
  const result: SymbolLine[] = [];

  for (let i = 0; i < lines.length; i++) {
    for (const pat of family.patterns) {
      const m = lines[i].match(pat);
      // Use first non-undefined capture group
      const name = m?.[1] ?? m?.[2];
      if (name && !KEYWORD_BLACKLIST.has(name)) {
        result.push({ line: i + 1, name });
        break;
      }
    }
  }

  return result;
}

/**
 * Async variant: preloads CDN patterns (if needed), then scans.
 * Preferred for languages that may not have static patterns.
 */
export async function findSymbolLinesAsync(
  content: string,
  languageId: string,
): Promise<SymbolLine[]> {
  await preloadCDNSymbolPatterns(languageId);
  return findSymbolLines(content, languageId);
}
