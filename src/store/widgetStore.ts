import { create } from "zustand";
import { v4 as uuid } from "uuid";
import { idb } from "@/lib/idb";
import type { WidgetDef } from "@/lib/widgets/types";
import { PREBUILT_WIDGETS } from "@/lib/widgets/types";

interface WidgetState {
  defs: WidgetDef[];
  openIds: string[];
  loaded: boolean;
  load: () => Promise<void>;
  addWidget: (def: Omit<WidgetDef, "id" | "createdAt">) => Promise<WidgetDef>;
  updateWidget: (id: string, patch: Partial<WidgetDef>) => Promise<void>;
  removeWidget: (id: string) => Promise<void>;
  open: (id: string) => void;
  close: (id: string) => void;
  toggleOpen: (id: string) => void;
}

export const useWidgetStore = create<WidgetState>((set, get) => ({
  defs: [],
  openIds: [],
  loaded: false,

  load: async () => {
    if (get().loaded) return;
    let defs = await idb.getAllItems("widgets");
    if (!defs || defs.length === 0) {
      const now = Date.now();
      const seeded: WidgetDef[] = PREBUILT_WIDGETS.map((w, i) => ({ ...w, createdAt: now + i }));
      await idb.bulkPutItems("widgets", seeded);
      defs = seeded;
    }
    defs.sort((a, b) => a.createdAt - b.createdAt);
    set({ defs, loaded: true });
  },

  addWidget: async (input) => {
    const def: WidgetDef = { ...input, id: uuid(), createdAt: Date.now() };
    await idb.putItem("widgets", def);
    set((s) => ({ defs: [...s.defs, def] }));
    return def;
  },

  updateWidget: async (id, patch) => {
    await idb.updateItem("widgets", id, patch as WidgetDef);
    set((s) => ({ defs: s.defs.map((d) => (d.id === id ? { ...d, ...patch } : d)) }));
  },

  removeWidget: async (id) => {
    await idb.deleteItem("widgets", id);
    set((s) => ({ defs: s.defs.filter((d) => d.id !== id), openIds: s.openIds.filter((x) => x !== id) }));
  },

  open: (id) => set((s) => (s.openIds.includes(id) ? s : { openIds: [...s.openIds, id] })),
  close: (id) => set((s) => ({ openIds: s.openIds.filter((x) => x !== id) })),
  toggleOpen: (id) =>
    set((s) => (s.openIds.includes(id) ? { openIds: s.openIds.filter((x) => x !== id) } : { openIds: [...s.openIds, id] })),
}));
