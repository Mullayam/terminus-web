import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Saved command snippets, scoped to one host (`user@host`) or to every host.
 * Unlike quick commands (a global button bar), these are meant for
 * server-specific chores: deploy scripts, log paths, service names.
 */
export interface Snippet {
  id: string;
  name: string;
  command: string;
  /** `user@host`, or null for every host. */
  hostKey: string | null;
  tags?: string[];
  createdAt: number;
  lastUsedAt?: number;
  uses: number;
}

export type SnippetInput = Pick<Snippet, 'name' | 'command' | 'hostKey' | 'tags'>;

interface SnippetState {
  snippets: Snippet[];
  add: (input: SnippetInput) => void;
  update: (id: string, input: SnippetInput) => void;
  remove: (id: string) => void;
  markUsed: (id: string) => void;
}

const newId = () => `sn-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export const useSnippetStore = create<SnippetState>()(
  persist(
    (set) => ({
      snippets: [],
      add: (input) =>
        set((s) => ({ snippets: [...s.snippets, { ...input, id: newId(), createdAt: Date.now(), uses: 0 }] })),
      update: (id, input) =>
        set((s) => ({ snippets: s.snippets.map((sn) => (sn.id === id ? { ...sn, ...input } : sn)) })),
      remove: (id) => set((s) => ({ snippets: s.snippets.filter((sn) => sn.id !== id) })),
      markUsed: (id) =>
        set((s) => ({
          snippets: s.snippets.map((sn) => (sn.id === id ? { ...sn, uses: sn.uses + 1, lastUsedAt: Date.now() } : sn)),
        })),
    }),
    { name: 'terminus-host-snippets' },
  ),
);
