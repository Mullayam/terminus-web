/**
 * @module lib/contextEngineProviders
 *
 * Registers ALL Monaco language providers from installed @enjoys/context-engine
 * language packs (IndexedDB). Supports 25 provider types.
 */

import type * as monacoNs from "monaco-editor";
import {
    getInstalledLanguages,
    getLanguageData,
} from "@/lib/context-engine/contextEngineStorage";
import { PROVIDER_TYPES, type ProviderType } from "@/lib/context-engine/contextEngineApi";

type Monaco = typeof monacoNs;

/* ── Tracked disposables ───────────────────────────────────── */

const disposables: monacoNs.IDisposable[] = [];
const registeredLangs = new Set<string>();

/* ── CDN Data Types ────────────────────────────────────────── */

interface CDNCompletion {
    label: string;
    kind?: number;
    detail?: string;
    documentation?: { value: string } | string;
    insertText?: string;
    insertTextRules?: number;
    sortText?: string;
}

interface CDNCompletionFile {
    language: string;
    completions: CDNCompletion[];
}

interface CDNHoverEntry {
    contents: { value: string }[];
}

interface CDNHoverFile {
    language: string;
    hovers: Record<string, CDNHoverEntry>;
}

interface CDNDefinitionEntry {
    signature: string;
    description: string;
    type?: string;
    module?: string;
    uri?: string;
    range?: { startLineNumber: number; startColumn: number; endLineNumber: number; endColumn: number };
}

interface CDNDefinitionFile {
    language: string;
    definitions: Record<string, CDNDefinitionEntry>;
}

interface CDNCodeAction {
    title: string;
    kind?: string;
    diagnostics?: { message: string; severity?: number }[];
    edit?: { edits: { range: monacoNs.IRange; text: string }[] };
    isPreferred?: boolean;
}

interface CDNCodeActionsFile {
    language: string;
    codeActions: CDNCodeAction[];
}

interface CDNDocumentHighlightFile {
    language: string;
    highlights: Record<string, { kind?: number }[]>;
}

interface CDNDocumentSymbol {
    name: string;
    detail?: string;
    kind: number;
    range: monacoNs.IRange;
    selectionRange: monacoNs.IRange;
    children?: CDNDocumentSymbol[];
}

interface CDNDocumentSymbolFile {
    language: string;
    symbols: CDNDocumentSymbol[];
}

interface CDNLink {
    pattern: string;
    url?: string;
    tooltip?: string;
}

interface CDNLinksFile {
    language: string;
    links: CDNLink[];
}

interface CDNSignatureHelp {
    pattern: string;
    signatures: {
        label: string;
        documentation?: string;
        parameters?: { label: string; documentation?: string }[];
    }[];
}

interface CDNSignatureHelpFile {
    language: string;
    signatureHelp: CDNSignatureHelp[];
}

interface CDNFoldingRule {
    start: string;
    end: string;
    kind?: string;
}

interface CDNFoldingRangeFile {
    language: string;
    foldingRules: CDNFoldingRule[];
}

interface CDNInlayHint {
    pattern: string;
    hints: {
        label: string;
        kind?: number;
        position: "before" | "after";
        paddingLeft?: boolean;
        paddingRight?: boolean;
    }[];
}

interface CDNInlayHintsFile {
    language: string;
    inlayHints: CDNInlayHint[];
}

interface CDNCodeLens {
    pattern: string;
    title: string;
    command?: string;
}

interface CDNCodeLensFile {
    language: string;
    codeLenses: CDNCodeLens[];
}

interface CDNColorInfo {
    pattern: string;
}

interface CDNColorFile {
    language: string;
    colorPatterns: CDNColorInfo[];
}

interface CDNRenameFile {
    language: string;
    wordPattern?: string;
}

interface CDNSelectionRangeFile {
    language: string;
    selectionRanges: { pattern: string; expandTo: string }[];
}

interface CDNLinkedEditingFile {
    language: string;
    linkedEditing: { pattern: string; wordPattern?: string }[];
}

interface CDNFormattingFile {
    language: string;
    tabSize?: number;
    insertSpaces?: boolean;
    rules?: { pattern: string; action: string }[];
}

interface CDNSemanticTokensFile {
    language: string;
    tokenTypes: string[];
    tokenModifiers: string[];
}

interface CDNInlineCompletion {
    trigger: string;
    insertText: string;
}

interface CDNInlineCompletionsFile {
    language: string;
    inlineCompletions: CDNInlineCompletion[];
}

/* ── Map Monaco CompletionItemKind numbers ─────────────────── */

function resolveCompletionKind(
    monaco: Monaco,
    kind?: number,
): monacoNs.languages.CompletionItemKind {
    // CDN uses VS Code kind numbers which map 1:1 to Monaco
    if (kind !== undefined && kind >= 0 && kind <= 27) {
        return kind as monacoNs.languages.CompletionItemKind;
    }
    return monaco.languages.CompletionItemKind.Text;
}

