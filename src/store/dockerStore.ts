import { create } from "zustand";

/**
 * Toggle state for the floating Docker panel.
 * Mirrors monitorStore so the topbar button and the terminal keyboard
 * shortcut (Ctrl+Shift+D) can both drive it.
 */
interface DockerState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

export const useDockerStore = create<DockerState>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggle: () => set((s) => ({ isOpen: !s.isOpen })),
}));
