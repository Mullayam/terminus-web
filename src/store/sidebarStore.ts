import { create } from 'zustand'
import { useSSHStore } from './sshStore'

/** What an SSH tab shows: its terminal, or its Files (SFTP) view. */
export type SessionView = 'Terminal' | 'SFTP'

type Store = {
    /** Per SSH session; a missing entry means the terminal. */
    views: Record<string, SessionView>
    setView: (sessionId: string, view: SessionView) => void
}

export const useSidebarState = create<Store>()((set) => ({
    views: {},
    setView: (sessionId, view) => set((s) => ({ views: { ...s.views, [sessionId]: view } })),
}))

export function useSessionView(sessionId?: string | null): SessionView {
    return useSidebarState((s) => (sessionId && s.views[sessionId]) || 'Terminal')
}

/** Session id of the SSH tab currently on screen. */
export function useActiveSessionId(): string | undefined {
    return useSSHStore((s) => s.tabs.find((t) => t.id === s.activeTabId)?.sessionId ?? s.activeTabId)
}
