/**
 * @module lib/contextEngineProviders
 *
 * Registers ALL Monaco language providers from installed @enjoys/context-engine
 * language packs (IndexedDB). Supports 25 provider types.
 *
 * Backend data shapes are defined in `./lsp/interfaces/`.
 * Conversion logic lives in `./contextEngineConverters`.
 */

import type * as monacoNs from "monaco-editor";
import {
    getInstalledLanguages,
    getLanguageData,
} from "@/lib/context-engine/contextEngineStorage";
import { PROVIDER_TYPES, type ProviderType } from "@/lib/context-engine/contextEngineApi";
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
} from "./lsp/interfaces";
import {
    toCompletionProvider,
    toHoverProvider,
    toDefinitionProvider,
    toDeclarationProvider,
    toTypeDefinitionProvider,
    toImplementationProvider,
    toReferenceProvider,
    toDocumentHighlightProvider,
    toDocumentSymbolProvider,
    toCodeActionProvider,
    toLinkProvider,
    toSignatureHelpProvider,
    toFoldingRangeProvider,
    toInlayHintsProvider,
    toCodeLensProvider,
    toColorProvider,
    toRenameProvider,
    toSelectionRangeProvider,
    toLinkedEditingRangeProvider,
    toFormattingProvider,
    toRangeFormattingProvider,
    toOnTypeFormattingProvider,
    toSemanticTokensProvider,
    toRangeSemanticTokensProvider,
    toInlineCompletionsProvider,
} from "./contextEngineConverters";

type Monaco = typeof monacoNs;

/* ── Tracked disposables ───────────────────────────────────── */

const disposables: monacoNs.IDisposable[] = [];
const registeredLangs = new Set<string>();

/* ── Individual Provider Registrars ────────────────────────── */

async function registerCompletion(monaco: Monaco, langId: string): Promise<void> {
    const raw = await getLanguageData(langId, "completion") as Record<string, any> | null;
    if (!raw) return;
    const completions = raw.completions ?? raw.items;
    if (!completions?.length) return;
    const data = { ...raw, completions } as CompletionData;
    disposables.push(monaco.languages.registerCompletionItemProvider(langId, toCompletionProvider(monaco, data)));
}

async function registerHover(monaco: Monaco, langId: string): Promise<void> {
    const raw = await getLanguageData(langId, "hover") as Record<string, any> | null;
    if (!raw) return;
    const hovers = raw.hovers ?? raw.entries;
    if (!hovers || !Object.keys(hovers).length) return;
    const data = { ...raw, hovers } as HoverData;
    disposables.push(monaco.languages.registerHoverProvider(langId, toHoverProvider(monaco, data)));
}

async function registerDefinition(monaco: Monaco, langId: string): Promise<void> {
    const raw = await getLanguageData(langId, "definition") as Record<string, any> | null;
    if (!raw) return;
    const definitions = raw.definitions ?? raw.entries;
    if (!definitions || !Object.keys(definitions).length) return;
    const data = { ...raw, definitions } as DefinitionData;
    const { definitionProvider, hoverProvider } = toDefinitionProvider(monaco, data, langId);
    disposables.push(monaco.languages.registerDefinitionProvider(langId, definitionProvider));
    disposables.push(monaco.languages.registerHoverProvider(langId, hoverProvider));
}

async function registerDeclaration(monaco: Monaco, langId: string): Promise<void> {
    const raw = await getLanguageData(langId, "declaration") as Record<string, any> | null;
    if (!raw) return;
    const declarations = raw.declarations ?? raw.entries;
    if (!declarations || !Object.keys(declarations).length) return;
    const data = { ...raw, declarations } as DeclarationData;
    disposables.push(monaco.languages.registerDeclarationProvider(langId, toDeclarationProvider(monaco, data)));
}

async function registerTypeDefinition(monaco: Monaco, langId: string): Promise<void> {
    const raw = await getLanguageData(langId, "typeDefinition") as Record<string, any> | null;
    if (!raw) return;
    const typeDefinitions = raw.typeDefinitions ?? raw.entries;
    if (!typeDefinitions || !Object.keys(typeDefinitions).length) return;
    const data = { ...raw, typeDefinitions } as TypeDefinitionData;
    disposables.push(monaco.languages.registerTypeDefinitionProvider(langId, toTypeDefinitionProvider(monaco, data)));
}

async function registerImplementation(monaco: Monaco, langId: string): Promise<void> {
    const raw = await getLanguageData(langId, "implementation") as Record<string, any> | null;
    if (!raw) return;
    const implementationPatterns = raw.implementationPatterns ?? [];
    if (!implementationPatterns.length && !raw.entries) return;
    const data = { ...raw, implementationPatterns } as ImplementationData;
    disposables.push(monaco.languages.registerImplementationProvider(langId, toImplementationProvider(monaco, data)));
}

