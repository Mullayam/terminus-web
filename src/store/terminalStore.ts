// sshStore.ts
import { socket } from '@/lib/sockets';
import { create } from 'zustand';

interface TerminalLogsStore {
  logs: Record<string, string[]>; // sessionId -> array of log lines
  // socket: Record<string, string[]>; // sessionId -> array of log lines

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