/* ── Individual Provider Registrars ────────────────────────── */

async function registerCompletion(monaco: Monaco, langId: string): Promise<void> {
    const raw = await getLanguageData(langId, "completion");
    if (!raw) return;
    const file = raw as CDNCompletionFile;
    const completions = file.completions ?? [];
    if (completions.length === 0) return;

    const d = monaco.languages.registerCompletionItemProvider(langId, {
        triggerCharacters: [".", " ", "(", "/", "-"],
        provideCompletionItems(model, position) {
            const word = model.getWordUntilPosition(position);
            const range: monacoNs.IRange = {
                startLineNumber: position.lineNumber,
                endLineNumber: position.lineNumber,
                startColumn: word.startColumn,
                endColumn: word.endColumn,
            };

            const suggestions: monacoNs.languages.CompletionItem[] = completions.map((c) => {
                const doc = typeof c.documentation === "string"
                    ? c.documentation
                    : c.documentation?.value ?? "";
                return {
                    label: c.label,
                    kind: resolveCompletionKind(monaco, c.kind),
                    detail: c.detail ?? "",
                    documentation: doc ? { value: doc, isTrusted: true } : undefined,
                    insertText: c.insertText ?? c.label,
                    insertTextRules: c.insertTextRules
                        ? c.insertTextRules as monacoNs.languages.CompletionItemInsertTextRule
                        : undefined,
                    sortText: c.sortText,
                    range,
                } as monacoNs.languages.CompletionItem;
            });

            return { suggestions };
        },
    });
    disposables.push(d);
}

async function registerHover(monaco: Monaco, langId: string): Promise<void> {
    const raw = await getLanguageData(langId, "hover");
    if (!raw) return;
    const file = raw as CDNHoverFile;
    const hovers = file.hovers ?? {};
    if (Object.keys(hovers).length === 0) return;

    const d = monaco.languages.registerHoverProvider(langId, {
        provideHover(model, position) {
            const wordInfo = model.getWordAtPosition(position);
            if (!wordInfo) return null;

            const entry = hovers[wordInfo.word];
            if (!entry || !entry.contents?.length) return null;

            return {
                range: new monaco.Range(
                    position.lineNumber,
                    wordInfo.startColumn,
                    position.lineNumber,
                    wordInfo.endColumn,
                ),
                contents: entry.contents.map((c) => ({
                    value: c.value,
                    isTrusted: true,
                })),
            };
        },
    });
    disposables.push(d);
}

async function registerDefinition(monaco: Monaco, langId: string): Promise<void> {
    const raw = await getLanguageData(langId, "definition");
    if (!raw) return;
    const file = raw as CDNDefinitionFile;
    const defs = file.definitions ?? {};
    if (Object.keys(defs).length === 0) return;

    const d = monaco.languages.registerDefinitionProvider(langId, {
        provideDefinition(model, position) {
            const wordInfo = model.getWordAtPosition(position);
            if (!wordInfo) return null;

            const entry = defs[wordInfo.word];
            if (!entry?.uri) return null;

            return {
                uri: monaco.Uri.parse(entry.uri),
                range: entry.range ?? {
                    startLineNumber: 1,
                    startColumn: 1,
                    endLineNumber: 1,
                    endColumn: 1,
                },
            };
        },
    });
    disposables.push(d);

    // Also register as hover for signature display
    const hd = monaco.languages.registerHoverProvider(langId, {
        provideHover(model, position) {
            const wordInfo = model.getWordAtPosition(position);
            if (!wordInfo) return null;

            const entry = defs[wordInfo.word];
            if (!entry) return null;

            const parts: string[] = [];
            if (entry.signature) parts.push(`\`\`\`${langId}\n${entry.signature}\n\`\`\``);
            if (entry.description) parts.push(entry.description);
            if (entry.type) parts.push(`**Type:** ${entry.type}`);
            if (entry.module) parts.push(`**Module:** \`${entry.module}\``);
            if (parts.length === 0) return null;

            return {
                range: new monaco.Range(
                    position.lineNumber,
                    wordInfo.startColumn,
                    position.lineNumber,
                    wordInfo.endColumn,
                ),
                contents: [{ value: parts.join("\n\n"), isTrusted: true }],
            };
        },
    });
    disposables.push(hd);
}

async function registerDeclaration(monaco: Monaco, langId: string): Promise<void> {
    const raw = await getLanguageData(langId, "declaration");
    if (!raw) return;
    const file = raw as CDNDefinitionFile;
    const defs = file.definitions ?? {};
    if (Object.keys(defs).length === 0) return;

    const d = monaco.languages.registerDeclarationProvider(langId, {
        provideDeclaration(model, position) {
            const wordInfo = model.getWordAtPosition(position);
            if (!wordInfo) return null;

            const entry = defs[wordInfo.word];
            if (!entry?.uri) return null;

            return {
                uri: monaco.Uri.parse(entry.uri),
                range: entry.range ?? { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 },
            };
        },
    });
    disposables.push(d);
}

