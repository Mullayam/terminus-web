/**
 * @module lib/contextEngineConverters
 *
 * Converts backend interface data (from `./lsp/interfaces/`) into
 * Monaco-register-friendly provider objects.
 *
 * Each function takes typed backend data and returns the provider object
 * that can be passed directly to `monaco.languages.register*Provider()`.
 */

import type * as monacoNs from "monaco-editor";
import type {
    CompletionData,
    HoverData,
    DefinitionData,
    DeclarationData,
    TypeDefinitionData,
    ImplementationData,
    ReferencesData,
    DocumentHighlightData,
    DocumentSymbolData,
    CodeActionsData,
    LinksData,
    SignatureHelpData,
    FoldingRangeData,
    InlayHintsData,
    CodeLensData,
    ColorData,
    RenameData,
    SelectionRangeData,
    LinkedEditingRangeData,
    FormattingData,
    RangeFormattingData,
    OnTypeFormattingData,
    SemanticTokensData,
    RangeSemanticTokensData,
    InlineCompletionsData,
} from "../lsp/interfaces";

type Monaco = typeof monacoNs;

/* â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

function resolveCompletionKind(
    monaco: Monaco,
    kind?: number,
): monacoNs.languages.CompletionItemKind {
    if (kind !== undefined && kind >= 0 && kind <= 27) {
        return kind as monacoNs.languages.CompletionItemKind;
    }
    return monaco.languages.CompletionItemKind.Text;
}

function parseColor(str: string): monacoNs.languages.IColor | null {
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

function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Resolve documentation that may be a string, { value: string }, or undefined */
function resolveDocValue(doc: unknown): string {
    if (!doc) return "";
    if (typeof doc === "string") return doc;
    if (typeof doc === "object" && "value" in (doc as Record<string, unknown>)) {
        return String((doc as Record<string, unknown>).value ?? "");
    }
    return "";
}

