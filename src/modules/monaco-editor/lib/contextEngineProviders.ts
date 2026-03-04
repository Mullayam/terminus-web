/**
 * @module lib/contextEngineProviders
 *
 * Registers Monaco completion, hover, and definition providers
 * from installed @enjoys/context-engine language packs (IndexedDB).
 *
 * Data format (from CDN):
 *
 * completion/{lang}.json → { language, completions: [{ label, kind, detail, documentation, insertText, insertTextRules, sortText }] }
 * hover/{lang}.json      → { language, hovers: { [word]: { contents: [{ value }] } } }
 * defination/{lang}.json → { language, definitions: { [word]: { signature, description, type, module } } }
 */

import type * as monacoNs from "monaco-editor";
import {
    getInstalledLanguages,
    getLanguageData,
} from "@/lib/context-engine/contextEngineStorage";

type Monaco = typeof monacoNs;

/* ── Tracked disposables ───────────────────────────────────── */

const disposables: monacoNs.IDisposable[] = [];
const registeredLangs = new Set<string>();

/* ── Types matching CDN data format ────────────────────────── */

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
}

interface CDNDefinitionFile {
    language: string;
    definitions: Record<string, CDNDefinitionEntry>;
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

/* ── Register providers for a single language ──────────────── */

async function registerForLanguage(monaco: Monaco, langId: string): Promise<void> {
    if (registeredLangs.has(langId)) return;
    registeredLangs.add(langId);

    // ── Completion provider ────────────────────────────
    try {
        const raw = await getLanguageData(langId, "completion");
        if (raw) {
            const file = raw as CDNCompletionFile;
            const completions = file.completions ?? [];
            if (completions.length > 0) {
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
        }
    } catch (e) {
        console.warn(`[context-engine] Failed to register completions for ${langId}:`, e);
    }

    // ── Hover provider ─────────────────────────────────
    try {
        const raw = await getLanguageData(langId, "hover");
        if (raw) {
            const file = raw as CDNHoverFile;
            const hovers = file.hovers ?? {};
            if (Object.keys(hovers).length > 0) {
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
        }
    } catch (e) {
        console.warn(`[context-engine] Failed to register hover for ${langId}:`, e);
    }

    // ── Definition provider (peek definition) ──────────
    try {
        const raw = await getLanguageData(langId, "defination");
        if (raw) {
            const file = raw as CDNDefinitionFile;
            const defs = file.definitions ?? {};
            if (Object.keys(defs).length > 0) {
                const d = monaco.languages.registerHoverProvider(langId, {
                    provideHover(model, position) {
                        const wordInfo = model.getWordAtPosition(position);
                        if (!wordInfo) return null;

                        const entry = defs[wordInfo.word];
                        if (!entry) return null;

                        // Show definition as a hover with signature
                        const parts: string[] = [];
                        if (entry.signature) {
                            parts.push(`\`\`\`${langId}\n${entry.signature}\n\`\`\``);
                        }
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
                disposables.push(d);
            }
        }
    } catch (e) {
        console.warn(`[context-engine] Failed to register definitions for ${langId}:`, e);
    }
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
