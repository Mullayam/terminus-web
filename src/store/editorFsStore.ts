/**
 * @module editorFsStore
 *
 * Lightweight Zustand store that tracks the editor's file-system
 * provider state — completely independent from the main SFTP tab store.
 *
 * Each editor page gets its own entry keyed by a session ID.
 * Works with any FileSystemProvider backend (SFTP, REST API, local, etc.).
 */
import { create } from "zustand";
import type { FsProviderStatus } from "@/modules/monaco-editor/lib/filesystem/file-system-types";

// Re-export the canonical status type for backward compat
export type { FsProviderStatus };
/** @deprecated Use `FsProviderStatus` instead */
export type EditorSftpStatus = FsProviderStatus;

export interface EditorFsSession {
    sessionId: string;
    /** Provider type ("sftp", "api", "local", …) */
    providerType: string;
    host: string;
    username: string;
    status: FsProviderStatus;
    error?: string;
}

/** @deprecated Use `EditorFsSession` instead */
export type EditorSftpSession = EditorFsSession;

interface EditorFsStore {
    sessions: Record<string, EditorFsSession>;

    upsertSession: (sessionId: string, patch: Partial<EditorFsSession>) => void;
    removeSession: (sessionId: string) => void;
    getSession: (sessionId: string) => EditorFsSession | undefined;
}

export const useEditorFsStore = create<EditorFsStore>((set, get) => ({
    sessions: {},

    upsertSession: (sessionId, patch) =>
        set((state) => ({
            sessions: {
                ...state.sessions,
                [sessionId]: {
                    ...(state.sessions[sessionId] ?? {
                        sessionId,
                        providerType: "",
                        host: "",
                        username: "",
                        status: "idle" as const,
                    }),
                    ...patch,
                },
            },
        })),

    removeSession: (sessionId) =>
        set((state) => {
            const next = { ...state.sessions };
            delete next[sessionId];
            return { sessions: next };
        }),

    getSession: (sessionId) => get().sessions[sessionId],
}));

/** @deprecated Use `useEditorFsStore` instead */
export const useEditorSftpStore = useEditorFsStore;
