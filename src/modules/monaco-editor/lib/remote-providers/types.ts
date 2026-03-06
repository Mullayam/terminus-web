/**
 * @module monaco-editor/lib/remote-providers/types
 *
 * TypeScript interfaces for the remote-providers system.
 *
 * These define:
 *  - The JSON data format for each provider type (served from BASE_URL)
 *  - The manifest schema that describes what providers exist and where
 *  - Configuration for the auto-fetch registration system
 *
 * ─────────────────────────────────────────────────────────────
 * DATA FLOW
 * ─────────────────────────────────────────────────────────────
 *
 *   BASE_URL/manifest.json
 *     ├── completion/javascript.json   → registerCompletionItemProvider
 *     ├── definition/javascript.json   → registerDefinitionProvider
 *     ├── hover/javascript.json        → registerHoverProvider
 *     ├── codeActions/javascript.json  → registerCodeActionProvider
 *     ├── documentHighlight/js.json    → registerDocumentHighlightProvider
 *     ├── documentSymbol/js.json       → registerDocumentSymbolProvider
 *     ├── links/javascript.json        → registerLinkProvider
 *     ├── typeDefinition/js.json       → registerTypeDefinitionProvider
 *     ├── references/javascript.json   → registerReferenceProvider
 *     ├── implementation/js.json       → registerImplementationProvider
 *     ├── inlineCompletions/js.json    → registerInlineCompletionsProvider
 *     ├── formatting/javascript.json   → registerDocumentFormattingEditProvider
 *     ├── codeLens/javascript.json     → registerCodeLensProvider
 *     ├── color/css.json               → registerColorProvider
 *     ├── declaration/js.json          → registerDeclarationProvider
 *     ├── inlayHints/typescript.json   → registerInlayHintsProvider
 *     ├── signatureHelp/js.json        → registerSignatureHelpProvider
 *     ├── linkedEditingRange/html.json → registerLinkedEditingRangeProvider
 *     ├── rangeFormatting/js.json      → registerDocumentRangeFormattingEditProvider
 *     ├── onTypeFormatting/js.json     → registerOnTypeFormattingEditProvider
 *     ├── foldingRange/js.json         → registerFoldingRangeProvider
 *     ├── rename/js.json               → registerRenameProvider
 *     ├── newSymbolNames/js.json       → registerNewSymbolNameProvider
 *     ├── selectionRange/js.json       → registerSelectionRangeProvider
 *     ├── semanticTokens/js.json       → registerDocumentSemanticTokensProvider
 *     └── rangeSemanticTokens/js.json  → registerDocumentRangeSemanticTokensProvider
 */

import type * as monacoNs from "monaco-editor";

// ═══════════════════════════════════════════════════════════════
//  PROVIDER KEYS
// ═══════════════════════════════════════════════════════════════

export const PROVIDER_KEYS = [
  "completion",
  "definition",
  "hover",
  "codeActions",
  "documentHighlight",
  "documentSymbol",
  "links",
  "typeDefinition",
  "references",
  "implementation",
  "inlineCompletions",
  "formatting",
  "codeLens",
  "color",
  "declaration",
  "inlayHints",
  "signatureHelp",
  "linkedEditingRange",
  "rangeFormatting",
  "onTypeFormatting",
  "foldingRange",
  "rename",
  "newSymbolNames",
  "selectionRange",
  "semanticTokens",
  "rangeSemanticTokens",
] as const;

export type ProviderKey = (typeof PROVIDER_KEYS)[number];

// ═══════════════════════════════════════════════════════════════
//  MANIFEST
// ═══════════════════════════════════════════════════════════════

/**
 * The manifest file at `BASE_URL/manifest.json`.
 *
 * Example:
 * ```json
 * {
 *   "name": "my-language-pack",
 *   "version": "1.0.0",
 *   "description": "Custom providers for JavaScript",
 *   "languages": ["javascript", "typescript"],
 *   "providers": {
 *     "completion": {
 *       "javascript": "completion/javascript.json",
 *       "typescript": "completion/typescript.json"
 *     },
 *     "hover": {
 *       "javascript": "hover/javascript.json"
 *     },
 *     "codeLens": {
 *       "javascript": "codeLens/javascript.json"
 *     }
 *   }
 * }
 * ```
 */
