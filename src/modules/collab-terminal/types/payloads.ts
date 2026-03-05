/**
 * TypeScript interfaces for all collaborative terminal payloads.
 */

// ─── Permission & Lock primitives ────────────────────────────────────────────
export type CollabPermission = '400' | '700' | '777';
export type LockType = 'auto' | 'admin';
export type RejectionReason = 'read-only' | 'locked-auto' | 'locked-admin';
export type JoinRejectionReason = 'session-not-found' | 'blocked';

// ─── Client → Server payloads ────────────────────────────────────────────────
export interface JoinTerminalPayload {
  sessionId: string;
}

export interface AdminLockPayload {
  sessionId: string;
  lock: boolean;
}

export interface ChangePermissionPayload {
  sessionId: string;
  targetSocketId: string;
  permission: '400' | '700';
}

export interface KickUserPayload {
  sessionId: string;
  targetSocketId: string;
  message?: string;
}

export interface BlockUserPayload {
  sessionId: string;
  targetSocketId: string;
  message?: string;
}

export interface UnblockIPPayload {
  sessionId: string;
  ip: string;
}

// ─── Server → Client payloads ────────────────────────────────────────────────
export interface RoomStatePayload {
  lockedBy: string | null;
  lockType: LockType | null;
  isLocked: boolean;
  permission: CollabPermission;
  userCount: number;
  isAdmin: boolean;
}

export interface JoinRejectedPayload {
  reason: JoinRejectionReason;
  message: string;
}

export interface UserJoinedPayload {
  socketId: string;
  userCount: number;
  ip?: string; // only sent to admin
}

export interface UserLeftPayload {
  socketId: string;
  userCount: number;
}

export interface PTYLockedPayload {
  lockedBy: string;
  type: LockType;
  expiresIn?: number;
}

export interface PTYUnlockedPayload {}

export interface PermissionChangedPayload {
  permission: '400' | '700';
}

export interface InputRejectedPayload {
  reason: RejectionReason;
  message: string;
}

export interface UserKickedPayload {
  message: string;
}

export interface UserBlockedPayload {
  message: string;
}

// ─── Derived types for admin user list ───────────────────────────────────────
export interface CollabUser {
  socketId: string;
  permission: CollabPermission;
  ip?: string;
}
