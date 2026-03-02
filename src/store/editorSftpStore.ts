/**
 * @module editorSftpStore
 *
 * Lightweight Zustand store that tracks the editor's **own** SFTP
 * connection state — completely independent from the main SFTP tab store.
 *
 * Each editor page gets its own entry keyed by `editorSessionId`.
 */
import { create } from "zustand";

export type EditorSftpStatus =
    | "idle"          // not connected yet — show connect button
    | "connecting"    // connecting in progress
    | "connected"     // SFTP session is live
    | "error";        // something went wrong

export interface EditorSftpSession {
    editorSessionId: string;
    host: string;
    username: string;
    status: EditorSftpStatus;
    error?: string;
}

interface EditorSftpStore {
    sessions: Record<string, EditorSftpSession>;

    upsertSession: (editorSessionId: string, patch: Partial<EditorSftpSession>) => void;
    removeSession: (editorSessionId: string) => void;
    getSession: (editorSessionId: string) => EditorSftpSession | undefined;
}

export const useEditorSftpStore = create<EditorSftpStore>((set, get) => ({
    sessions: {},

    upsertSession: (editorSessionId, patch) =>
        set((state) => ({
            sessions: {
                ...state.sessions,
                [editorSessionId]: {
                    ...(state.sessions[editorSessionId] ?? {
                        editorSessionId,
                        host: "",
                        username: "",
                        status: "idle" as const,
                    }),
                    ...patch,
                },
            },
        })),

    removeSession: (editorSessionId) =>
        set((state) => {
            const next = { ...state.sessions };
            delete next[editorSessionId];
            return { sessions: next };
        }),

    getSession: (editorSessionId) => get().sessions[editorSessionId],
}));