export interface RemoteProviderManifest {
  /** Pack name */
  name?: string;
  /** Semver version */
  version: string;
  /** Optional description */
  description?: string;
  /** Language IDs or language entries this pack provides for */
  languages: string[] | LanguageEntry[];
  /**
   * Map of provider type → { languageId: relative-path-to-json }.
   * Paths are relative to the BASE_URL.
   * Used in provider-first format.
   */
  providers?: Partial<Record<ProviderKey, Record<string, string>>>;
}

/**
 * Language entry for the language-first manifest format (CDN style).
 * Used by @enjoys/context-engine manifest.
 */
export interface LanguageEntry {
  /** Language ID (e.g., "javascript", "python") */
  id: string;
  /** Display name (e.g., "JavaScript", "Python") */
  name: string;
  /** Map of provider type → relative file path */
  files: Partial<Record<ProviderKey, string>>;
}

/**
 * Check if manifest uses language-first format (CDN style)
 */
export function isLanguageFirstManifest(
  manifest: RemoteProviderManifest
): manifest is RemoteProviderManifest & { languages: LanguageEntry[] } {
  return (
    Array.isArray(manifest.languages) &&
    manifest.languages.length > 0 &&
    typeof manifest.languages[0] === "object" &&
    "id" in manifest.languages[0] &&
    "files" in manifest.languages[0]
  );
}

// ═══════════════════════════════════════════════════════════════
//  CONFIG
// ═══════════════════════════════════════════════════════════════

export interface RemoteProviderConfig {
  /** Base URL where the manifest and data files are hosted */
  baseUrl: string;
  /** Override manifest filename (default: "manifest.json") */
  manifestFile?: string;
  /** Only register for these languages (default: all from manifest) */
  languages?: string[];
  /** Only register these provider types (default: all from manifest) */
  providerTypes?: ProviderKey[];
  /** Custom fetch options (e.g., headers for auth) */
  fetchOptions?: RequestInit;
  /** Error callback for individual provider load failures */
  onError?: (providerKey: ProviderKey, language: string, error: unknown) => void;
}

// ═══════════════════════════════════════════════════════════════
//  REGISTRATION RESULT
// ═══════════════════════════════════════════════════════════════

export interface RemoteProviderRegistration extends monacoNs.IDisposable {
  /** The loaded manifest */
  manifest: RemoteProviderManifest;
  /** Map of languageId → set of registered provider keys */
  registered: Map<string, Set<ProviderKey>>;
}

// ═══════════════════════════════════════════════════════════════
//  SHARED JSON PRIMITIVES
// ═══════════════════════════════════════════════════════════════

/** JSON-serializable IRange (1-based, same as Monaco) */
export interface JsonRange {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
}

/** JSON-serializable Location */
export interface JsonLocation {
  /** URI string — if omitted, defaults to the current model URI */
  uri?: string;
  range: JsonRange;
}

/** JSON-serializable IMarkdownString */
export interface JsonMarkdownString {
  value: string;
  isTrusted?: boolean;
}

/** JSON-serializable Command */
export interface JsonCommand {
  id: string;
  title: string;
  tooltip?: string;
  arguments?: unknown[];
}

// ═══════════════════════════════════════════════════════════════
//  1. COMPLETION  →  registerCompletionItemProvider
// ═══════════════════════════════════════════════════════════════

export interface CompletionData {
  triggerCharacters?: string[];
  items: CompletionItemData[];
}

export interface CompletionItemData {
  label: string | { label: string; detail?: string; description?: string };
  /** CompletionItemKind enum value (0–28) */
  kind?: number;
  /** CompletionItemTag[] (1 = Deprecated) */
  tags?: number[];
  detail?: string;
  documentation?: string | JsonMarkdownString;
  sortText?: string;
  filterText?: string;
  preselect?: boolean;
  insertText: string;
  /** CompletionItemInsertTextRule (4 = InsertAsSnippet) */
  insertTextRules?: number;
  commitCharacters?: string[];
  command?: JsonCommand;
}

