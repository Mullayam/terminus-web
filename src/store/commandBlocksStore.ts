import { create } from "zustand";
import stripAnsi from "strip-ansi";

export interface CommandBlock {
  id: string;
  command: string;
  /** ANSI-stripped output captured between this command and the next. */
  output: string;
  startedAt: number;
  running: boolean;
}

interface CommandBlocksState {
  /** sessionId → ordered list of command blocks (oldest first). */
  blocks: Record<string, CommandBlock[]>;
  /** sessionId → whether the blocks panel is open. */
  open: Record<string, boolean>;
  startBlock: (sessionId: string, command: string) => void;
  appendOutput: (sessionId: string, chunk: string) => void;
  finalizeCurrent: (sessionId: string) => void;
  clear: (sessionId: string) => void;
  togglePanel: (sessionId: string, open?: boolean) => void;
}

/** Max characters retained per block to bound memory. */
const MAX_BLOCK_OUTPUT = 8000;
/** Max blocks retained per session. */
const MAX_BLOCKS = 200;

/** Strip ANSI escape sequences and carriage returns for plain-ASCII output. */
function cleanOutput(str: string): string {
  return stripAnsi(str).replace(/\r/g, "");
}

function capOutput(s: string): string {
  return s.length > MAX_BLOCK_OUTPUT ? s.slice(s.length - MAX_BLOCK_OUTPUT) : s;
}

// Throttle output commits so streaming data doesn't set() on every chunk.
const pending: Record<string, string> = {};
let flushTimer: ReturnType<typeof setTimeout> | null = null;

export const useCommandBlocksStore = create<CommandBlocksState>((set) => ({
  blocks: {},
  open: {},

  startBlock: (sessionId, command) =>
    set((state) => {
      const list = state.blocks[sessionId] ?? [];
      // Keep commands unique: drop any prior block for the same command and
      // finalize the rest, so a re-run replaces the old entry with fresh output.
      const kept = list
        .filter((b) => b.command !== command)
        .map((b) => (b.running ? { ...b, running: false } : b));
      const block: CommandBlock = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        command,
        output: "",
        startedAt: Date.now(),
        running: true,
      };
      const next = [...kept, block];
      return { blocks: { ...state.blocks, [sessionId]: next.slice(-MAX_BLOCKS) } };
    }),

  appendOutput: (sessionId, chunk) => {
    pending[sessionId] = (pending[sessionId] ?? "") + chunk;
    if (flushTimer) return;
    flushTimer = setTimeout(() => {
      flushTimer = null;
      set((state) => {
        const blocks = { ...state.blocks };
        let changed = false;
        for (const sid of Object.keys(pending)) {
          const chunkStr = pending[sid];
          delete pending[sid];
          const list = blocks[sid];
          if (!list || list.length === 0) continue;
          const last = list[list.length - 1];
          if (!last.running) continue;
          const newList = list.slice();
          newList[newList.length - 1] = { ...last, output: capOutput(last.output + cleanOutput(chunkStr)) };
          blocks[sid] = newList;
          changed = true;
        }
        return changed ? { blocks } : {};
      });
    }, 250);
  },

  finalizeCurrent: (sessionId) =>
    set((state) => {
      const list = state.blocks[sessionId];
      if (!list || list.length === 0) return {};
      if (!list[list.length - 1].running) return {};
      const next = list.map((b) => (b.running ? { ...b, running: false } : b));
      return { blocks: { ...state.blocks, [sessionId]: next } };
    }),

  clear: (sessionId) =>
    set((state) => ({ blocks: { ...state.blocks, [sessionId]: [] } })),

  togglePanel: (sessionId, open) =>
    set((state) => ({
      open: { ...state.open, [sessionId]: open ?? !state.open[sessionId] },
    })),
}));
