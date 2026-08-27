import { create } from "zustand";

/**
 * Toggle state for the floating Docker Compose panel.
 * Mirrors dockerStore so the topbar button and the Widget Center can both
 * drive it.
 */
interface ComposeState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

export const useComposeStore = create<ComposeState>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggle: () => set((s) => ({ isOpen: !s.isOpen })),
}));