// ═══════════════════════════════════════════════════════════════
//  2. DEFINITION  →  registerDefinitionProvider
// ═══════════════════════════════════════════════════════════════

export interface DefinitionData {
  /** word → location(s) */
  entries: Record<string, JsonLocation | JsonLocation[]>;
}

// ═══════════════════════════════════════════════════════════════
//  3. HOVER  →  registerHoverProvider
// ═══════════════════════════════════════════════════════════════

export interface HoverData {
  /** word → hover contents */
  entries: Record<string, { contents: JsonMarkdownString[] }>;
}

// ═══════════════════════════════════════════════════════════════
//  4. CODE ACTIONS  →  registerCodeActionProvider
// ═══════════════════════════════════════════════════════════════

export interface CodeActionData {
  actions: CodeActionItemData[];
}

export interface CodeActionItemData {
  title: string;
  /** e.g. "quickfix", "refactor.rewrite", "source.fixAll" */
  kind?: string;
  /** Only show when a marker with this source exists */
  diagnosticSource?: string;
  /** Only show when a marker with this code exists */
  diagnosticCode?: string | number;
  isPreferred?: boolean;
  edit?: {
    changes: Array<{
      /** If omitted, applies to the current selection/range */
      range?: JsonRange;
      text: string;
    }>;
  };
  command?: JsonCommand;
}

// ═══════════════════════════════════════════════════════════════
//  5. DOCUMENT HIGHLIGHT  →  registerDocumentHighlightProvider
// ═══════════════════════════════════════════════════════════════

export interface DocumentHighlightData {
  /** word → highlight kind */
  entries: Record<string, { kind?: "text" | "read" | "write" }>;
}

// ═══════════════════════════════════════════════════════════════
//  6. DOCUMENT SYMBOL  →  registerDocumentSymbolProvider
// ═══════════════════════════════════════════════════════════════

export interface DocumentSymbolData {
  symbols: DocumentSymbolPattern[];
}

export interface DocumentSymbolPattern {
  /** Regex matched per line. First capture group ($1) is the symbol name. */
  pattern: string;
  /** SymbolKind enum value (0–25) */
  kind: number;
  detail?: string;
  containerName?: string;
}

// ═══════════════════════════════════════════════════════════════
//  7. LINKS  →  registerLinkProvider
// ═══════════════════════════════════════════════════════════════

export interface LinkData {
  patterns: LinkPatternData[];
}

export interface LinkPatternData {
  /** Regex matched per line (with global flag) */
  pattern: string;
  /** URL template — use $0 for full match, $1/$2 for capture groups */
  url?: string;
  tooltip?: string;
}

// ═══════════════════════════════════════════════════════════════
//  8. TYPE DEFINITION  →  registerTypeDefinitionProvider
// ═══════════════════════════════════════════════════════════════

export interface TypeDefinitionData {
  /** word → location(s) */
  entries: Record<string, JsonLocation | JsonLocation[]>;
}

// ═══════════════════════════════════════════════════════════════
//  9. REFERENCES  →  registerReferenceProvider
// ═══════════════════════════════════════════════════════════════

export interface ReferenceData {
  /** word → list of reference locations */
  entries: Record<string, JsonLocation[]>;
}

// ═══════════════════════════════════════════════════════════════
//  10. IMPLEMENTATION  →  registerImplementationProvider
// ═══════════════════════════════════════════════════════════════

export interface ImplementationData {
  /** word → location(s) */
  entries: Record<string, JsonLocation | JsonLocation[]>;
}

// ═══════════════════════════════════════════════════════════════
//  11. INLINE COMPLETIONS  →  registerInlineCompletionsProvider
// ═══════════════════════════════════════════════════════════════

export interface InlineCompletionData {
  items: InlineCompletionItemData[];
}

export interface InlineCompletionItemData {
  /** Regex for the text before cursor that triggers this suggestion */
  triggerPattern?: string;
  /** Only suggest when the word at cursor starts with this */
  filterWord?: string;
  /** The text or snippet to insert */
  insertText: string | { snippet: string };
  command?: JsonCommand;
}

// ═══════════════════════════════════════════════════════════════
//  12. FORMATTING  →  registerDocumentFormattingEditProvider
// ═══════════════════════════════════════════════════════════════

