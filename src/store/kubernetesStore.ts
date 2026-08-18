import { create } from "zustand";

interface KubernetesState {
  isOpen: boolean;
  namespace: string;
  open: () => void;
  close: () => void;
  toggle: () => void;
  setNamespace: (ns: string) => void;
}

export const useKubernetesStore = create<KubernetesState>((set) => ({
  isOpen: false,
  namespace: "default",
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggle: () => set((s) => ({ isOpen: !s.isOpen })),
  setNamespace: (namespace) => set({ namespace }),
}));