/* â”€â”€ Converter Functions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

export function toCompletionProvider(
    monaco: Monaco,
    data: CompletionData,
): monacoNs.languages.CompletionItemProvider {
    const completions = data.completions ?? [];
    return {
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
                const doc = resolveDocValue(c.documentation);
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
    };
}

export function toHoverProvider(
    monaco: Monaco,
    data: HoverData,
): monacoNs.languages.HoverProvider {
    const hovers = data.hovers ?? {};
    return {
        provideHover(model, position) {
            const wordInfo = model.getWordAtPosition(position);
            if (!wordInfo) return null;

            const entry = hovers[wordInfo.word];
            if (!entry) return null;

            // Handle contents being an array of { value } or a single string
            let contents: monacoNs.IMarkdownString[];
            if (Array.isArray(entry.contents) && entry.contents.length > 0) {
                contents = entry.contents.map((c) => ({
                    value: typeof c === "string" ? c : (c.value ?? ""),
                    isTrusted: true,
                }));
            } else if (typeof entry.contents === "string") {
                contents = [{ value: entry.contents, isTrusted: true }];
            } else {
                return null;
            }

            if (contents.length === 0) return null;

            return {
                range: new monaco.Range(
                    position.lineNumber,
                    wordInfo.startColumn,
                    position.lineNumber,
                    wordInfo.endColumn,
                ),
                contents,
            };
        },
    };
}

export function toDefinitionProvider(
    monaco: Monaco,
    data: DefinitionData,
    langId: string,
): { definitionProvider: monacoNs.languages.DefinitionProvider; hoverProvider: monacoNs.languages.HoverProvider } {
    const defs = data.definitions ?? {};

    const definitionProvider: monacoNs.languages.DefinitionProvider = {
        provideDefinition(model, position) {
            const wordInfo = model.getWordAtPosition(position);
            if (!wordInfo) return null;

            const entry = defs[wordInfo.word];
            if (!entry) return null;

            // Remote-providers format: entry has uri/range (JsonLocation)
            const any = entry as any;
            if (any.uri || any.range) {
                return {
                    uri: any.uri ? monaco.Uri.parse(any.uri as string) : model.uri,
                    range: (any.range as monacoNs.IRange) ?? { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 },
                };
            }

            // lsp/interfaces format: no uri/range available
            return null;
        },
    };

    const hoverProvider: monacoNs.languages.HoverProvider = {
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

            // Also handle remote-providers format: contents array
            const any = entry as any;
            if (parts.length === 0 && Array.isArray(any.contents)) {
                for (const c of any.contents as Array<{ value?: string }>) {
                    if (c.value) parts.push(c.value);
                }
            }

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
    };

    return { definitionProvider, hoverProvider };
}

export function toDeclarationProvider(
    monaco: Monaco,
    data: DeclarationData,
): monacoNs.languages.DeclarationProvider {
    const defs = data.declarations ?? {};
    return {
        provideDeclaration(model, position) {
            const wordInfo = model.getWordAtPosition(position);
            if (!wordInfo) return null;

            const entry = defs[wordInfo.word];
            if (!entry) return null;

            // Remote-providers format: entry has uri/range
            const any = entry as any;
            if (any.uri || any.range) {
                return {
                    uri: any.uri ? monaco.Uri.parse(any.uri as string) : model.uri,
                    range: (any.range as monacoNs.IRange) ?? { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 },
                };
            }

            return null;
        },
    };
}

export function toTypeDefinitionProvider(
    monaco: Monaco,
    data: TypeDefinitionData,
): monacoNs.languages.TypeDefinitionProvider {
    const defs = data.typeDefinitions ?? {};
    return {
        provideTypeDefinition(model, position) {
            const wordInfo = model.getWordAtPosition(position);
            if (!wordInfo) return null;

            const entry = defs[wordInfo.word];
            if (!entry) return null;

            // Remote-providers format: entry has uri/range
            const any = entry as any;
            if (any.uri || any.range) {
                return {
                    uri: any.uri ? monaco.Uri.parse(any.uri as string) : model.uri,
                    range: (any.range as monacoNs.IRange) ?? { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 },
                };
            }

            return null;
        },
    };
}

export function toImplementationProvider(
    monaco: Monaco,
    data: ImplementationData,
): monacoNs.languages.ImplementationProvider {
    const patterns = data.implementationPatterns ?? [];
    return {
        provideImplementation(model, position) {
            const wordInfo = model.getWordAtPosition(position);
            if (!wordInfo) return null;

            const text = model.getValue();
            const results: monacoNs.languages.Location[] = [];

            for (const ip of patterns) {
                try {
                    const regex = new RegExp(ip.pattern, "g");
                    let match;
                    while ((match = regex.exec(text)) !== null) {
                        if (match[0].includes(wordInfo.word)) {
                            const startPos = model.getPositionAt(match.index);
                            const endPos = model.getPositionAt(match.index + match[0].length);
                            results.push({
                                uri: model.uri,
                                range: new monaco.Range(
                                    startPos.lineNumber,
                                    startPos.column,
                                    endPos.lineNumber,
                                    endPos.column,
                                ),
                            });
                        }
                    }
                } catch { /* invalid regex */ }
            }

            return results.length > 0 ? results : null;
        },
    };
}

export function toReferenceProvider(
    monaco: Monaco,
    data: ReferencesData,
): monacoNs.languages.ReferenceProvider {
    const refPatterns = data.referencePatterns ?? [];
    return {
        provideReferences(model, position) {
            const wordInfo = model.getWordAtPosition(position);
            if (!wordInfo) return null;

            const refPattern = refPatterns.find((rp) => rp.symbol === wordInfo.word);
            if (!refPattern) {
                // Fallback: find all occurrences of the word in the document
                const matches = model.findMatches(
                    `\\b${escapeRegex(wordInfo.word)}\\b`, true, true, true, null, false,
                );
                if (matches.length === 0) return null;
                return matches.map((m) => ({ uri: model.uri, range: m.range }));
            }

            const text = model.getValue();
            const locations: monacoNs.languages.Location[] = [];

            for (const pattern of refPattern.patterns) {
                try {
                    const regex = new RegExp(pattern, "g");
                    let match;
                    while ((match = regex.exec(text)) !== null) {
                        const startPos = model.getPositionAt(match.index);
                        const endPos = model.getPositionAt(match.index + match[0].length);
                        locations.push({
                            uri: model.uri,
                            range: new monaco.Range(
                                startPos.lineNumber,
                                startPos.column,
                                endPos.lineNumber,
                                endPos.column,
                            ),
                        });
                    }
                } catch { /* invalid regex */ }
            }

            return locations.length > 0 ? locations : null;
        },
    };
}