async function registerReferences(monaco: Monaco, langId: string): Promise<void> {
    const raw = await getLanguageData(langId, "references") as Record<string, any> | null;
    if (!raw) return;
    const referencePatterns = raw.referencePatterns ?? [];
    if (!referencePatterns.length && !raw.entries) return;
    const data = { ...raw, referencePatterns } as ReferencesData;
    disposables.push(monaco.languages.registerReferenceProvider(langId, toReferenceProvider(monaco, data)));
}

async function registerDocumentHighlight(monaco: Monaco, langId: string): Promise<void> {
    const raw = await getLanguageData(langId, "documentHighlight") as Record<string, any> | null;
    if (!raw) return;
    const highlights = raw.highlights ?? raw.entries;
    if (!highlights || !Object.keys(highlights).length) return;
    const data = { ...raw, highlights } as DocumentHighlightData;
    disposables.push(monaco.languages.registerDocumentHighlightProvider(langId, toDocumentHighlightProvider(monaco, data)));
}

async function registerDocumentSymbol(monaco: Monaco, langId: string): Promise<void> {
    const raw = await getLanguageData(langId, "documentSymbol") as Record<string, any> | null;
    if (!raw) return;
    const symbolPatterns = raw.symbolPatterns ?? raw.symbols;
    if (!symbolPatterns?.length) return;
    const data = { ...raw, symbolPatterns } as DocumentSymbolData;
    disposables.push(monaco.languages.registerDocumentSymbolProvider(langId, toDocumentSymbolProvider(monaco, data)));
}

async function registerCodeActions(monaco: Monaco, langId: string): Promise<void> {
    const raw = await getLanguageData(langId, "codeActions") as Record<string, any> | null;
    if (!raw) return;
    const codeActions = raw.codeActions ?? raw.actions;
    if (!codeActions?.length) return;
    const data = { ...raw, codeActions } as CodeActionsData;
    disposables.push(monaco.languages.registerCodeActionProvider(langId, toCodeActionProvider(monaco, data)));
}

async function registerLinks(monaco: Monaco, langId: string): Promise<void> {
    const raw = await getLanguageData(langId, "links") as Record<string, any> | null;
    if (!raw) return;
    const linkPatterns = raw.linkPatterns ?? raw.patterns;
    if (!linkPatterns?.length) return;
    const data = { ...raw, linkPatterns } as LinksData;
    disposables.push(monaco.languages.registerLinkProvider(langId, toLinkProvider(monaco, data)));
}

async function registerSignatureHelp(monaco: Monaco, langId: string): Promise<void> {
    const raw = await getLanguageData(langId, "signatureHelp") as Record<string, any> | null;
    if (!raw) return;
    if (!raw.signatures?.length) return;
    disposables.push(monaco.languages.registerSignatureHelpProvider(langId, toSignatureHelpProvider(monaco, raw as SignatureHelpData)));
}

async function registerFoldingRange(monaco: Monaco, langId: string): Promise<void> {
    const raw = await getLanguageData(langId, "foldingRange") as Record<string, any> | null;
    if (!raw) return;
    const foldingRules = raw.foldingRules ?? raw.patterns;
    if (!foldingRules?.length) return;
    const data = { ...raw, foldingRules } as FoldingRangeData;
    disposables.push(monaco.languages.registerFoldingRangeProvider(langId, toFoldingRangeProvider(monaco, data)));
}

async function registerInlayHints(monaco: Monaco, langId: string): Promise<void> {
    const raw = await getLanguageData(langId, "inlayHints") as Record<string, any> | null;
    if (!raw) return;
    const inlayHintPatterns = raw.inlayHintPatterns ?? raw.hints;
    if (!inlayHintPatterns?.length) return;
    const data = { ...raw, inlayHintPatterns } as InlayHintsData;
    disposables.push(monaco.languages.registerInlayHintsProvider(langId, toInlayHintsProvider(monaco, data)));
}

async function registerCodeLens(monaco: Monaco, langId: string): Promise<void> {
    const raw = await getLanguageData(langId, "codeLens") as Record<string, any> | null;
    if (!raw) return;
    const codeLensPatterns = raw.codeLensPatterns ?? raw.lenses;
    if (!codeLensPatterns?.length) return;
    const data = { ...raw, codeLensPatterns } as CodeLensData;
    disposables.push(monaco.languages.registerCodeLensProvider(langId, toCodeLensProvider(monaco, data)));
}

async function registerColor(monaco: Monaco, langId: string): Promise<void> {
    const raw = await getLanguageData(langId, "color") as Record<string, any> | null;
    if (!raw) return;
    const colorPatterns = raw.colorPatterns ?? raw.patterns;
    if (!colorPatterns?.length) return;
    const data = { ...raw, colorPatterns } as ColorData;
    disposables.push(monaco.languages.registerColorProvider(langId, toColorProvider(monaco, data)));
}

