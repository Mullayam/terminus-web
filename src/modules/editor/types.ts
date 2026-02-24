/**
 * @module editor/types
 * 
 * Centralized type definitions for the File Editor module.
 * 
 * Architecture Patterns:
 * - EditorTheme uses the **Factory Pattern** for instantiation
 * - ContentProvider uses the **Strategy Pattern** for API/Socket/Custom loading
 * - EditorPlugin uses the **Observer Pattern** for lifecycle hooks
 * - FormatterFn uses the **Strategy Pattern** for per-language formatting
 */
import type { ReactNode } from "react";

// ═══════════════════════════════════════════════════════════════
//  THEME TYPES
// ═══════════════════════════════════════════════════════════════

/** Color configuration for the editor chrome (non-syntax elements) */
export interface ThemeColors {
    /** Editor main background */
    background: string;
    /** Default text color */
    foreground: string;
    /** Selection highlight background */
    selection: string;
    /** Cursor / caret color */
    cursor: string;
    /** Active line highlight background */
    lineHighlight: string;
    /** Line-number gutter text (inactive) */
    gutterFg: string;
    /** Line-number gutter text (active line) */
    gutterActiveFg: string;
    /** Line-number gutter background */
    gutterBg: string;
    /** Panel / divider border color */
    border: string;
    /** Scrollbar thumb */
    scrollbarThumb: string;
    /** Scrollbar thumb hover */
    scrollbarThumbHover: string;
    /** Scrollbar track */
    scrollbarTrack: string;
    /** Toolbar / title-bar background */
    toolbarBg: string;
    /** Status-bar background */
    statusBarBg: string;
    /** Input field background */
    inputBg: string;
    /** Input field border */
    inputBorder: string;
    /** Input field focus border */
    inputFocusBorder: string;
    /** Primary accent (buttons, badges) */
    accent: string;
    /** Accent hover state */
    accentHover: string;
    /** Text on accent background */
    accentFg: string;
    /** Success indicator */
    success: string;
    /** Warning indicator (unsaved dot) */
    warning: string;
    /** Error indicator */
    error: string;
    /** Info / secondary text */
    info: string;
    /** Muted / disabled text */
    muted: string;
    /** Context-menu / popup background */
    popupBg: string;
    /** Popup item hover */
    popupHoverBg: string;
}

/** Syntax-highlighting token colors */
export interface ThemeSyntax {
    keyword: string;
    string: string;
    number: string;
    comment: string;
    operator: string;
    function: string;
    className: string;
    variable: string;
    property: string;
    tag: string;
    attribute: string;
    constant: string;
    regex: string;
    punctuation: string;
    builtin: string;
    inserted: string;
    deleted: string;
    important: string;
    doctype: string;
}

/** Font configuration for the editor */
export interface ThemeFont {
    /** CSS font-family value */
    family: string;
    /** Font size in pixels */
    size: number;
    /** Font weight (100–900) */
    weight: number;
    /** Line height in pixels */
    lineHeight: number;
    /** Cursor rendering style */
    cursorStyle: "line" | "block" | "underline";
}

/** Complete editor theme definition */
export interface EditorTheme {
    /** Unique identifier (kebab-case) */
    id: string;
    /** Human-readable display name */
    name: string;
    /** Light or dark variant */
    type: "dark" | "light";
    /** Editor chrome colors */
    colors: ThemeColors;
    /** Syntax token colors */
    syntax: ThemeSyntax;
    /** Font settings */
    font: ThemeFont;
    /** Built-in themes cannot be deleted */
    isBuiltIn?: boolean;
}

/** Partial theme for user customisation – merged with a base theme */
export type PartialTheme = {
    id: string;
    name: string;
    type?: "dark" | "light";
    colors?: Partial<ThemeColors>;
    syntax?: Partial<ThemeSyntax>;
    font?: Partial<ThemeFont>;
};

// ═══════════════════════════════════════════════════════════════
//  EDITOR CONFIG
// ═══════════════════════════════════════════════════════════════