async function registerTypeDefinition(monaco: Monaco, langId: string): Promise<void> {
    const raw = await getLanguageData(langId, "typeDefinition");
    if (!raw) return;
    const file = raw as CDNDefinitionFile;
    const defs = file.definitions ?? {};
    if (Object.keys(defs).length === 0) return;

    const d = monaco.languages.registerTypeDefinitionProvider(langId, {
        provideTypeDefinition(model, position) {
            const wordInfo = model.getWordAtPosition(position);
            if (!wordInfo) return null;

            const entry = defs[wordInfo.word];
            if (!entry?.uri) return null;

            return {
                uri: monaco.Uri.parse(entry.uri),
                range: entry.range ?? { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 },
            };
        },
    });
    disposables.push(d);
}

async function registerImplementation(monaco: Monaco, langId: string): Promise<void> {
    const raw = await getLanguageData(langId, "implementation");
    if (!raw) return;
    const file = raw as CDNDefinitionFile;
    const defs = file.definitions ?? {};
    if (Object.keys(defs).length === 0) return;

    const d = monaco.languages.registerImplementationProvider(langId, {
        provideImplementation(model, position) {
            const wordInfo = model.getWordAtPosition(position);
            if (!wordInfo) return null;

            const entry = defs[wordInfo.word];
            if (!entry?.uri) return null;

            return {
                uri: monaco.Uri.parse(entry.uri),
                range: entry.range ?? { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 },
            };
        },
    });
    disposables.push(d);
}

async function registerReferences(monaco: Monaco, langId: string): Promise<void> {
    const raw = await getLanguageData(langId, "references");
    if (!raw) return;
    const file = raw as { language: string; references: Record<string, { uri: string; range: monacoNs.IRange }[]> };
    const refs = file.references ?? {};
    if (Object.keys(refs).length === 0) return;

    const d = monaco.languages.registerReferenceProvider(langId, {
        provideReferences(model, position, context) {
            const wordInfo = model.getWordAtPosition(position);
            if (!wordInfo) return null;

            const locations = refs[wordInfo.word];
            if (!locations?.length) return null;

            return locations.map((loc) => ({
                uri: monaco.Uri.parse(loc.uri),
                range: loc.range,
            }));
        },
    });
    disposables.push(d);
}

async function registerDocumentHighlight(monaco: Monaco, langId: string): Promise<void> {
    const raw = await getLanguageData(langId, "documentHighlight");
    if (!raw) return;
    const file = raw as CDNDocumentHighlightFile;
    const highlights = file.highlights ?? {};
    if (Object.keys(highlights).length === 0) return;

    const d = monaco.languages.registerDocumentHighlightProvider(langId, {
        provideDocumentHighlights(model, position) {
            const wordInfo = model.getWordAtPosition(position);
            if (!wordInfo) return null;

            const entries = highlights[wordInfo.word];
            if (!entries?.length) return null;

            // Find all occurrences in the document
            const word = wordInfo.word;
            const text = model.getValue();
            const regex = new RegExp(`\\b${word}\\b`, "g");
            const results: monacoNs.languages.DocumentHighlight[] = [];
            let match;

            while ((match = regex.exec(text)) !== null) {
                const startPos = model.getPositionAt(match.index);
                const endPos = model.getPositionAt(match.index + word.length);
                results.push({
                    range: new monaco.Range(
                        startPos.lineNumber,
                        startPos.column,
                        endPos.lineNumber,
                        endPos.column,
                    ),
                    kind: monaco.languages.DocumentHighlightKind.Read,
                });
            }

            return results;
        },
    });
    disposables.push(d);
}

async function registerDocumentSymbol(monaco: Monaco, langId: string): Promise<void> {
    const raw = await getLanguageData(langId, "documentSymbol");
    if (!raw) return;
    const file = raw as CDNDocumentSymbolFile;
    const symbols = file.symbols ?? [];
    if (symbols.length === 0) return;

    const d = monaco.languages.registerDocumentSymbolProvider(langId, {
        provideDocumentSymbols(model) {
            // This is a static symbol list; real implementations would parse the document
            return symbols.map((s) => ({
                name: s.name,
                detail: s.detail ?? "",
                kind: s.kind as monacoNs.languages.SymbolKind,
                range: s.range,
                selectionRange: s.selectionRange,
                tags: [],
                children: s.children?.map((c) => ({
                    name: c.name,
                    detail: c.detail ?? "",
                    kind: c.kind as monacoNs.languages.SymbolKind,
                    range: c.range,
                    selectionRange: c.selectionRange,
                    tags: [],
                })),
            }));
        },
    });
    disposables.push(d);
}

