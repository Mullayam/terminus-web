/**
 * @module editor/plugins/types
 *
 * Extended plugin type definitions.
 * These extend the base EditorPlugin / EditorPluginAPI from ../types
 * WITHOUT modifying existing interfaces – we use declaration merging
 * only within this plugin subsystem.
 */
import type { ReactNode } from "react";
import type {
    EditorPlugin,
    EditorPluginAPI,
    FormatterDefinition,
    KeyBinding,
    ContextMenuItem,
    EditorTheme,
} from "../types";

// ═══════════════════════════════════════════════════════════════
//  DECORATION TYPES
// ═══════════════════════════════════════════════════════════════

/** Inline decoration applied to a range of text */
export interface InlineDecoration {
    /** Unique ID for this decoration */
    id: string;
    /** 1-based line number */
    line: number;
    /** 0-based start column */
    startCol: number;
    /** 0-based end column */
    endCol: number;
    /** CSS class to apply */
    className?: string;
    /** Inline styles */
    style?: React.CSSProperties;
    /** Hover tooltip text */
    hoverMessage?: string;
}

/** Gutter decoration (icon / badge in the gutter area) */
export interface GutterDecoration {
    id: string;
    line: number;
    icon?: ReactNode;
    className?: string;
    hoverMessage?: string;
    onClick?: () => void;
}

/** CodeLens item rendered above a line */
export interface CodeLensItem {
    id: string;
    line: number;
    command: string;
    title: string;
    tooltip?: string;
    onClick: () => void;
}

/** An inline annotation (e.g. ghost text after a line) */
export interface InlineAnnotation {
    id: string;
    line: number;
    text: string;
    className?: string;
    style?: React.CSSProperties;
    onClick?: () => void;
}

/** Completion / suggestion item */
export interface CompletionItem {
    label: string;
    kind: "keyword" | "function" | "variable" | "snippet" | "property" | "method" | "class" | "module" | "text" | "ai";
    detail?: string;
    documentation?: string;
    insertText: string;
    /** Sort priority (lower = higher) */
    sortOrder?: number;
    /** Icon override */
    icon?: ReactNode;
}

/** Completion provider interface */
export interface CompletionProvider {
    id: string;
    /** Trigger characters that activate this provider */
    triggerCharacters?: string[];
    /** Provide completions for the current context */
    provideCompletions(context: CompletionContext): Promise<CompletionItem[]> | CompletionItem[];
}

/** Context passed to completion providers */
export interface CompletionContext {
    content: string;
    cursorOffset: number;
    lineNumber: number;
    column: number;
    lineText: string;
    wordBeforeCursor: string;
    language: string;
    fileName: string;
    triggerCharacter?: string;
}

/** Diagnostic (lint warning / error) */
export interface Diagnostic {
    id: string;
    line: number;
    startCol: number;
    endCol: number;
    message: string;
    severity: "error" | "warning" | "info" | "hint";
    source: string;
    /** Quick fix actions */
    fixes?: DiagnosticFix[];
}

/** Quick fix for a diagnostic */
export interface DiagnosticFix {
    label: string;
    apply: () => void;
}

/** Side panel descriptor (e.g. Markdown preview, diff view) */
export interface PanelDescriptor {
    id: string;
    title: string;
    icon?: ReactNode;
    position: "right" | "bottom";
    render: (api: ExtendedPluginAPI) => ReactNode;
    /** Default width/height in pixels */
    defaultSize?: number;
}

/** Diff hunk for side-by-side / inline diff */
export interface DiffHunk {
    type: "add" | "remove" | "unchanged";
    oldStart: number;
    oldLines: string[];
    newStart: number;
    newLines: string[];
}

// ═══════════════════════════════════════════════════════════════
//  EXTENDED PLUGIN API
// ═══════════════════════════════════════════════════════════════

/**
 * Extended API surface available to plugins. Superset of EditorPluginAPI.
 * Adds decoration, completion, diagnostic, panel, and AI capabilities.
 */
export interface ExtendedPluginAPI extends EditorPluginAPI {
    // ── Decorations ──────────────────────────────────
    addInlineDecorations(decorations: InlineDecoration[]): void;
    removeInlineDecorations(ids: string[]): void;
    clearInlineDecorations(ownerId: string): void;

    addGutterDecorations(decorations: GutterDecoration[]): void;
    removeGutterDecorations(ids: string[]): void;
    clearGutterDecorations(ownerId: string): void;