export function toDocumentHighlightProvider(
    monaco: Monaco,
    data: DocumentHighlightData,
): monacoNs.languages.DocumentHighlightProvider {
    const highlights = data.highlights ?? {};
    return {
        provideDocumentHighlights(model, position) {
            const wordInfo = model.getWordAtPosition(position);
            if (!wordInfo) return null;

            const entry = highlights[wordInfo.word];
            if (!entry) return null;

            // Resolve kind: number (lsp/interfaces) or string (remote-providers)
            let kind: monacoNs.languages.DocumentHighlightKind;
            if (typeof entry.kind === "number") {
                kind = entry.kind as monacoNs.languages.DocumentHighlightKind;
            } else if (entry.kind === "write" || (entry as any).kind === "write") {
                kind = monaco.languages.DocumentHighlightKind.Write;
            } else {
                kind = monaco.languages.DocumentHighlightKind.Read;
            }

            // Use model.findMatches for reliable word-boundary search
            const matches = model.findMatches(
                `\\b${escapeRegex(wordInfo.word)}\\b`, true, true, true, null, false,
            );

            return matches.map((m) => ({ range: m.range, kind }));
        },
    };
}

export function toDocumentSymbolProvider(
    _monaco: Monaco,
    data: DocumentSymbolData,
): monacoNs.languages.DocumentSymbolProvider {
    const patterns = data.symbolPatterns ?? [];
    return {
        provideDocumentSymbols(model) {
            const text = model.getValue();
            const symbols: monacoNs.languages.DocumentSymbol[] = [];

            for (const sp of patterns) {
                try {
                    const regex = new RegExp(sp.pattern, "gm");
                    let match;
                    while ((match = regex.exec(text)) !== null) {
                        const name = match[sp.captureGroup] ?? match[0];
                        const startPos = model.getPositionAt(match.index);
                        const endPos = model.getPositionAt(match.index + match[0].length);
                        const range: monacoNs.IRange = {
                            startLineNumber: startPos.lineNumber,
                            startColumn: startPos.column,
                            endLineNumber: endPos.lineNumber,
                            endColumn: endPos.column,
                        };
                        symbols.push({
                            name,
                            detail: sp.type ?? "",
                            kind: sp.kind as monacoNs.languages.SymbolKind,
                            range,
                            selectionRange: range,
                            tags: [],
                        });
                    }
                } catch { /* invalid regex */ }
            }

            return symbols;
        },
    };
}

export function toCodeActionProvider(
    _monaco: Monaco,
    data: CodeActionsData,
): monacoNs.languages.CodeActionProvider {
    const actions = data.codeActions ?? [];
    return {
        provideCodeActions(model, range, context) {
            const lineContent = model.getLineContent(range.startLineNumber);
            const codeActions: monacoNs.languages.CodeAction[] = [];

            for (const a of actions) {
                if (a.pattern) {
                    try {
                        const regex = new RegExp(a.pattern, a.flags ?? "");
                        if (!regex.test(lineContent)) continue;
                    } catch { continue; }
                }

                if (a.diagnostic && context.markers.length === 0) continue;

                codeActions.push({
                    title: a.title,
                    kind: a.kind,
                    isPreferred: a.isPreferred,
                    // Support remote-providers format: command & edit properties
                    ...((a as any).command ? { command: (a as any).command } : {}),
                    ...((a as any).edit ? { edit: (a as any).edit } : {}),
                });
            }

            return { actions: codeActions, dispose: () => {} };
        },
    };
}

export function toLinkProvider(
    monaco: Monaco,
    data: LinksData,
): monacoNs.languages.LinkProvider {
    const linkPatterns = data.linkPatterns ?? [];
    return {
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
                        const captured = match[lp.captureGroup] ?? match[0];
                        links.push({
                            range: new monaco.Range(
                                startPos.lineNumber,
                                startPos.column,
                                endPos.lineNumber,
                                endPos.column,
                            ),
                            url: captured,
                            tooltip: lp.tooltip,
                        });
                    }
                } catch { /* invalid regex */ }
            }

            return { links };
        },
    };
}

