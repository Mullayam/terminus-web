import { create } from "zustand";

/** A user-defined button that runs a fixed command in the active terminal. */
export interface QuickCommand {
  id: string;
  label: string;
  command: string;
}

interface QuickCommandsState {
  buttons: QuickCommand[];
  /** Whether the docked quick-command bar is shown (dragged-to-close hides it). */
  visible: boolean;
  add: (label: string, command: string) => void;
  update: (id: string, patch: Partial<Omit<QuickCommand, "id">>) => void;
  remove: (id: string) => void;
  setVisible: (v: boolean) => void;
}

const LS_BUTTONS = "terminus-quick-commands";
const LS_VISIBLE = "terminus-quick-commands-visible";

function loadButtons(): QuickCommand[] {
  try {
    const raw = localStorage.getItem(LS_BUTTONS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.filter((b) => b && b.id && typeof b.command === "string");
    }
  } catch { /* ignore corrupt state */ }
  // Seed with a couple of common shortcuts so the feature is discoverable.
  return [
    { id: "qc-clear", label: "clear", command: "clear" },
    { id: "qc-ls", label: "ls -la", command: "ls -la" },
  ];
}

function loadVisible(): boolean {
  try {
    return localStorage.getItem(LS_VISIBLE) !== "0";
  } catch {
    return true;
  }
}

function persistButtons(buttons: QuickCommand[]) {
  try { localStorage.setItem(LS_BUTTONS, JSON.stringify(buttons)); } catch { /* ignore */ }
}

function persistVisible(v: boolean) {
  try { localStorage.setItem(LS_VISIBLE, v ? "1" : "0"); } catch { /* ignore */ }
}

function makeId(): string {
  return `qc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export const useQuickCommandsStore = create<QuickCommandsState>((set, get) => ({
  buttons: loadButtons(),
  visible: loadVisible(),

  add: (label, command) => {
    const cmd = command.trim();
    if (!cmd) return;
    const button: QuickCommand = { id: makeId(), label: label.trim() || cmd, command: cmd };
    const buttons = [...get().buttons, button];
    persistButtons(buttons);
    set({ buttons });
  },

  update: (id, patch) => {
    const buttons = get().buttons.map((b) => (b.id === id ? { ...b, ...patch } : b));
    persistButtons(buttons);
    set({ buttons });
  },

  remove: (id) => {
    const buttons = get().buttons.filter((b) => b.id !== id);
    persistButtons(buttons);
    set({ buttons });
  },

  setVisible: (v) => {
    persistVisible(v);
    set({ visible: v });
  },
}));
