/**
 * @module editor/terminal/store
 *
 * Lightweight Zustand store for the embedded terminal panel.
 * Completely independent from the editor store — manages only
 * the terminal's open/close state and panel height.
 */
import { create } from "zustand";

export interface TerminalPanelState {
    /** Whether the terminal panel is visible */
    open: boolean;
    /** Panel height in pixels (persisted across toggle) */
    height: number;
}

export interface TerminalPanelActions {
    toggle: () => void;
    setOpen: (open: boolean) => void;
    setHeight: (height: number) => void;
}

export type TerminalPanelStore = TerminalPanelState & TerminalPanelActions;

const MIN_HEIGHT = 100;
const MAX_HEIGHT_RATIO = 0.7; // 70% of viewport
const DEFAULT_HEIGHT = 220;

export const useTerminalPanelStore = create<TerminalPanelStore>((set) => ({
    open: false,
    height: DEFAULT_HEIGHT,

    toggle: () => set((s) => ({ open: !s.open })),
    setOpen: (open) => set({ open }),
    setHeight: (height) =>
        set({
            height: Math.max(
                MIN_HEIGHT,
                Math.min(height, window.innerHeight * MAX_HEIGHT_RATIO),
            ),
        }),
}));