async function registerCodeActions(monaco: Monaco, langId: string): Promise<void> {
    const raw = await getLanguageData(langId, "codeActions");
    if (!raw) return;
    const file = raw as CDNCodeActionsFile;
    const actions = file.codeActions ?? [];
    if (actions.length === 0) return;

    const d = monaco.languages.registerCodeActionProvider(langId, {
        provideCodeActions(model, range, context) {
            const codeActions: monacoNs.languages.CodeAction[] = actions
                .filter((a) => {
                    // Filter by diagnostic match if applicable
                    if (a.diagnostics?.length && context.markers.length) {
                        return a.diagnostics.some((d) =>
                            context.markers.some((m) => m.message.includes(d.message)),
                        );
                    }
                    return true;
                })
                .map((a) => ({
                    title: a.title,
                    kind: a.kind,
                    isPreferred: a.isPreferred,
                    edit: a.edit
                        ? {
                              edits: a.edit.edits.map((e) => ({
                                  resource: model.uri,
                                  textEdit: { range: e.range, text: e.text },
                                  versionId: model.getVersionId(),
                              })),
                          }
                        : undefined,
                }));

            return { actions: codeActions, dispose: () => {} };
        },
    });
    disposables.push(d);
}

async function registerLinks(monaco: Monaco, langId: string): Promise<void> {
    const raw = await getLanguageData(langId, "links");
    if (!raw) return;
    const file = raw as CDNLinksFile;
    const linkPatterns = file.links ?? [];
    if (linkPatterns.length === 0) return;

    const d = monaco.languages.registerLinkProvider(langId, {
        provideLinks(model) {
            const links: monacoNs.languages.ILink[] = [];
            const text = model.getValue();

            for (const lp of linkPatterns) {
                try {
                    const regex = new RegExp(lp.pattern, "g");
                    let match;
                    while ((match = regex.exec(text)) !== null) {
                        const startPos = model.getPositionAt(match.index);
                        const endPos = model.getPositionAt(match.index + match[0].length);
                        links.push({
                            range: new monaco.Range(
                                startPos.lineNumber,
                                startPos.column,
                                endPos.lineNumber,
                                endPos.column,
                            ),
                            url: lp.url ? lp.url.replace("$0", match[0]) : undefined,
                            tooltip: lp.tooltip,
                        });
                    }
                } catch {
                    // Invalid regex, skip
                }
            }

            return { links };
        },
    });
    disposables.push(d);
}

async function registerSignatureHelp(monaco: Monaco, langId: string): Promise<void> {
    const raw = await getLanguageData(langId, "signatureHelp");
    if (!raw) return;
    const file = raw as CDNSignatureHelpFile;
    const helpers = file.signatureHelp ?? [];
    if (helpers.length === 0) return;

    const d = monaco.languages.registerSignatureHelpProvider(langId, {
        signatureHelpTriggerCharacters: ["(", ","],
        provideSignatureHelp(model, position) {
            const lineContent = model.getLineContent(position.lineNumber);
            const textBefore = lineContent.substring(0, position.column - 1);

            for (const helper of helpers) {
                if (new RegExp(helper.pattern).test(textBefore)) {
                    return {
                        value: {
                            signatures: helper.signatures.map((s) => ({
                                label: s.label,
                                documentation: s.documentation,
                                parameters: s.parameters?.map((p) => ({
                                    label: p.label,
                                    documentation: p.documentation,
                                })) ?? [],
                            })),
                            activeSignature: 0,
                            activeParameter: (textBefore.match(/,/g) || []).length,
                        },
                        dispose: () => {},
                    };
                }
            }

            return null;
        },
    });
    disposables.push(d);
}

async function registerFoldingRange(monaco: Monaco, langId: string): Promise<void> {
    const raw = await getLanguageData(langId, "foldingRange");
    if (!raw) return;
    const file = raw as CDNFoldingRangeFile;
    const rules = file.foldingRules ?? [];
    if (rules.length === 0) return;

    const d = monaco.languages.registerFoldingRangeProvider(langId, {
        provideFoldingRanges(model) {
            const ranges: monacoNs.languages.FoldingRange[] = [];
            const lines = model.getLinesContent();

            for (const rule of rules) {
                const startRegex = new RegExp(rule.start);
                const endRegex = new RegExp(rule.end);
                const stack: number[] = [];

                for (let i = 0; i < lines.length; i++) {
                    if (startRegex.test(lines[i])) {
                        stack.push(i + 1);
                    } else if (endRegex.test(lines[i]) && stack.length > 0) {
                        const start = stack.pop()!;
                        ranges.push({
                            start,
                            end: i + 1,
                            kind: rule.kind === "comment"
                                ? monaco.languages.FoldingRangeKind.Comment
                                : rule.kind === "imports"
                                  ? monaco.languages.FoldingRangeKind.Imports
                                  : monaco.languages.FoldingRangeKind.Region,
                        });
                    }
                }
            }

            return ranges;
        },
    });
    disposables.push(d);
}

