/**
 * Zustand store for collaborative terminal state.
 *
 * Single source of truth for:
 *  - Room state (permission, lock, user count, admin flag)
 *  - Connected users list (admin only)
 *  - Lock state & typing user info
 *  - Input buffer (client-side buffering while locked)
 *  - Kick/block modals
 *  - Blocked IPs list (admin)
 */
import { create } from 'zustand';
import type {
  CollabPermission,
  LockType,
  CollabUser,
} from '../types';

interface CollabStore {
  // ── Connection ──────────────────────────────────────────────────────────
  sessionId: string | null;
  joined: boolean;
  joinError: { reason: string; message: string } | null;

  // ── Room state ──────────────────────────────────────────────────────────
  permission: CollabPermission;
  isAdmin: boolean;
  userCount: number;

  // ── Lock ────────────────────────────────────────────────────────────────
  isLocked: boolean;
  lockType: LockType | null;
  lockedBy: string | null;

  // ── Input buffer ────────────────────────────────────────────────────────
  inputBuffer: string;
  showBufferPrompt: boolean;  // true when lock releases & buffer has content

  // ── Users (admin) ───────────────────────────────────────────────────────
  users: CollabUser[];
  blockedIPs: string[];

  // ── Modals ──────────────────────────────────────────────────────────────
  kickedMessage: string | null;
  blockedMessage: string | null;

  // ── Actions ─────────────────────────────────────────────────────────────
  setSessionId: (id: string) => void;

  // Room
  setRoomState: (state: {
    permission: CollabPermission;
    isAdmin: boolean;
    userCount: number;
    isLocked: boolean;
    lockType: LockType | null;
    lockedBy: string | null;
  }) => void;
  setJoined: (joined: boolean) => void;
  setJoinError: (error: { reason: string; message: string } | null) => void;

  // Permission
  setPermission: (permission: CollabPermission) => void;

  // Lock
  setLock: (lockedBy: string, type: LockType) => void;
  clearLock: () => void;

  // Presence
  setUserCount: (count: number) => void;
  addUser: (user: CollabUser) => void;
  removeUser: (socketId: string) => void;
  updateUserPermission: (socketId: string, permission: CollabPermission) => void;

  // Input buffer
  appendToBuffer: (char: string) => void;
  clearBuffer: () => void;
  setShowBufferPrompt: (show: boolean) => void;

  // Admin: blocked IPs
  addBlockedIP: (ip: string) => void;
  removeBlockedIP: (ip: string) => void;

  // Modals
  setKickedMessage: (message: string | null) => void;
  setBlockedMessage: (message: string | null) => void;

  // Reset
  reset: () => void;
}

const INITIAL_STATE = {
  sessionId: null,
  joined: false,
  joinError: null,
  permission: '400' as CollabPermission,
  isAdmin: false,
  userCount: 0,
  isLocked: false,
  lockType: null as LockType | null,
  lockedBy: null as string | null,
  inputBuffer: '',
  showBufferPrompt: false,
  users: [] as CollabUser[],
  blockedIPs: [] as string[],
  kickedMessage: null as string | null,
  blockedMessage: null as string | null,
};

export const useCollabStore = create<CollabStore>((set) => ({
  ...INITIAL_STATE,

  setSessionId: (id) => set({ sessionId: id }),

  setRoomState: (state) =>
    set({
      permission: state.permission,
      isAdmin: state.isAdmin,
      userCount: state.userCount,
      isLocked: state.isLocked,
      lockType: state.lockType,
      lockedBy: state.lockedBy,
      joined: true,
      joinError: null,
    }),

  setJoined: (joined) => set({ joined }),
  setJoinError: (error) => set({ joinError: error, joined: false }),

  setPermission: (permission) => set({ permission }),

  setLock: (lockedBy, type) =>
    set({ isLocked: true, lockedBy, lockType: type }),

  clearLock: () =>
    set((state) => ({
      isLocked: false,
      lockedBy: null,
      lockType: null,
      // If there's buffered input, prompt the user
      showBufferPrompt: state.inputBuffer.length > 0,
    })),

  setUserCount: (count) => set({ userCount: count }),

  addUser: (user) =>
    set((state) => ({
      users: state.users.some((u) => u.socketId === user.socketId)
        ? state.users
        : [...state.users, user],
    })),

  removeUser: (socketId) =>
    set((state) => ({
      users: state.users.filter((u) => u.socketId !== socketId),
    })),

  updateUserPermission: (socketId, permission) =>
    set((state) => ({
      users: state.users.map((u) =>
        u.socketId === socketId ? { ...u, permission } : u
      ),
    })),

  appendToBuffer: (char) =>
    set((state) => ({ inputBuffer: state.inputBuffer + char })),

  clearBuffer: () => set({ inputBuffer: '', showBufferPrompt: false }),
  setShowBufferPrompt: (show) => set({ showBufferPrompt: show }),

  addBlockedIP: (ip) =>
    set((state) => ({
      blockedIPs: state.blockedIPs.includes(ip)
        ? state.blockedIPs
        : [...state.blockedIPs, ip],
    })),

  removeBlockedIP: (ip) =>
    set((state) => ({
      blockedIPs: state.blockedIPs.filter((i) => i !== ip),
    })),

  setKickedMessage: (message) => set({ kickedMessage: message }),
  setBlockedMessage: (message) => set({ blockedMessage: message }),

  reset: () => set(INITIAL_STATE),
}));
