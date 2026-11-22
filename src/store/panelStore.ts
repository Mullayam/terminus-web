import { create } from 'zustand';

/**
 * Open/closed state for the registry-driven floating panels (log viewer,
 * services, ports, …). Panel ids come from `terminal2/panels.tsx`; Docker,
 * Compose and Kubernetes keep their own stores.
 */
interface PanelState {
  open: Record<string, boolean>;
  toggle: (id: string) => void;
  openPanel: (id: string) => void;
  close: (id: string) => void;
}

export const usePanelStore = create<PanelState>((set) => ({
  open: {},
  toggle: (id) => set((s) => ({ open: { ...s.open, [id]: !s.open[id] } })),
  openPanel: (id) => set((s) => ({ open: { ...s.open, [id]: true } })),
  close: (id) => set((s) => ({ open: { ...s.open, [id]: false } })),
}));