export function toSignatureHelpProvider(
    _monaco: Monaco,
    data: SignatureHelpData,
): monacoNs.languages.SignatureHelpProvider {
    const signatures = data.signatures ?? [];
    return {
        signatureHelpTriggerCharacters: data.triggerCharacters ?? ["(", ","],
        signatureHelpRetriggerCharacters: data.retriggerCharacters ?? [","],
        provideSignatureHelp(model, position) {
            const lineContent = model.getLineContent(position.lineNumber);
            const textBefore = lineContent.substring(0, position.column - 1);

            const funcMatch = textBefore.match(/(\w+)\s*\([^)]*$/);
            if (!funcMatch) return null;

            return {
                value: {
                    signatures: signatures.map((s) => ({
                        label: s.label,
                        documentation: resolveDocValue(s.documentation) || undefined,
                        parameters: s.parameters?.map((p) => ({
                            label: p.label,
                            documentation: resolveDocValue(p.documentation) || undefined,
                        })) ?? [],
                    })),
                    activeSignature: 0,
                    activeParameter: (textBefore.match(/,/g) || []).length,
                },
                dispose: () => {},
            };
        },
    };
}

export function toFoldingRangeProvider(
    monaco: Monaco,
    data: FoldingRangeData,
): monacoNs.languages.FoldingRangeProvider {
    const rules = data.foldingRules ?? [];
    return {
        provideFoldingRanges(model) {
            const ranges: monacoNs.languages.FoldingRange[] = [];
            const lines = model.getLinesContent();

            for (const rule of rules) {
                try {
                    const startRegex = new RegExp(rule.startPattern);
                    const endRegex = new RegExp(rule.endPattern);
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
                } catch { /* invalid regex */ }
            }

            return ranges;
        },
    };
}

export function toInlayHintsProvider(
    _monaco: Monaco,
    data: InlayHintsData,
): monacoNs.languages.InlayHintsProvider {
    const hintPatterns = data.inlayHintPatterns ?? [];
    return {
        provideInlayHints(model, range) {
            const hints: monacoNs.languages.InlayHint[] = [];
            const text = model.getValueInRange(range);
            const rangeStartOffset = model.getOffsetAt({
                lineNumber: range.startLineNumber,
                column: range.startColumn,
            });

            for (const hp of hintPatterns) {
                try {
                    const regex = new RegExp(hp.pattern, "g");
                    let match;
                    while ((match = regex.exec(text)) !== null) {
                        const offset = rangeStartOffset + match.index +
                            (hp.position === "after" ? match[0].length : 0);
                        const pos = model.getPositionAt(offset);
                        hints.push({
                            label: hp.label,
                            kind: hp.kind as monacoNs.languages.InlayHintKind,
                            position: pos,
                            paddingLeft: hp.paddingLeft,
                            paddingRight: hp.paddingRight,
                        });
                    }
                } catch { /* invalid regex */ }
            }

            return { hints, dispose: () => {} };
        },
    };
}

export function toCodeLensProvider(
    monaco: Monaco,
    data: CodeLensData,
): monacoNs.languages.CodeLensProvider {
    const lenses = data.codeLensPatterns ?? [];
    return {
        provideCodeLenses(model) {
            const codeLenses: monacoNs.languages.CodeLens[] = [];
            const text = model.getValue();

            for (const lens of lenses) {
                try {
                    const regex = new RegExp(lens.pattern, "g");
                    let match;
                    while ((match = regex.exec(text)) !== null) {
                        const name = match[lens.captureGroup] ?? match[0];
                        const pos = model.getPositionAt(match.index);

                        // Support both shapes: { commandId, title } and { command: { id, title } }
                        const any = lens as any;
                        let command: monacoNs.languages.Command;
                        if (any.command && typeof any.command === "object") {
                            command = any.command as monacoNs.languages.Command;
                        } else {
                            command = {
                                id: lens.commandId || "noop",
                                title: (lens.title ?? "").replace("$1", name),
                            };
                        }

                        codeLenses.push({
                            range: new monaco.Range(pos.lineNumber, pos.column, pos.lineNumber, pos.column),
                            command,
                        });
                    }
                } catch { /* invalid regex */ }
            }

            return { lenses: codeLenses, dispose: () => {} };
        },
    };
}