async function registerInlayHints(monaco: Monaco, langId: string): Promise<void> {
    const raw = await getLanguageData(langId, "inlayHints");
    if (!raw) return;
    const file = raw as CDNInlayHintsFile;
    const hintDefs = file.inlayHints ?? [];
    if (hintDefs.length === 0) return;

    const d = monaco.languages.registerInlayHintsProvider(langId, {
        provideInlayHints(model, range) {
            const hints: monacoNs.languages.InlayHint[] = [];
            const text = model.getValueInRange(range);

            for (const hd of hintDefs) {
                try {
                    const regex = new RegExp(hd.pattern, "g");
                    let match;
                    while ((match = regex.exec(text)) !== null) {
                        const pos = model.getPositionAt(
                            model.getOffsetAt({ lineNumber: range.startLineNumber, column: range.startColumn }) +
                                match.index +
                                (hd.hints[0]?.position === "after" ? match[0].length : 0),
                        );
                        for (const hint of hd.hints) {
                            hints.push({
                                label: hint.label,
                                kind: hint.kind as monacoNs.languages.InlayHintKind,
                                position: pos,
                                paddingLeft: hint.paddingLeft,
                                paddingRight: hint.paddingRight,
                            });
                        }
                    }
                } catch {
                    // Invalid regex
                }
            }

            return { hints, dispose: () => {} };
        },
    });
    disposables.push(d);
}

async function registerCodeLens(monaco: Monaco, langId: string): Promise<void> {
    const raw = await getLanguageData(langId, "codeLens");
    if (!raw) return;
    const file = raw as CDNCodeLensFile;
    const lenses = file.codeLenses ?? [];
    if (lenses.length === 0) return;

    const d = monaco.languages.registerCodeLensProvider(langId, {
        provideCodeLenses(model) {
            const result: monacoNs.languages.CodeLens[] = [];
            const text = model.getValue();

            for (const lens of lenses) {
                try {
                    const regex = new RegExp(lens.pattern, "g");
                    let match;
                    while ((match = regex.exec(text)) !== null) {
                        const pos = model.getPositionAt(match.index);
                        result.push({
                            range: new monaco.Range(pos.lineNumber, pos.column, pos.lineNumber, pos.column),
                            command: {
                                id: lens.command ?? "",
                                title: lens.title,
                            },
                        });
                    }
                } catch {
                    // Invalid regex
                }
            }

            return { lenses: result, dispose: () => {} };
        },
    });
    disposables.push(d);
}

async function registerColor(monaco: Monaco, langId: string): Promise<void> {
    const raw = await getLanguageData(langId, "color");
    if (!raw) return;
    const file = raw as CDNColorFile;
    const patterns = file.colorPatterns ?? [];
    if (patterns.length === 0) return;

    const d = monaco.languages.registerColorProvider(langId, {
        provideDocumentColors(model) {
            const colors: monacoNs.languages.IColorInformation[] = [];
            const text = model.getValue();

            for (const cp of patterns) {
                try {
                    const regex = new RegExp(cp.pattern, "g");
                    let match;
                    while ((match = regex.exec(text)) !== null) {
                        const startPos = model.getPositionAt(match.index);
                        const endPos = model.getPositionAt(match.index + match[0].length);

                        // Try to parse color from match
                        const colorStr = match[0];
                        const parsed = parseColor(colorStr);
                        if (parsed) {
                            colors.push({
                                range: new monaco.Range(
                                    startPos.lineNumber,
                                    startPos.column,
                                    endPos.lineNumber,
                                    endPos.column,
                                ),
                                color: parsed,
                            });
                        }
                    }
                } catch {
                    // Invalid regex
                }
            }

            return colors;
        },
        provideColorPresentations(model, colorInfo) {
            const { red, green, blue, alpha } = colorInfo.color;
            const toHex = (n: number) => Math.round(n * 255).toString(16).padStart(2, "0");
            const hex = `#${toHex(red)}${toHex(green)}${toHex(blue)}${alpha < 1 ? toHex(alpha) : ""}`;
            return [{ label: hex }];
        },
    });
    disposables.push(d);
}