    // ── CodeLens ─────────────────────────────────────
    setCodeLenses(lenses: CodeLensItem[]): void;
    clearCodeLenses(ownerId: string): void;

    // ── Inline annotations ───────────────────────────
    setInlineAnnotations(annotations: InlineAnnotation[]): void;
    clearInlineAnnotations(ownerId: string): void;

    // ── Completions ──────────────────────────────────
    registerCompletionProvider(provider: CompletionProvider): void;
    unregisterCompletionProvider(id: string): void;

    // ── Diagnostics ──────────────────────────────────
    setDiagnostics(diagnostics: Diagnostic[]): void;
    clearDiagnostics(ownerId: string): void;

    // ── Panels ───────────────────────────────────────
    registerPanel(panel: PanelDescriptor): void;
    unregisterPanel(id: string): void;
    togglePanel(id: string): void;
    isPanelOpen(id: string): boolean;

    // ── Store access ─────────────────────────────────
    getState(): Record<string, unknown>;
    subscribe(listener: () => void): () => void;

    // ── Cursor / Selection ───────────────────────────
    getCursorPosition(): { line: number; col: number; offset: number };
    getLineContent(line: number): string;
    getLineCount(): number;

    // ── Commands ─────────────────────────────────────
    registerCommand(id: string, handler: (...args: unknown[]) => void): void;
    executeCommand(id: string, ...args: unknown[]): void;

    // ── Events ───────────────────────────────────────
    onContentChange(listener: (content: string) => void): () => void;
    onSelectionChange(listener: (sel: { start: number; end: number; text: string }) => void): () => void;
    onSave(listener: () => void): () => void;
    onLanguageChange(listener: (language: string) => void): () => void;
}

// ═══════════════════════════════════════════════════════════════
//  EXTENDED PLUGIN INTERFACE
// ═══════════════════════════════════════════════════════════════

/**
 * Extended plugin interface. Backward-compatible with EditorPlugin
 * but adds richer lifecycle hooks.
 */
export interface ExtendedEditorPlugin extends EditorPlugin {
    /** Human-readable description */
    description?: string;
    /** Plugin category for grouping in UI */
    category?: "editor" | "language" | "ai" | "ui" | "validation" | "tools";
    /** Whether the plugin is enabled by default */
    defaultEnabled?: boolean;
    /** Dependencies on other plugin IDs */
    dependencies?: string[];

    /** Called with the extended API */
    onActivate?: (api: ExtendedPluginAPI) => void | Promise<void>;
    /** Called before the plugin is deactivated */
    onDeactivate?: (api: ExtendedPluginAPI) => void | Promise<void>;
    /** Called when file content changes (debounced) */
    onContentChange?: (content: string, api: ExtendedPluginAPI) => void;
    /** Called when language / file changes */
    onLanguageChange?: (language: string, api: ExtendedPluginAPI) => void;
    /** Called when selection changes */
    onSelectionChange?: (selection: { start: number; end: number; text: string }, api: ExtendedPluginAPI) => void;
    /** Called on save */
    onSave?: (api: ExtendedPluginAPI) => void;

    /** Panels this plugin contributes */
    panels?: PanelDescriptor[];
    /** Completion providers this plugin contributes */
    completionProviders?: CompletionProvider[];
}

// ═══════════════════════════════════════════════════════════════
//  PLUGIN HOST STATE  (rendered by React)
// ═══════════════════════════════════════════════════════════════

export interface PluginHostState {
    /** All registered plugins by ID */
    plugins: Map<string, ExtendedEditorPlugin>;
    /** Which plugins are currently enabled */
    enabledPlugins: Set<string>;
    /** All inline decorations from all plugins */
    inlineDecorations: InlineDecoration[];
    /** All gutter decorations from all plugins */
    gutterDecorations: GutterDecoration[];
    /** All code lenses from all plugins */
    codeLenses: CodeLensItem[];
    /** All inline annotations from all plugins */
    inlineAnnotations: InlineAnnotation[];
    /** All diagnostics from all plugins */
    diagnostics: Diagnostic[];
    /** All registered panels */
    panels: Map<string, PanelDescriptor>;
    /** Currently open panel IDs */
    openPanels: Set<string>;
    /** All registered completion providers */
    completionProviders: Map<string, CompletionProvider>;
    /** Registered commands */
    commands: Map<string, (...args: unknown[]) => void>;
}