export function toColorProvider(
    monaco: Monaco,
    data: ColorData,
): monacoNs.languages.DocumentColorProvider {
    const patterns = data.colorPatterns ?? [];
    return {
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
                } catch { /* invalid regex */ }
            }

            return colors;
        },
        provideColorPresentations(_model, colorInfo) {
            const { red, green, blue, alpha } = colorInfo.color;
            const toHex = (n: number) => Math.round(n * 255).toString(16).padStart(2, "0");
            const hex = `#${toHex(red)}${toHex(green)}${toHex(blue)}${alpha < 1 ? toHex(alpha) : ""}`;
            return [{ label: hex }];
        },
    };
}

export function toRenameProvider(
    monaco: Monaco,
    _data: RenameData,
): monacoNs.languages.RenameProvider {
    return {
        provideRenameEdits(model, position, newName) {
            const wordInfo = model.getWordAtPosition(position);
            if (!wordInfo) return null;

            const oldWord = wordInfo.word;
            const matches = model.findMatches(
                `\\b${escapeRegex(oldWord)}\\b`, true, true, true, null, false,
            );
            const edits: monacoNs.languages.IWorkspaceTextEdit[] = matches.map((m) => ({
                resource: model.uri,
                textEdit: { range: m.range, text: newName },
                versionId: model.getVersionId(),
            }));

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
    };
}

export function toSelectionRangeProvider(
    monaco: Monaco,
    _data: SelectionRangeData,
): monacoNs.languages.SelectionRangeProvider {
    return {
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

                ranges.push({
                    range: new monaco.Range(
                        position.lineNumber,
                        1,
                        position.lineNumber,
                        model.getLineMaxColumn(position.lineNumber),
                    ),
                });

                ranges.push({
                    range: model.getFullModelRange(),
                });

                return ranges;
            });
        },
    };
}

export function toLinkedEditingRangeProvider(
    monaco: Monaco,
    _data: LinkedEditingRangeData,
): monacoNs.languages.LinkedEditingRangeProvider {
    return {
        provideLinkedEditingRanges(model, position) {
            const wordInfo = model.getWordAtPosition(position);
            if (!wordInfo) return null;

            const matches = model.findMatches(
                `\\b${escapeRegex(wordInfo.word)}\\b`, true, true, true, null, false,
            );

            if (matches.length <= 1) return null;
            return { ranges: matches.map((m) => m.range) };
        },
    };
}

export function toFormattingProvider(
    _monaco: Monaco,
    data: FormattingData,
): monacoNs.languages.DocumentFormattingEditProvider {
    const formatting = data.formatting;
    return {
        provideDocumentFormattingEdits(model, options) {
            const tabSize = options.tabSize || formatting.defaultTabSize;
            const insertSpaces = options.insertSpaces !== undefined
                ? options.insertSpaces
                : formatting.defaultInsertSpaces;

            let text = model.getValue();

            if (insertSpaces) {
                text = text.replace(/\t/g, " ".repeat(tabSize));
            }

            for (const rule of formatting.rules) {
                const flags = rule.flags ?? "gm";
                try {
                    const regex = new RegExp(rule.pattern, flags);
                    text = text.replace(regex, rule.replacement);
                } catch { /* invalid regex */ }
            }

            if (formatting.indentation) {
                const { increasePattern, decreasePattern } = formatting.indentation;
                try {
                    const incRegex = new RegExp(increasePattern);
                    const decRegex = new RegExp(decreasePattern);
                    const indent = insertSpaces ? " ".repeat(tabSize) : "\t";
                    const lines = text.split("\n");
                    let indentLevel = 0;
                    text = lines.map((line) => {
                        const trimmed = line.trim();
                        if (decRegex.test(trimmed)) {
                            indentLevel = Math.max(0, indentLevel - 1);
                        }
                        const newLine = indent.repeat(indentLevel) + trimmed;
                        if (incRegex.test(trimmed)) {
                            indentLevel++;
                        }
                        return newLine;
                    }).join("\n");
                } catch { /* invalid patterns */ }
            }

            if (text === model.getValue()) return [];

            return [{
                range: model.getFullModelRange(),
                text,
            }];
        },
    };
}

