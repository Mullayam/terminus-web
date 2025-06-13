import { create } from "zustand";
import { socket } from '../lib/sockets/index';

type PermissionType = '400' | '700' | '777';

type SharedSessionsType = {
  shared_sessions: Record<
    string,
    {
      socketIds: string[];
      permissions: Record<string, PermissionType>;
    }
  >;
};

interface TerminalLogsStore {
  logs: Record<string, string[]>;

  sessionInfo: SharedSessionsType;

  addLogLine: (sessionId: string, line: string) => void;
  clearLogs: (sessionId: string) => void;
  removeLog: (sessionId: string) => void;

  addSharedSession: (sessionId: string, socketId: string[]) => void;
  deleteSharedSession: (sessionId: string, socketId: string) => void;

  addPermissions: (sessionId: string, socketId: string, permission: PermissionType) => void;
  deletePermission: (sessionId: string, socketId: string) => void;
}

export const useTerminalStore = create<TerminalLogsStore>((set) => ({
  logs: {},
  sessionInfo: {
    shared_sessions: {},
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

  addSharedSession: (sessionId, socketIds) =>
    set((state) => {
      const session = state.sessionInfo.shared_sessions[sessionId] || {
        socketIds: [],
        permissions: {},
      };

      return {
        sessionInfo: {
          ...state.sessionInfo,
          shared_sessions: {
            ...state.sessionInfo.shared_sessions,
            [sessionId]: {
              ...session,
              socketIds,
            },
          },
        },
      };
    }),


  deleteSharedSession: (sessionId, socketId) =>
    set((state) => {
      const session = state.sessionInfo.shared_sessions[sessionId];
      if (!session) return {};

      const updatedSocketIds = session.socketIds.filter((id) => id !== socketId);

      return {
        sessionInfo: {
          ...state.sessionInfo,
          shared_sessions: {
            ...state.sessionInfo.shared_sessions,
            [sessionId]: {
              ...session,
              socketIds: updatedSocketIds,
            },
          },
        },
      };
    }),

  addPermissions: (sessionId, socketId, permission) =>
    set((state) => {
      const session = state.sessionInfo.shared_sessions[sessionId];
      if (!session) return {};

      const updatedPermissions = {
        ...session.permissions,
        [socketId]: permission,
      };


      return {
        sessionInfo: {
          ...state.sessionInfo,
          shared_sessions: {
            ...state.sessionInfo.shared_sessions,
            [sessionId]: {
              ...session,
              permissions: updatedPermissions,
            },
          },
        },
      };
    }),

  deletePermission: (sessionId, socketId) =>
    set((state) => {
      const session = state.sessionInfo.shared_sessions[sessionId];
      if (!session) return {};

      const updatedPermissions = { ...session.permissions };
      delete updatedPermissions[socketId];

      return {
        sessionInfo: {
          ...state.sessionInfo,
          shared_sessions: {
            ...state.sessionInfo.shared_sessions,
            [sessionId]: {
              ...session,
              permissions: updatedPermissions,
            },
          },
        },
      };
    }),

}));