/** Editor initialization configuration */
export interface EditorConfig {
    /** SSH/SFTP session identifier */
    sessionId: string;
    /** Remote file path */
    filePath: string;
    /** Content-loading strategy */
    providerType: "api" | "socket" | "custom";
    /** Initial theme ID (defaults to "dracula") */
    themeId?: string;
    /** Start in read-only mode */
    readOnly?: boolean;
    /** Show minimap on mount */
    showMinimap?: boolean;
    /** Enable word wrap */
    wordWrap?: boolean;
    /** Initial font-size override */
    fontSize?: number;
    /** Font-family override */
    fontFamily?: string;
    /** Custom save handler (overrides provider) */
    onSave?: (content: string) => void | Promise<void>;
    /** Custom fetch handler (overrides provider) */
    onFetchContent?: () => string | Promise<string>;
    /** External content-update stream (real-time collaboration) */
    onContentUpdate?: (callback: (content: string) => void) => () => void;
}

// ═══════════════════════════════════════════════════════════════
//  CONTENT PROVIDER (Strategy Pattern)
// ═══════════════════════════════════════════════════════════════

/** Strategy interface for loading and saving file content */
export interface ContentProvider {
    /** Fetch file content */
    fetchContent(
        sessionId: string,
        filePath: string,
    ): Promise<{ content: string; error?: string }>;
    /** Save file content */
    saveContent(
        sessionId: string,
        filePath: string,
        content: string,
    ): Promise<{ success: boolean; error?: string }>;
    /** Subscribe to real-time content updates (optional) */
    onContentUpdate?(callback: (content: string) => void): () => void;
}

// ═══════════════════════════════════════════════════════════════
//  FORMATTER (Strategy Pattern)
// ═══════════════════════════════════════════════════════════════

/** Formatter function signature */
export type FormatterFn = (content: string) => { formatted: string; error?: string };

/** Formatter registration entry */
export interface FormatterDefinition {
    /** File extensions this formatter handles (lowercase, no dot) */
    extensions: string[];
    /** Display name */
    name: string;
    /** The formatting function */
    format: FormatterFn;
}

// ═══════════════════════════════════════════════════════════════
//  KEYBINDING
// ═══════════════════════════════════════════════════════════════

export interface KeyBinding {
    /** Unique identifier */
    id: string;
    /** Display label */
    label: string;
    /** Key combination string (e.g. "Ctrl+S") */
    keys: string;
    /** Handler – receives the native event */
    handler: (e: KeyboardEvent | React.KeyboardEvent) => void;
    /** Context where binding is active */
    when?: "editor" | "find" | "always";
    /** Category for help display */
    category?: string;
}

// ═══════════════════════════════════════════════════════════════
//  CONTEXT MENU
// ═══════════════════════════════════════════════════════════════

export interface ContextMenuItem {
    label: string;
    icon?: ReactNode;
    action: () => void;
    disabled?: boolean;
    shortcut?: string;
    separator?: boolean;
    /** Lower numbers appear first */
    priority?: number;
}

// ═══════════════════════════════════════════════════════════════
//  PLUGIN SYSTEM (Observer Pattern)
// ═══════════════════════════════════════════════════════════════

/** API surface available to editor plugins */
export interface EditorPluginAPI {
    getContent: () => string;
    setContent: (content: string) => void;
    getSelection: () => { start: number; end: number; text: string };
    setSelection: (start: number, end: number) => void;
    insertText: (text: string, position?: number) => void;
    getTheme: () => EditorTheme;
    setTheme: (themeId: string) => void;
    showToast: (title: string, description?: string, type?: "default" | "success" | "error") => void;
    registerFormatter: (definition: FormatterDefinition) => void;
    registerKeybinding: (binding: KeyBinding) => void;
    addContextMenuItem: (item: ContextMenuItem) => void;
    getFileInfo: () => { fileName: string; filePath: string; language: string };
}

/** Editor plugin interface */
export interface EditorPlugin {
    id: string;
    name: string;
    version: string;
    onInit?: (api: EditorPluginAPI) => void;
    onMount?: (api: EditorPluginAPI) => void;
    onUnmount?: () => void;
    keybindings?: KeyBinding[];
    contextMenuItems?: ContextMenuItem[];
    formatters?: FormatterDefinition[];
}

// ═══════════════════════════════════════════════════════════════
//  EDITOR STORE STATE
// ═══════════════════════════════════════════════════════════════