export function toRangeFormattingProvider(
    _monaco: Monaco,
    data: RangeFormattingData,
): monacoNs.languages.DocumentRangeFormattingEditProvider {
    const rules = data.rangeFormattingRules ?? [];
    return {
        provideDocumentRangeFormattingEdits(model, range, options) {
            const text = model.getValueInRange(range);
            const tabSize = options.tabSize || data.defaultOptions?.tabSize || 4;
            const insertSpaces = options.insertSpaces !== undefined
                ? options.insertSpaces
                : (data.defaultOptions?.insertSpaces ?? true);

            let formatted = text;
            for (const rule of rules) {
                try {
                    const regex = new RegExp(rule.pattern, "gm");
                    formatted = formatted.replace(regex, rule.action ?? (rule as any).replacement ?? "");
                } catch { /* invalid regex */ }
            }

            if (formatted === text) return [];

            return [{
                range,
                text: formatted,
            }];
        },
    };
}

export function toOnTypeFormattingProvider(
    monaco: Monaco,
    data: OnTypeFormattingData,
): monacoNs.languages.OnTypeFormattingEditProvider {
    const triggerChars = data.autoFormatTriggerCharacters ?? [";", "}", "\n"];
    const formatRules = data.formatRules ?? [];
    return {
        autoFormatTriggerCharacters: triggerChars,
        provideOnTypeFormattingEdits(model, position, ch) {
            // Support lsp format: { trigger, rules: [{pattern, action}] }
            const trigger = formatRules.find((t) =>
                t.trigger === ch || (t as any).triggerCharacter === ch
            );
            if (!trigger) return [];

            const line = model.getLineContent(position.lineNumber);
            const edits: monacoNs.languages.TextEdit[] = [];

            // Support both nested rules and flat format
            const rules = trigger.rules ?? [trigger as any];
            for (const rule of rules) {
                try {
                    const regex = new RegExp(rule.pattern);
                    if (regex.test(line)) {
                        const newText = line.replace(regex, rule.action ?? (rule as any).replacement ?? "");
                        if (newText !== line) {
                            edits.push({
                                range: new monaco.Range(
                                    position.lineNumber,
                                    1,
                                    position.lineNumber,
                                    line.length + 1,
                                ),
                                text: newText,
                            });
                        }
                    }
                } catch { /* invalid regex */ }
            }

            return edits;
        },
    };
}

export function toSemanticTokensProvider(
    _monaco: Monaco,
    data: SemanticTokensData,
): monacoNs.languages.DocumentSemanticTokensProvider {
    const legend: monacoNs.languages.SemanticTokensLegend = {
        tokenTypes: data.tokenLegend.tokenTypes,
        tokenModifiers: data.tokenLegend.tokenModifiers ?? [],
    };

    return {
        getLegend: () => legend,
        provideDocumentSemanticTokens() {
            return { data: new Uint32Array(0) };
        },
        releaseDocumentSemanticTokens() {},
    };
}

export function toRangeSemanticTokensProvider(
    _monaco: Monaco,
    data: RangeSemanticTokensData,
): monacoNs.languages.DocumentRangeSemanticTokensProvider {
    const legend: monacoNs.languages.SemanticTokensLegend = {
        tokenTypes: data.tokenLegend.tokenTypes,
        tokenModifiers: data.tokenLegend.tokenModifiers ?? [],
    };

    return {
        getLegend: () => legend,
        provideDocumentRangeSemanticTokens() {
            return { data: new Uint32Array(0) };
        },
    };
}

export function toInlineCompletionsProvider(
    monaco: Monaco,
    data: InlineCompletionsData,
): monacoNs.languages.InlineCompletionsProvider {
    const completions = data.inlineCompletions ?? [];
    return {
        provideInlineCompletions(model, position) {
            const lineContent = model.getLineContent(position.lineNumber);
            const textBefore = lineContent.substring(0, position.column - 1);

            const items: monacoNs.languages.InlineCompletion[] = [];
            for (const c of completions) {
                try {
                    const regex = new RegExp(c.triggerPattern);
                    if (regex.test(textBefore)) {
                        items.push({
                            insertText: c.insertText,
                            range: new monaco.Range(
                                position.lineNumber,
                                position.column,
                                position.lineNumber,
                                position.column,
                            ),
                            completeBracketPairs: c.completeBracketPairs,
                        });
                    }
                } catch { /* invalid regex */ }
            }

            return { items };
        },
        disposeInlineCompletions() {},
    };
}