export interface FormattingData {
  displayName?: string;
  rules: FormattingRuleData[];
}

export interface FormattingRuleData {
  /** Regex pattern to match */
  pattern: string;
  /** Replacement string ($1, $2 for capture groups) */
  replacement: string;
  /** "line" = apply per line, "document" = apply to whole text (default: "document") */
  scope?: "line" | "document";
}

// ═══════════════════════════════════════════════════════════════
//  13. CODE LENS  →  registerCodeLensProvider
// ═══════════════════════════════════════════════════════════════

export interface CodeLensData {
  lenses: CodeLensPattern[];
}

export interface CodeLensPattern {
  /** Regex matched per line. A lens appears on matching lines. */
  pattern: string;
  command: JsonCommand;
}

// ═══════════════════════════════════════════════════════════════
//  14. COLOR  →  registerColorProvider
// ═══════════════════════════════════════════════════════════════

export interface ColorData {
  patterns: ColorPatternData[];
}

export interface ColorPatternData {
  /** Regex to detect color values per line (global flag applied automatically) */
  pattern: string;
  /** Color format: "hex" | "rgb" | "hsl" */
  format: "hex" | "rgb" | "hsl";
}

// ═══════════════════════════════════════════════════════════════
//  15. DECLARATION  →  registerDeclarationProvider
// ═══════════════════════════════════════════════════════════════

export interface DeclarationData {
  /** word → location(s) */
  entries: Record<string, JsonLocation | JsonLocation[]>;
}

// ═══════════════════════════════════════════════════════════════
//  16. INLAY HINTS  →  registerInlayHintsProvider
// ═══════════════════════════════════════════════════════════════

export interface InlayHintData {
  hints: InlayHintPattern[];
}

export interface InlayHintPattern {
  /** Regex matched per line (global flag applied). Capture groups usable in label. */
  pattern: string;
  /** Label text. Use $1, $2 for capture group substitution. */
  label: string;
  /** InlayHintKind: 1 = Type, 2 = Parameter */
  kind?: number;
  tooltip?: string;
  /** Place hint "before" or "after" the match (default: "after") */
  position?: "before" | "after";
  paddingLeft?: boolean;
  paddingRight?: boolean;
}

// ═══════════════════════════════════════════════════════════════
//  17. SIGNATURE HELP  →  registerSignatureHelpProvider
// ═══════════════════════════════════════════════════════════════

export interface SignatureHelpData {
  triggerCharacters?: string[];
  retriggerCharacters?: string[];
  signatures: SignatureData[];
}

export interface SignatureData {
  /** Regex matched against the word/function before the cursor */
  triggerPattern?: string;
  label: string;
  documentation?: string | JsonMarkdownString;
  parameters: SignatureParameterData[];
  activeParameter?: number;
}

export interface SignatureParameterData {
  label: string | [number, number];
  documentation?: string | JsonMarkdownString;
}

// ═══════════════════════════════════════════════════════════════
//  18. LINKED EDITING RANGE  →  registerLinkedEditingRangeProvider
// ═══════════════════════════════════════════════════════════════

export interface LinkedEditingRangeData {
  /** word → list of other words that should be edited together */
  entries: Record<string, { wordPattern?: string }>;
}

// ═══════════════════════════════════════════════════════════════
//  19. RANGE FORMATTING  →  registerDocumentRangeFormattingEditProvider
// ═══════════════════════════════════════════════════════════════

export interface RangeFormattingData {
  displayName?: string;
  rules: FormattingRuleData[];
}

// ═══════════════════════════════════════════════════════════════
//  20. ON TYPE FORMATTING  →  registerOnTypeFormattingEditProvider
// ═══════════════════════════════════════════════════════════════

export interface OnTypeFormattingData {
  /** Characters that trigger on-type formatting (e.g. ";", "}", "\n") */
  triggerCharacters: string[];
  rules: OnTypeFormattingRule[];
}

export interface OnTypeFormattingRule {
  /** Character that triggers this rule */
  triggerCharacter: string;
  /** Regex to match on the line where the character was typed */
  pattern: string;
  /** Replacement text ($1, $2 for capture groups) */
  replacement: string;
}