function parseColor(str: string): monacoNs.languages.IColor | null {
    // Parse hex colors
    const hexMatch = str.match(/^#([0-9a-fA-F]{3,8})$/);
    if (hexMatch) {
        const hex = hexMatch[1];
        if (hex.length === 3) {
            return {
                red: parseInt(hex[0] + hex[0], 16) / 255,
                green: parseInt(hex[1] + hex[1], 16) / 255,
                blue: parseInt(hex[2] + hex[2], 16) / 255,
                alpha: 1,
            };
        } else if (hex.length === 6) {
            return {
                red: parseInt(hex.slice(0, 2), 16) / 255,
                green: parseInt(hex.slice(2, 4), 16) / 255,
                blue: parseInt(hex.slice(4, 6), 16) / 255,
                alpha: 1,
            };
        } else if (hex.length === 8) {
            return {
                red: parseInt(hex.slice(0, 2), 16) / 255,
                green: parseInt(hex.slice(2, 4), 16) / 255,
                blue: parseInt(hex.slice(4, 6), 16) / 255,
                alpha: parseInt(hex.slice(6, 8), 16) / 255,
            };
        }
    }

    // Parse rgb/rgba
    const rgbMatch = str.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)/);
    if (rgbMatch) {
        return {
            red: parseInt(rgbMatch[1], 10) / 255,
            green: parseInt(rgbMatch[2], 10) / 255,
            blue: parseInt(rgbMatch[3], 10) / 255,
            alpha: rgbMatch[4] ? parseFloat(rgbMatch[4]) : 1,
        };
    }

    return null;
}

async function registerRename(monaco: Monaco, langId: string): Promise<void> {
    const raw = await getLanguageData(langId, "rename");
    if (!raw) return;
    const file = raw as CDNRenameFile;

    const d = monaco.languages.registerRenameProvider(langId, {
        provideRenameEdits(model, position, newName) {
            const wordInfo = model.getWordAtPosition(position);
            if (!wordInfo) return null;

            const oldWord = wordInfo.word;
            const text = model.getValue();
            const regex = new RegExp(`\\b${oldWord}\\b`, "g");
            const edits: monacoNs.languages.IWorkspaceTextEdit[] = [];
            let match;

            while ((match = regex.exec(text)) !== null) {
                const startPos = model.getPositionAt(match.index);
                const endPos = model.getPositionAt(match.index + oldWord.length);
                edits.push({
                    resource: model.uri,
                    textEdit: {
                        range: new monaco.Range(
                            startPos.lineNumber,
                            startPos.column,
                            endPos.lineNumber,
                            endPos.column,
                        ),
                        text: newName,
                    },
                    versionId: model.getVersionId(),
                });
            }

            return { edits };
        },
        resolveRenameLocation(model, position) {
            const wordInfo = model.getWordAtPosition(position);
            if (!wordInfo) return null;

            return {
                range: new monaco.Range(
                    position.lineNumber,
                    wordInfo.startColumn,
                    position.lineNumber,
                    wordInfo.endColumn,
                ),
                text: wordInfo.word,
            };
        },
    });
    disposables.push(d);
}

async function registerSelectionRange(monaco: Monaco, langId: string): Promise<void> {
    const raw = await getLanguageData(langId, "selectionRange");
    if (!raw) return;

    const d = monaco.languages.registerSelectionRangeProvider(langId, {
        provideSelectionRanges(model, positions) {
            return positions.map((position) => {
                const ranges: monacoNs.languages.SelectionRange[] = [];
                const wordInfo = model.getWordAtPosition(position);

                if (wordInfo) {
                    ranges.push({
                        range: new monaco.Range(
                            position.lineNumber,
                            wordInfo.startColumn,
                            position.lineNumber,
                            wordInfo.endColumn,
                        ),
                    });
                }

                // Expand to line
                ranges.push({
                    range: new monaco.Range(
                        position.lineNumber,
                        1,
                        position.lineNumber,
                        model.getLineMaxColumn(position.lineNumber),
                    ),
                });

                // Expand to full document
                ranges.push({
                    range: model.getFullModelRange(),
                });

                return ranges;
            });
        },
    });
    disposables.push(d);
}

async function registerLinkedEditingRange(monaco: Monaco, langId: string): Promise<void> {
    const raw = await getLanguageData(langId, "linkedEditingRange");
    if (!raw) return;
    const file = raw as CDNLinkedEditingFile;
    const rules = file.linkedEditing ?? [];
    if (rules.length === 0) return;

    const d = monaco.languages.registerLinkedEditingRangeProvider(langId, {
        provideLinkedEditingRanges(model, position) {
            const wordInfo = model.getWordAtPosition(position);
            if (!wordInfo) return null;

            const word = wordInfo.word;
            const text = model.getValue();
            const regex = new RegExp(`\\b${word}\\b`, "g");
            const ranges: monacoNs.IRange[] = [];
            let match;

            while ((match = regex.exec(text)) !== null) {
                const startPos = model.getPositionAt(match.index);
                const endPos = model.getPositionAt(match.index + word.length);
                ranges.push(new monaco.Range(
                    startPos.lineNumber,
                    startPos.column,
                    endPos.lineNumber,
                    endPos.column,
                ));
            }

            if (ranges.length <= 1) return null;

            return { ranges };
        },
    });
    disposables.push(d);
}

