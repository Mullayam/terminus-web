import { create } from 'zustand';

interface TerminalLogsStore {
  logs: Record<string, string[]>; 
  addLogLine: (sessionId: string, line: string) => void;
  clearLogs: (sessionId: string) => void;
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
}));
