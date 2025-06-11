import { create } from 'zustand';

interface TerminalLogsStore {
  logs: Record<string, string[]>;
  addLogLine: (sessionId: string, line: string) => void;
  clearLogs: (sessionId: string) => void;
  removeLog: (sessionId: string) => void
}

export const useTerminalStore = create<TerminalLogsStore>((set) => ({
  logs: {},

  addLogLine: (sessionId, line) =>
    set((state) => ({
      logs: {
        ...state.logs,
        [sessionId]: [...(state.logs[sessionId] || []), line],
      },
    })),

  clearLogs: (sessionId) =>
    set((state) => ({
      logs: {
        ...state.logs,
        [sessionId]: [],
      },
    })),
  removeLog: (sessionId) =>
    set((state) => {
      const newLogs = { ...state.logs };
      delete newLogs[sessionId];
      return { logs: newLogs };
    }),

}));
