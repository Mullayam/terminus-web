import { HostsObject } from "@/pages";
import { create } from "zustand";

type SharedSessionsType = {
  shared_sessions: string[];
  permissions: Record<string, string>;
};

interface TerminalLogsStore {
  logs: Record<string, string[]>;
  sessionInfo: SharedSessionsType;

  addLogLine: (sessionId: string, line: string) => void;
  clearLogs: (sessionId: string) => void;
  removeLog: (sessionId: string) => void;

  addSharedSession: (socketId: string) => void;
  deleteSharedSession: (socketId: string) => void;

  addPermissions: (sessionId: string, permission: string) => void;
  deletePermission: (sessionId: string) => void;
}

export const useTerminalStore = create<TerminalLogsStore>((set) => ({
  logs: {},
  sessionInfo: {
    shared_sessions: [],
    permissions: {},
  },

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

  addSharedSession: (socketId) =>
    set((state) => {
      const exists = state.sessionInfo.shared_sessions.includes(socketId);
      return {
        sessionInfo: {
          ...state.sessionInfo,
          shared_sessions: exists
            ? state.sessionInfo.shared_sessions
            : [...state.sessionInfo.shared_sessions, socketId],
        },
      };
    }),

  deleteSharedSession: (socketId) =>
    set((state) => ({
      sessionInfo: {
        ...state.sessionInfo,
        shared_sessions: state.sessionInfo.shared_sessions.filter(
          (id) => id !== socketId
        ),
      },
    })),

  addPermissions: (sessionId, permission) =>
    set((state) => ({
      sessionInfo: {
        ...state.sessionInfo,
        permissions: {
          ...state.sessionInfo.permissions,
          [sessionId]: permission,
        },
      },
    })),

  deletePermission: (sessionId) =>
    set((state) => {
      const newPermissions = { ...state.sessionInfo.permissions };
      delete newPermissions[sessionId];
      return {
        sessionInfo: {
          ...state.sessionInfo,
          permissions: newPermissions,
        },
      };
    }),
}));
