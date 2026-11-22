import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Saved workspaces: a set of SSH tabs (host, user, folder, whether the SFTP
 * tab was open) plus which panels were open. No credentials are stored —
 * restoring looks the host up in the saved hosts instead.
 */
export interface WorkspaceTab {
  title: string;
  host: string;
  username: string;
  port?: number;
  /** Terminal folder at save time, restored with `cd`. */
  cwd?: string;
  filesOpen: boolean;
  view: 'Terminal' | 'SFTP';
}

export interface Workspace {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  tabs: WorkspaceTab[];
  activeIndex: number;
  /** Registry panel ids (logs, services, …). */
  panels: string[];
  builtins: { docker: boolean; compose: boolean; kubernetes: boolean; monitor: boolean };
}

interface WorkspaceState {
  workspaces: Workspace[];
  save: (ws: Workspace) => void;
  rename: (id: string, name: string) => void;
  remove: (id: string) => void;
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set) => ({
      workspaces: [],
      save: (ws) => set((s) => ({
        workspaces: s.workspaces.some((w) => w.id === ws.id)
          ? s.workspaces.map((w) => (w.id === ws.id ? ws : w))
          : [ws, ...s.workspaces],
      })),
      rename: (id, name) => set((s) => ({
        workspaces: s.workspaces.map((w) => (w.id === id ? { ...w, name, updatedAt: Date.now() } : w)),
      })),
      remove: (id) => set((s) => ({ workspaces: s.workspaces.filter((w) => w.id !== id) })),
    }),
    { name: 'terminus-workspaces' },
  ),
);
