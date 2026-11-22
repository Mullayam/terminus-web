import { create } from 'zustand';

/**
 * Pending "show this in Files" requests per SSH session. The terminal side
 * (path links, status-bar button) writes a request; the tab's Files view
 * consumes it once its SFTP session is ready.
 */
export interface FilesNavRequest {
  dir: string;
  /** Open this file in the editor after listing `dir`. */
  file?: string;
  nonce: number;
}

interface FilesNavState {
  requests: Record<string, FilesNavRequest | undefined>;
  request: (sessionId: string, dir: string, file?: string) => void;
  consume: (sessionId: string) => void;
}

export const useFilesNavStore = create<FilesNavState>((set) => ({
  requests: {},
  request: (sessionId, dir, file) =>
    set((s) => ({ requests: { ...s.requests, [sessionId]: { dir, file, nonce: Date.now() } } })),
  consume: (sessionId) =>
    set((s) => ({ requests: { ...s.requests, [sessionId]: undefined } })),
}));