export interface EditorState {
    // Content
    content: string;
    originalContent: string;
    modified: boolean;
    undoStack: string[];
    redoStack: string[];
    // File info
    fileName: string;
    filePath: string;
    sessionId: string;
    language: string;
    prismLanguage: string | null;
    // Theme
    activeThemeId: string;
    // Font / Display
    fontSize: number;
    fontFamily: string;
    fontWeight: number;
    lineHeight: number;
    wordWrap: boolean;
    showMinimap: boolean;
    readOnly: boolean;
    tabSize: number;
    // Auto-save
    autoSave: boolean;
    autoSaveDelay: number;
    // Whitespace & Line endings
    showWhitespace: boolean;
    lineEnding: 'lf' | 'crlf';
    // Auto-close brackets
    autoCloseBrackets: boolean;
    // Highlight occurrences
    highlightActiveOccurrences: boolean;
    // UI panels
    showFind: boolean;
    showReplace: boolean;
    showGoToLine: boolean;
    showShortcuts: boolean;
    showThemeSelector: boolean;
    showCommandPalette: boolean;
    splitView: boolean;
    ctxMenu: { x: number; y: number } | null;
    goToLineValue: string;
    // Find / Replace
    findText: string;
    replaceText: string;
    findMatchCount: number;
    findMatchIndex: number;
    findCaseSensitive: boolean;
    findWholeWord: boolean;
    findUseRegex: boolean;
    // Cursor
    cursorLine: number;
    cursorCol: number;
    // Status
    loading: boolean;
    saving: boolean;
    error: string | null;
    lastSaved: Date | null;
    // Derived (computed on set)
    lineCount: number;
    charCount: number;
}

export interface EditorActions {
    // Content
    setContent: (content: string) => void;
    pushChange: (newContent: string) => void;
    undo: () => void;
    redo: () => void;
    initContent: (content: string) => void;
    // File info
    setFileInfo: (info: { fileName?: string; filePath?: string; sessionId?: string }) => void;
    // Theme
    setThemeId: (id: string) => void;
    // Font / Display
    setFontSize: (size: number) => void;
    zoomIn: () => void;
    zoomOut: () => void;
    resetZoom: () => void;
    setFontFamily: (family: string) => void;
    setFontWeight: (weight: number) => void;
    setLineHeight: (height: number) => void;
    toggleWordWrap: () => void;
    setWordWrap: (wrap: boolean) => void;
    toggleMinimap: () => void;
    setMinimap: (show: boolean) => void;
    toggleReadOnly: () => void;
    setReadOnly: (readOnly: boolean) => void;
    setTabSize: (size: number) => void;
    // Auto-save
    setAutoSave: (enabled: boolean) => void;
    setAutoSaveDelay: (delay: number) => void;
    // Whitespace & Line endings
    toggleWhitespace: () => void;
    setShowWhitespace: (show: boolean) => void;
    setLineEnding: (ending: 'lf' | 'crlf') => void;
    // Auto-close brackets
    setAutoCloseBrackets: (enabled: boolean) => void;
    // Highlight occurrences
    setHighlightActiveOccurrences: (enabled: boolean) => void;
    // UI panels
    openFind: () => void;
    openFindReplace: () => void;
    closeFind: () => void;
    openGoToLine: () => void;
    closeGoToLine: () => void;
    setGoToLineValue: (v: string) => void;
    openShortcuts: () => void;
    closeShortcuts: () => void;
    openThemeSelector: () => void;
    closeThemeSelector: () => void;
    openCommandPalette: () => void;
    closeCommandPalette: () => void;
    toggleSplitView: () => void;
    setSplitView: (open: boolean) => void;
    setCtxMenu: (pos: { x: number; y: number } | null) => void;
    // Find
    setFindText: (text: string) => void;
    setReplaceText: (text: string) => void;
    setFindMatchCount: (count: number) => void;
    setFindMatchIndex: (index: number) => void;
    setFindCaseSensitive: (enabled: boolean) => void;
    setFindWholeWord: (enabled: boolean) => void;
    setFindUseRegex: (enabled: boolean) => void;
    toggleFindCaseSensitive: () => void;
    toggleFindWholeWord: () => void;
    toggleFindUseRegex: () => void;
    // Cursor
    setCursor: (line: number, col: number) => void;
    // Status
    setLoading: (loading: boolean) => void;
    setSaving: (saving: boolean) => void;
    setError: (error: string | null) => void;
    setLastSaved: (date: Date | null) => void;
    setModified: (modified: boolean) => void;
    // Reset
    reset: () => void;
}

/** Combined Zustand store type */
export type EditorStoreType = EditorState & EditorActions;
