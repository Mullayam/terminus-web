/**
 * @module monaco-editor/view-panel/store
 *
 * Zustand store managing view panel registry and open panel tabs.
 */
import { create } from "zustand";
import type { ViewPanelDescriptor } from "./types";

export interface ViewPanelTab {
  /** Unique tab instance ID */
  tabId: string;
  /** Reference to the panel descriptor */
  panelId: string;
  /** Extra props for this instance */
  props?: Record<string, unknown>;
}

interface ViewPanelStore {
  /** Registry of all available view panels */
  registry: Map<string, ViewPanelDescriptor>;
  /** Currently open panel tabs */
  openTabs: ViewPanelTab[];
  /** Currently active view panel tab ID (null = editor tab is active) */
  activeViewTabId: string | null;

  /** Register a view panel descriptor */
  registerPanel: (descriptor: ViewPanelDescriptor) => void;
  /** Unregister a view panel descriptor */
  unregisterPanel: (id: string) => void;
  /** Open a view panel as a tab (returns the tab ID) */
  openPanel: (panelId: string, props?: Record<string, unknown>) => string;
  /** Close a view panel tab */
  closePanel: (tabId: string) => void;
  /** Set the active view panel tab */
  setActiveViewTab: (tabId: string | null) => void;
  /** Close all view panel tabs */
  closeAll: () => void;
  /** Get a panel descriptor by ID */
  getPanel: (id: string) => ViewPanelDescriptor | undefined;
}

let viewTabCounter = 0;

export const useViewPanelStore = create<ViewPanelStore>((set, get) => ({
  registry: new Map(),
  openTabs: [],
  activeViewTabId: null,

  registerPanel: (descriptor) => {
    const current = get().registry;
    // Skip if already registered (prevents re-render loops from plugin remounts)
    if (current.has(descriptor.id)) return;
    set((s) => {
      const next = new Map(s.registry);
      next.set(descriptor.id, descriptor);
      return { registry: next };
    });
  },

  unregisterPanel: (id) => {
    set((s) => {
      const next = new Map(s.registry);
      next.delete(id);
      // Also close any open tabs for this panel
      const openTabs = s.openTabs.filter((t) => t.panelId !== id);
      const activeViewTabId =
        s.activeViewTabId && openTabs.some((t) => t.tabId === s.activeViewTabId)
          ? s.activeViewTabId
          : null;
      return { registry: next, openTabs, activeViewTabId };
    });
  },

  openPanel: (panelId, props) => {
    const state = get();
    const descriptor = state.registry.get(panelId);
    if (!descriptor) {
      console.warn(`[ViewPanel] Panel "${panelId}" not registered`);
      return "";
    }

    // If singleton, check if already open
    if (descriptor.singleton) {
      const existing = state.openTabs.find((t) => t.panelId === panelId);
      if (existing) {
        // Only update if not already active (avoid unnecessary re-renders)
        if (state.activeViewTabId !== existing.tabId) {
          set({ activeViewTabId: existing.tabId });
        }
        return existing.tabId;
      }
    }

    const tabId = `vp-${++viewTabCounter}-${Date.now()}`;
    const tab: ViewPanelTab = { tabId, panelId, props };
    set((s) => ({
      openTabs: [...s.openTabs, tab],
      activeViewTabId: tabId,
    }));
    return tabId;
  },

  closePanel: (tabId) => {
    set((s) => {
      const openTabs = s.openTabs.filter((t) => t.tabId !== tabId);
      let activeViewTabId = s.activeViewTabId;
      if (activeViewTabId === tabId) {
        // Switch to next view tab or null (back to editor)
        activeViewTabId = openTabs.length > 0
          ? openTabs[openTabs.length - 1].tabId
          : null;
      }
      return { openTabs, activeViewTabId };
    });
  },

  setActiveViewTab: (tabId) => set({ activeViewTabId: tabId }),

  closeAll: () => set({ openTabs: [], activeViewTabId: null }),

  getPanel: (id) => get().registry.get(id),
}));
