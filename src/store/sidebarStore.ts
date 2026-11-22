import { create } from 'zustand'
import { useSSHStore } from './sshStore'

/** What an SSH tab shows: its terminal, or its Files (SFTP) view. */
export type SessionView = 'Terminal' | 'SFTP'

type Store = {
    /** Per SSH session; a missing entry means the terminal. */
    views: Record<string, SessionView>
    /**
     * Sessions whose SFTP companion tab is open in the tab bar. It sits right
     * after the session's SSH tab and stays until closed, even while the
     * terminal is showing.
     */
    filesTabs: Record<string, boolean>
    setView: (sessionId: string, view: SessionView) => void
    closeFilesTab: (sessionId: string) => void
    forget: (sessionId: string) => void
}

export const useSidebarState = create<Store>()((set) => ({
    views: {},
    filesTabs: {},
    setView: (sessionId, view) => set((s) => ({
        views: { ...s.views, [sessionId]: view },
        filesTabs: view === 'SFTP' ? { ...s.filesTabs, [sessionId]: true } : s.filesTabs,
    })),
    closeFilesTab: (sessionId) => set((s) => ({
        views: { ...s.views, [sessionId]: 'Terminal' },
        filesTabs: { ...s.filesTabs, [sessionId]: false },
    })),
    forget: (sessionId) => set((s) => {
        const views = { ...s.views }
        const filesTabs = { ...s.filesTabs }
        delete views[sessionId]
        delete filesTabs[sessionId]
        return { views, filesTabs }
    }),
}))

export function useSessionView(sessionId?: string | null): SessionView {
    return useSidebarState((s) => (sessionId && s.views[sessionId]) || 'Terminal')
}

/** Session id of the SSH tab currently on screen. */
export function useActiveSessionId(): string | undefined {
    return useSSHStore((s) => s.tabs.find((t) => t.id === s.activeTabId)?.sessionId ?? s.activeTabId)
}
