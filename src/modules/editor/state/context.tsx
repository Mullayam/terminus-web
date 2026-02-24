/**
 * @module editor/state/context
 *
 * React Context that provides a scoped Zustand store + shared refs to every
 * child component of the editor.  Each <FileEditor> mount creates its own
 * store instance, so multiple editors can coexist on the same page.
 */
import {
    createContext,
    useContext,
    useRef,
    type MutableRefObject,
    type ReactNode,
} from "react";
import { useStore, type StoreApi } from "zustand";
import { createEditorStore, type EditorStoreInstance } from "./store";
import type { EditorStoreType, EditorState } from "../types";

// ── Context shape ────────────────────────────────────────────

interface EditorContextValue {
    /** The Zustand store instance */
    store: EditorStoreInstance;
    /** Shared textarea ref used by multiple sub-components */
    textareaRef: MutableRefObject<HTMLTextAreaElement | null>;
    /** Shared gutter ref for scroll sync */
    gutterRef: MutableRefObject<HTMLDivElement | null>;
    /** Shared highlight overlay ref for scroll sync */
    highlightRef: MutableRefObject<HTMLPreElement | null>;
    /** Editor wrapper ref for context-menu positioning */
    editorWrapperRef: MutableRefObject<HTMLDivElement | null>;
    /** Context menu ref for overflow repositioning */
    ctxMenuRef: MutableRefObject<HTMLDivElement | null>;
    /** Find input ref */
    findInputRef: MutableRefObject<HTMLInputElement | null>;
    /** Go-to-line input ref */
    goToLineInputRef: MutableRefObject<HTMLInputElement | null>;
}

const EditorContext = createContext<EditorContextValue | null>(null);

// ── Provider ─────────────────────────────────────────────────

interface EditorProviderProps {
    children: ReactNode;
    /** Optional partial state overrides fed into the store factory */
    initialState?: Partial<EditorState>;
}

export function EditorProvider({ children, initialState }: EditorProviderProps) {
    // Create store once on mount (stable ref)
    const storeRef = useRef<EditorStoreInstance | null>(null);
    if (!storeRef.current) {
        storeRef.current = createEditorStore(initialState);
    }

    // Shared DOM refs
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    const gutterRef = useRef<HTMLDivElement | null>(null);
    const highlightRef = useRef<HTMLPreElement | null>(null);
    const editorWrapperRef = useRef<HTMLDivElement | null>(null);
    const ctxMenuRef = useRef<HTMLDivElement | null>(null);
    const findInputRef = useRef<HTMLInputElement | null>(null);
    const goToLineInputRef = useRef<HTMLInputElement | null>(null);

    return (
        <EditorContext.Provider
            value={{
                store: storeRef.current,
                textareaRef,
                gutterRef,
                highlightRef,
                editorWrapperRef,
                ctxMenuRef,
                findInputRef,
                goToLineInputRef,
            }}
        >
            {children}
        </EditorContext.Provider>
    );
}

// ── Hooks ────────────────────────────────────────────────────

/** Access the raw Zustand store API (for imperative usage) */
export function useEditorStoreApi(): StoreApi<EditorStoreType> {
    const ctx = useContext(EditorContext);
    if (!ctx) throw new Error("useEditorStoreApi must be used within <EditorProvider>");
    return ctx.store;
}

/**
 * Select a slice of the editor store (reactive).
 * @example const content = useEditorStore(s => s.content);
 */
export function useEditorStore<T>(selector: (state: EditorStoreType) => T): T {
    const ctx = useContext(EditorContext);
    if (!ctx) throw new Error("useEditorStore must be used within <EditorProvider>");
    return useStore(ctx.store, selector);
}

/** Access all shared DOM refs */
export function useEditorRefs() {
    const ctx = useContext(EditorContext);
    if (!ctx) throw new Error("useEditorRefs must be used within <EditorProvider>");
    return {
        textareaRef: ctx.textareaRef,
        gutterRef: ctx.gutterRef,
        highlightRef: ctx.highlightRef,
        editorWrapperRef: ctx.editorWrapperRef,
        ctxMenuRef: ctx.ctxMenuRef,
        findInputRef: ctx.findInputRef,
        goToLineInputRef: ctx.goToLineInputRef,
    };
}