async function registerFormatting(monaco: Monaco, langId: string): Promise<void> {
    const raw = await getLanguageData(langId, "formatting");
    if (!raw) return;
    const file = raw as CDNFormattingFile;

    const d = monaco.languages.registerDocumentFormattingEditProvider(langId, {
        provideDocumentFormattingEdits(model, options) {
            // Basic formatting - normalize whitespace based on options
            const text = model.getValue();
            const tabSize = options.tabSize;
            const insertSpaces = options.insertSpaces;
            const indent = insertSpaces ? " ".repeat(tabSize) : "\t";

            // Simple auto-indent (this is a basic implementation)
            const lines = text.split("\n");
            let indentLevel = 0;
            const formatted = lines.map((line) => {
                const trimmed = line.trim();
                if (trimmed.endsWith("}") || trimmed.endsWith("]") || trimmed.endsWith(")")) {
                    indentLevel = Math.max(0, indentLevel - 1);
                }
                const newLine = indent.repeat(indentLevel) + trimmed;
                if (trimmed.endsWith("{") || trimmed.endsWith("[") || trimmed.endsWith("(")) {
                    indentLevel++;
                }
                return newLine;
            });

            return [
                {
                    range: model.getFullModelRange(),
                    text: formatted.join("\n"),
                },
            ];
        },
    });
    disposables.push(d);
}

async function registerDocumentRangeFormatting(monaco: Monaco, langId: string): Promise<void> {
    const raw = await getLanguageData(langId, "documentRangeFormatting");
    if (!raw) return;

    const d = monaco.languages.registerDocumentRangeFormattingEditProvider(langId, {
        provideDocumentRangeFormattingEdits(model, range, options) {
            const text = model.getValueInRange(range);
            const tabSize = options.tabSize;
            const insertSpaces = options.insertSpaces;
            const indent = insertSpaces ? " ".repeat(tabSize) : "\t";

            const lines = text.split("\n");
            let indentLevel = 0;
            const formatted = lines.map((line) => {
                const trimmed = line.trim();
                if (trimmed.endsWith("}") || trimmed.endsWith("]") || trimmed.endsWith(")")) {
                    indentLevel = Math.max(0, indentLevel - 1);
                }
                const newLine = indent.repeat(indentLevel) + trimmed;
                if (trimmed.endsWith("{") || trimmed.endsWith("[") || trimmed.endsWith("(")) {
                    indentLevel++;
                }
                return newLine;
            });

            return [
                {
                    range,
                    text: formatted.join("\n"),
                },
            ];
        },
    });
    disposables.push(d);
}

async function registerOnTypeFormatting(monaco: Monaco, langId: string): Promise<void> {
    const raw = await getLanguageData(langId, "onTypeFormatting");
    if (!raw) return;

    const d = monaco.languages.registerOnTypeFormattingEditProvider(langId, {
        autoFormatTriggerCharacters: [";", "}", "\n"],
        provideOnTypeFormattingEdits(model, position, ch, options) {
            // Auto-format on specific characters (basic implementation)
            if (ch === "}") {
                const line = model.getLineContent(position.lineNumber);
                const trimmed = line.trim();
                if (trimmed === "}") {
                    // Reduce indent for closing brace
                    const prevLine = position.lineNumber > 1 ? model.getLineContent(position.lineNumber - 1) : "";
                    const prevIndent = prevLine.match(/^(\s*)/)?.[1] ?? "";
                    const tabSize = options.tabSize;
                    const newIndent = prevIndent.length >= tabSize ? prevIndent.slice(tabSize) : "";
                    return [
                        {
                            range: new monaco.Range(
                                position.lineNumber,
                                1,
                                position.lineNumber,
                                line.length + 1,
                            ),
                            text: newIndent + trimmed,
                        },
                    ];
                }
            }
            return [];
        },
    });
    disposables.push(d);
}

async function registerSemanticTokens(monaco: Monaco, langId: string): Promise<void> {
    const raw = await getLanguageData(langId, "semanticTokens");
    if (!raw) return;
    const file = raw as CDNSemanticTokensFile;
    if (!file.tokenTypes?.length) return;

    const legend: monacoNs.languages.SemanticTokensLegend = {
        tokenTypes: file.tokenTypes,
        tokenModifiers: file.tokenModifiers ?? [],
    };

    const d = monaco.languages.registerDocumentSemanticTokensProvider(langId, {
        getLegend: () => legend,
        provideDocumentSemanticTokens() {
            // Semantic tokens require actual parsing - this is a placeholder
            return { data: new Uint32Array(0) };
        },
        releaseDocumentSemanticTokens() {},
    });
    disposables.push(d);
}

