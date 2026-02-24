/**
 * @module editor/state/store
 *
 * Zustand store factory for the editor.
 * Each editor instance gets its own store (supports multiple editors on one page).
 *
 * The store holds all editor state and exposes actions to mutate it.
 * Undo/Redo stacks are capped at 200 entries for memory efficiency.
 */
import { createStore } from "zustand/vanilla";
import type { EditorStoreType, EditorState } from "../types";
import { detectLanguage, detectPrismLanguage } from "../core/detect-lang";

const MAX_UNDO = 200;

/** Default initial state */
export const defaultEditorState: EditorState = {
    content: "",
    originalContent: "",
    modified: false,
    undoStack: [],
    redoStack: [],
    fileName: "untitled",
    filePath: "",
    sessionId: "",
    language: "Plain Text",
    prismLanguage: null,
    activeThemeId: "dracula",
    fontSize: 13,
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', monospace",
    fontWeight: 400,
    lineHeight: 20,
    wordWrap: true,
    showMinimap: false,
    readOnly: false,
    showFind: false,
    showReplace: false,
    showGoToLine: false,
    showShortcuts: false,
    showThemeSelector: false,
    ctxMenu: null,
    goToLineValue: "",
    findText: "",
    replaceText: "",
    findMatchCount: 0,
    findMatchIndex: -1,
    cursorLine: 1,
    cursorCol: 1,
    loading: true,
    saving: false,
    error: null,
    lastSaved: null,
    lineCount: 1,
    charCount: 0,
};

/** Compute derived fields from content */
function computeDerived(content: string) {
    return {
        lineCount: content.split("\n").length,
        charCount: content.length,
    };
}

/**
 * Create a new Zustand store instance for the editor.
 * @param overrides – partial state to override defaults (e.g. themeId, fontSize)
 */
export function createEditorStore(overrides?: Partial<EditorState>) {
    const initial: EditorState = {
        ...defaultEditorState,
        ...overrides,
        ...computeDerived(overrides?.content ?? ""),
    };

    return createStore<EditorStoreType>()((set, get) => ({
        ...initial,

        // ── Content ──────────────────────────────────────────

        setContent: (content) =>
            set({ content, ...computeDerived(content) }),

        pushChange: (newContent) => {
            const { content, originalContent, undoStack } = get();
            const stack = [...undoStack, content];
            if (stack.length > MAX_UNDO) stack.shift();
            set({
                content: newContent,
                undoStack: stack,
                redoStack: [],
                modified: newContent !== originalContent,
                ...computeDerived(newContent),
            });
        },

        undo: () => {
            const { undoStack, content, originalContent, redoStack } = get();
            if (undoStack.length === 0) return;
            const prev = undoStack[undoStack.length - 1];
            set({
                content: prev,
                undoStack: undoStack.slice(0, -1),
                redoStack: [...redoStack, content],
                modified: prev !== originalContent,
                ...computeDerived(prev),
            });
        },

        redo: () => {
            const { redoStack, content, originalContent, undoStack } = get();
            if (redoStack.length === 0) return;
            const next = redoStack[redoStack.length - 1];
            set({
                content: next,
                redoStack: redoStack.slice(0, -1),
                undoStack: [...undoStack, content],
                modified: next !== originalContent,
                ...computeDerived(next),
            });
        },

        initContent: (content) =>
            set({
                content,
                originalContent: content,
                modified: false,
                undoStack: [],
                redoStack: [],
                ...computeDerived(content),
            }),

        // ── File info ────────────────────────────────────────

        setFileInfo: (info) => {
            const updates: Partial<EditorState> = {};
            if (info.fileName !== undefined) {
                updates.fileName = info.fileName;
                updates.language = detectLanguage(info.fileName);
                updates.prismLanguage = detectPrismLanguage(info.fileName);
            }
            if (info.filePath !== undefined) updates.filePath = info.filePath;
            if (info.sessionId !== undefined) updates.sessionId = info.sessionId;
            set(updates);
        },

        // ── Theme ────────────────────────────────────────────

        setThemeId: (id) => set({ activeThemeId: id }),

        // ── Font / Display ───────────────────────────────────

        setFontSize: (size) => set({ fontSize: Math.max(8, Math.min(32, size)) }),
        zoomIn: () => set((s) => ({ fontSize: Math.min(32, s.fontSize + 1) })),
        zoomOut: () => set((s) => ({ fontSize: Math.max(8, s.fontSize - 1) })),
        resetZoom: () => set({ fontSize: 13 }),
        setFontFamily: (family) => set({ fontFamily: family }),
        setFontWeight: (weight) => set({ fontWeight: weight }),
        setLineHeight: (lineHeight) => set({ lineHeight: Math.max(14, Math.min(40, lineHeight)) }),
        toggleWordWrap: () => set((s) => ({ wordWrap: !s.wordWrap })),
        setWordWrap: (wrap) => set({ wordWrap: wrap }),
        toggleMinimap: () => set((s) => ({ showMinimap: !s.showMinimap })),
        setMinimap: (show) => set({ showMinimap: show }),
        toggleReadOnly: () => set((s) => ({ readOnly: !s.readOnly })),
        setReadOnly: (readOnly) => set({ readOnly }),

        // ── UI panels ────────────────────────────────────────

        openFind: () => set({ showFind: true, showReplace: false }),
        openFindReplace: () => set({ showFind: true, showReplace: true }),
        closeFind: () =>
            set({ showFind: false, showReplace: false, findText: "", findMatchCount: 0, findMatchIndex: -1 }),
        openGoToLine: () => set({ showGoToLine: true }),
        closeGoToLine: () => set({ showGoToLine: false, goToLineValue: "" }),
        setGoToLineValue: (v) => set({ goToLineValue: v }),
        openShortcuts: () => set({ showShortcuts: true }),
        closeShortcuts: () => set({ showShortcuts: false }),
        openThemeSelector: () => set({ showThemeSelector: true }),
        closeThemeSelector: () => set({ showThemeSelector: false }),
        setCtxMenu: (pos) => set({ ctxMenu: pos }),

        // ── Find / Replace ───────────────────────────────────

        setFindText: (text) => set({ findText: text }),
        setReplaceText: (text) => set({ replaceText: text }),
        setFindMatchCount: (count) => set({ findMatchCount: count }),
        setFindMatchIndex: (index) => set({ findMatchIndex: index }),

        // ── Cursor ───────────────────────────────────────────

        setCursor: (line, col) => set({ cursorLine: line, cursorCol: col }),

        // ── Status ───────────────────────────────────────────

        setLoading: (loading) => set({ loading }),
        setSaving: (saving) => set({ saving }),
        setError: (error) => set({ error }),
        setLastSaved: (date) => set({ lastSaved: date }),
        setModified: (modified) => set({ modified }),

        // ── Reset ────────────────────────────────────────────

        reset: () => set({ ...defaultEditorState }),
    }));
}

export type EditorStoreInstance = ReturnType<typeof createEditorStore>;