// ═══════════════════════════════════════════════════════════════
//  21. FOLDING RANGE  →  registerFoldingRangeProvider
// ═══════════════════════════════════════════════════════════════

export interface FoldingRangeData {
  patterns: FoldingRangePattern[];
}

export interface FoldingRangePattern {
  /** Regex to match the start of a foldable region */
  startPattern: string;
  /** Regex to match the end of a foldable region */
  endPattern: string;
  /** FoldingRangeKind: "comment" | "imports" | "region" */
  kind?: "comment" | "imports" | "region";
}

// ═══════════════════════════════════════════════════════════════
//  22. RENAME  →  registerRenameProvider
// ═══════════════════════════════════════════════════════════════

export interface RenameData {
  /** Regex pattern to identify renameable symbols (global, per line) */
  symbolPattern: string;
}

// ═══════════════════════════════════════════════════════════════
//  23. NEW SYMBOL NAMES  →  registerNewSymbolNameProvider
// ═══════════════════════════════════════════════════════════════

export interface NewSymbolNamesData {
  /** word → list of suggested new names */
  entries: Record<string, NewSymbolNameSuggestion[]>;
}

export interface NewSymbolNameSuggestion {
  newSymbolName: string;
  /** NewSymbolNameTag[]: 1 = AIGenerated */
  tags?: number[];
}

// ═══════════════════════════════════════════════════════════════
//  24. SELECTION RANGE  →  registerSelectionRangeProvider
// ═══════════════════════════════════════════════════════════════

export interface SelectionRangeData {
  /** Paired bracket/scope patterns for smart selection expansion */
  patterns: SelectionRangePattern[];
}

export interface SelectionRangePattern {
  /** Regex for the opening token */
  open: string;
  /** Regex for the closing token */
  close: string;
}

// ═══════════════════════════════════════════════════════════════
//  25. SEMANTIC TOKENS  →  registerDocumentSemanticTokensProvider
// ═══════════════════════════════════════════════════════════════

export interface SemanticTokensData {
  legend: {
    tokenTypes: string[];
    tokenModifiers: string[];
  };
  /** Regex patterns that produce semantic tokens */
  patterns: SemanticTokenPattern[];
}

export interface SemanticTokenPattern {
  /** Regex matched per line (global flag applied) */
  pattern: string;
  /** Index into legend.tokenTypes */
  tokenType: number;
  /** Bitmask into legend.tokenModifiers (0 = none) */
  tokenModifiers?: number;
}

// ═══════════════════════════════════════════════════════════════
//  26. RANGE SEMANTIC TOKENS  →  registerDocumentRangeSemanticTokensProvider
// ═══════════════════════════════════════════════════════════════

export interface RangeSemanticTokensData {
  legend: {
    tokenTypes: string[];
    tokenModifiers: string[];
  };
  patterns: SemanticTokenPattern[];
}

// ═══════════════════════════════════════════════════════════════
//  PROVIDER DATA MAP (union type by key)
// ═══════════════════════════════════════════════════════════════

export interface ProviderDataMap {
  completion: CompletionData;
  definition: DefinitionData;
  hover: HoverData;
  codeActions: CodeActionData;
  documentHighlight: DocumentHighlightData;
  documentSymbol: DocumentSymbolData;
  links: LinkData;
  typeDefinition: TypeDefinitionData;
  references: ReferenceData;
  implementation: ImplementationData;
  inlineCompletions: InlineCompletionData;
  formatting: FormattingData;
  codeLens: CodeLensData;
  color: ColorData;
  declaration: DeclarationData;
  inlayHints: InlayHintData;
  signatureHelp: SignatureHelpData;
  linkedEditingRange: LinkedEditingRangeData;
  rangeFormatting: RangeFormattingData;
  onTypeFormatting: OnTypeFormattingData;
  foldingRange: FoldingRangeData;
  rename: RenameData;
  newSymbolNames: NewSymbolNamesData;
  selectionRange: SelectionRangeData;
  semanticTokens: SemanticTokensData;
  rangeSemanticTokens: RangeSemanticTokensData;
}
