/**
 * @module openDocumentsStore
 *
 * Tracks the set of documents currently open in the editor so that features
 * needing cross-file context (Codeium completions, chat, agents) can read
 * them without reaching into a page component's local state.
 *
 * The editor page owns the tabs; it mirrors them here via `syncDocuments`.
 */
import { create } from "zustand";

export interface OpenDocument {
    /** Stable id — the editor tab id */
    id: string;
    filePath: string;
    languageId: string;
    content: string;
    modified: boolean;
}

interface OpenDocumentsStore {
    documents: Record<string, OpenDocument>;
    activeId: string | null;

    /** Replace the whole set (called from the editor page when tabs change) */
    syncDocuments: (documents: OpenDocument[], activeId: string | null) => void;
    setActive: (id: string | null) => void;
    clear: () => void;
}

export const useOpenDocumentsStore = create<OpenDocumentsStore>((set) => ({
    documents: {},
    activeId: null,

    syncDocuments: (documents, activeId) =>
        set({
            documents: Object.fromEntries(documents.map((d) => [d.id, d])),
            activeId,
        }),

    setActive: (activeId) => set({ activeId }),

    clear: () => set({ documents: {}, activeId: null }),
}));

export interface OtherDocumentsOptions {
    /** Path of the document being completed — excluded from the result */
    excludePath?: string;
    /** Max number of documents to return (default 3) */
    limit?: number;
    /** Skip documents larger than this many characters (default 60_000) */
    maxChars?: number;
}

/**
 * Snapshot of the other open documents, for use as completion context.
 * Non-reactive: safe to call from inside a Monaco provider callback.
 */
export function getOtherDocuments(
    options: OtherDocumentsOptions = {},
): Array<Pick<OpenDocument, "filePath" | "languageId" | "content">> {
    const { excludePath, limit = 3, maxChars = 60_000 } = options;

    return Object.values(useOpenDocumentsStore.getState().documents)
        .filter(
            (d) =>
                d.filePath !== excludePath &&
                d.content.length > 0 &&
                d.content.length <= maxChars,
        )
        .slice(0, limit)
        .map(({ filePath, languageId, content }) => ({ filePath, languageId, content }));
}