async function registerRename(monaco: Monaco, langId: string): Promise<void> {
    const raw = await getLanguageData(langId, "rename");
    if (!raw) return;
    disposables.push(monaco.languages.registerRenameProvider(langId, toRenameProvider(monaco, raw as RenameData)));
}

async function registerSelectionRange(monaco: Monaco, langId: string): Promise<void> {
    const raw = await getLanguageData(langId, "selectionRange");
    if (!raw) return;
    disposables.push(monaco.languages.registerSelectionRangeProvider(langId, toSelectionRangeProvider(monaco, raw as SelectionRangeData)));
}

async function registerLinkedEditingRange(monaco: Monaco, langId: string): Promise<void> {
    const raw = await getLanguageData(langId, "linkedEditingRange") as Record<string, any> | null;
    if (!raw) return;
    const linkedEditingPatterns = raw.linkedEditingPatterns ?? [];
    if (!linkedEditingPatterns.length && !raw.entries) return;
    const data = { ...raw, linkedEditingPatterns } as LinkedEditingRangeData;
    disposables.push(monaco.languages.registerLinkedEditingRangeProvider(langId, toLinkedEditingRangeProvider(monaco, data)));
}

async function registerFormatting(monaco: Monaco, langId: string): Promise<void> {
    const raw = await getLanguageData(langId, "formatting") as Record<string, any> | null;
    if (!raw) return;
    // lsp format: { formatting: { rules: [...] } }, remote format: { rules: [...] }
    const formatting = raw.formatting ?? { rules: raw.rules ?? [], defaultTabSize: 4, defaultInsertSpaces: true };
    if (!formatting.rules?.length) return;
    const data = { ...raw, formatting } as FormattingData;
    disposables.push(monaco.languages.registerDocumentFormattingEditProvider(langId, toFormattingProvider(monaco, data)));
}

async function registerDocumentRangeFormatting(monaco: Monaco, langId: string): Promise<void> {
    const raw = await getLanguageData(langId, "documentRangeFormatting") as Record<string, any> | null;
    if (!raw) return;
    const rangeFormattingRules = raw.rangeFormattingRules ?? raw.rules;
    if (!rangeFormattingRules?.length) return;
    const data = { ...raw, rangeFormattingRules } as RangeFormattingData;
    disposables.push(monaco.languages.registerDocumentRangeFormattingEditProvider(langId, toRangeFormattingProvider(monaco, data)));
}

async function registerOnTypeFormatting(monaco: Monaco, langId: string): Promise<void> {
    const raw = await getLanguageData(langId, "onTypeFormatting") as Record<string, any> | null;
    if (!raw) return;
    const formatRules = raw.formatRules ?? raw.rules;
    const triggerChars = raw.autoFormatTriggerCharacters ?? raw.triggerCharacters ?? [";", "}", "\n"];
    if (!formatRules?.length) return;
    const data = { ...raw, formatRules, autoFormatTriggerCharacters: triggerChars } as OnTypeFormattingData;
    disposables.push(monaco.languages.registerOnTypeFormattingEditProvider(langId, toOnTypeFormattingProvider(monaco, data)));
}

async function registerSemanticTokens(monaco: Monaco, langId: string): Promise<void> {
    const raw = await getLanguageData(langId, "semanticTokens") as Record<string, any> | null;
    if (!raw) return;
    const tokenLegend = raw.tokenLegend ?? raw.legend;
    if (!tokenLegend?.tokenTypes?.length) return;
    const data = { ...raw, tokenLegend } as SemanticTokensData;
    disposables.push(monaco.languages.registerDocumentSemanticTokensProvider(langId, toSemanticTokensProvider(monaco, data)));
}

async function registerRangeSemanticTokens(monaco: Monaco, langId: string): Promise<void> {
    const raw = await getLanguageData(langId, "rangeSemanticTokens") as Record<string, any> | null;
    if (!raw) return;
    const tokenLegend = raw.tokenLegend ?? raw.legend;
    if (!tokenLegend?.tokenTypes?.length) return;
    const data = { ...raw, tokenLegend } as RangeSemanticTokensData;
    disposables.push(monaco.languages.registerDocumentRangeSemanticTokensProvider(langId, toRangeSemanticTokensProvider(monaco, data)));
}

async function registerInlineCompletions(monaco: Monaco, langId: string): Promise<void> {
    const raw = await getLanguageData(langId, "inlineCompletions") as Record<string, any> | null;
    if (!raw) return;
    const inlineCompletions = raw.inlineCompletions ?? raw.items;
    if (!inlineCompletions?.length) return;
    const data = { ...raw, inlineCompletions } as InlineCompletionsData;
    disposables.push(monaco.languages.registerInlineCompletionsProvider(langId, toInlineCompletionsProvider(monaco, data)));
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