async function registerRangeSemanticTokens(monaco: Monaco, langId: string): Promise<void> {
    const raw = await getLanguageData(langId, "rangeSemanticTokens");
    if (!raw) return;
    const file = raw as CDNSemanticTokensFile;
    if (!file.tokenTypes?.length) return;

    const legend: monacoNs.languages.SemanticTokensLegend = {
        tokenTypes: file.tokenTypes,
        tokenModifiers: file.tokenModifiers ?? [],
    };

    const d = monaco.languages.registerDocumentRangeSemanticTokensProvider(langId, {
        getLegend: () => legend,
        provideDocumentRangeSemanticTokens() {
            // Semantic tokens require actual parsing - this is a placeholder
            return { data: new Uint32Array(0) };
        },
    });
    disposables.push(d);
}

async function registerInlineCompletions(monaco: Monaco, langId: string): Promise<void> {
    const raw = await getLanguageData(langId, "inlineCompletions");
    if (!raw) return;
    const file = raw as CDNInlineCompletionsFile;
    const completions = file.inlineCompletions ?? [];
    if (completions.length === 0) return;

    const d = monaco.languages.registerInlineCompletionsProvider(langId, {
        provideInlineCompletions(model, position) {
            const lineContent = model.getLineContent(position.lineNumber);
            const textBefore = lineContent.substring(0, position.column - 1);

            const items: monacoNs.languages.InlineCompletion[] = [];
            for (const c of completions) {
                if (textBefore.endsWith(c.trigger)) {
                    items.push({
                        insertText: c.insertText,
                        range: new monaco.Range(
                            position.lineNumber,
                            position.column,
                            position.lineNumber,
                            position.column,
                        ),
                    });
                }
            }

            return { items };
        },
        disposeInlineCompletions() {},
    });
    disposables.push(d);
}

/* ── Provider Registration Map ─────────────────────────────── */

const providerRegistrars: Record<ProviderType, (monaco: Monaco, langId: string) => Promise<void>> = {
    completion: registerCompletion,
    definition: registerDefinition,
    hover: registerHover,
    codeActions: registerCodeActions,
    documentHighlight: registerDocumentHighlight,
    documentSymbol: registerDocumentSymbol,
    links: registerLinks,
    typeDefinition: registerTypeDefinition,
    references: registerReferences,
    implementation: registerImplementation,
    inlineCompletions: registerInlineCompletions,
    formatting: registerFormatting,
    codeLens: registerCodeLens,
    color: registerColor,
    declaration: registerDeclaration,
    inlayHints: registerInlayHints,
    signatureHelp: registerSignatureHelp,
    foldingRange: registerFoldingRange,
    rename: registerRename,
    selectionRange: registerSelectionRange,
    linkedEditingRange: registerLinkedEditingRange,
    onTypeFormatting: registerOnTypeFormatting,
    documentRangeFormatting: registerDocumentRangeFormatting,
    semanticTokens: registerSemanticTokens,
    rangeSemanticTokens: registerRangeSemanticTokens,
};

/* ── Register ALL providers for a single language ──────────── */

async function registerForLanguage(monaco: Monaco, langId: string): Promise<void> {
    if (registeredLangs.has(langId)) return;
    registeredLangs.add(langId);

    // Register all provider types in parallel
    const results = await Promise.allSettled(
        PROVIDER_TYPES.map(async (type) => {
            try {
                await providerRegistrars[type](monaco, langId);
            } catch (e) {
                console.warn(`[context-engine] Failed to register ${type} for ${langId}:`, e);
            }
        }),
    );

    const successCount = results.filter((r) => r.status === "fulfilled").length;
    console.log(`[context-engine] Registered ${successCount}/${PROVIDER_TYPES.length} providers for ${langId}`);
}

/* ── Public API ────────────────────────────────────────────── */

/**
 * Register completion, hover, and definition providers for ALL
 * installed context-engine language packs.
 *
 * Safe to call multiple times — providers are only registered once per language.
 */
export async function registerContextEngineProviders(monaco: Monaco): Promise<void> {
    try {
        const installed = await getInstalledLanguages();
        await Promise.allSettled(
            installed.map((lang) => registerForLanguage(monaco, lang.id)),
        );
        if (installed.length > 0) {
            console.log(
                `[context-engine] Registered providers for ${installed.length} language(s):`,
                installed.map((l) => l.id).join(", "),
            );
        }
    } catch (e) {
        console.warn("[context-engine] Failed to register providers:", e);
    }
}

/**
 * Register providers for a single language (e.g. after installing a new pack).
 */
export async function registerContextEngineForLanguage(
    monaco: Monaco,
    langId: string,
): Promise<void> {
    await registerForLanguage(monaco, langId);
}

/**
 * Dispose all registered context-engine providers.
 * Call before re-registering (e.g. on uninstall).
 */
export function disposeContextEngineProviders(): void {
    for (const d of disposables) d.dispose();
    disposables.length = 0;
    registeredLangs.clear();
}
