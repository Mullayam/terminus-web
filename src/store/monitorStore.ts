import { create } from "zustand";

/**
 * Toggle state for the floating Resource Monitor panel.
 * Kept in a tiny store so both the topbar button and the terminal keyboard
 * shortcut (Ctrl+Shift+M) can drive it.
 */
interface MonitorState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

export const useMonitorStore = create<MonitorState>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggle: () => set((s) => ({ isOpen: !s.isOpen })),
}));
