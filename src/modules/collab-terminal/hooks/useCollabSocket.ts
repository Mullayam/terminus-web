/**
 * useCollabSocket — the single hook that wires all @@COLLAB_* events.
 *
 * Responsibilities:
 *  1. Emit JOIN on mount
 *  2. Listen to every server event and update the collab store
 *  3. Provide `emit*` helpers for the UI layer to call
 *  4. Clean up all listeners on unmount
 *
 * Usage:
 *   const { emitInput, emitAdminLock, ... } = useCollabSocket(socket, sessionId);
 */
import { useEffect, useCallback } from 'react';
import type { Socket } from 'socket.io-client';
import { CollabClientEvent, CollabServerEvent } from '../types/events';
import type {
  RoomStatusPayload,
  RoomStatePayload,
  JoinRejectedPayload,
  UserJoinedPayload,
  UserLeftPayload,
  PTYLockedPayload,
  PermissionChangedPayload,
  InputRejectedPayload,
  UserKickedPayload,
  UserBlockedPayload,
  SessionEndedPayload,
  CollabPermission,
} from '../types';
import { useCollabStore } from '../store';
import { useDebouncedToast } from './useDebouncedToast';

export function useCollabSocket(socket: Socket | null, sessionId: string) {
  const store = useCollabStore();
  const debouncedToast = useDebouncedToast(3000);

  // ── Subscribe to all server events ────────────────────────────────────
  useEffect(() => {
    if (!socket || !sessionId) return;

    store.setSessionId(sessionId);

    // NOTE: We no longer auto-join here. The page should call
    // emitCheckRoom() first, then joinRoom() after ROOM_STATUS confirms
    // the session is joinable.

    // ── Handlers ──────────────────────────────────────────────────────
    const onRoomStatus = (data: RoomStatusPayload) => {
      store.setRoomStatus(data);
    };

    const onRoomState = (data: RoomStatePayload) => {
      store.setRoomState({
        permission: data.permission,
        isAdmin: data.isAdmin,
        userCount: data.userCount,
        isLocked: data.isLocked,
        lockType: data.lockType,
        lockedBy: data.lockedBy,
      });
    };

    const onJoinRejected = (data: JoinRejectedPayload) => {
      store.setJoinError({ reason: data.reason, message: data.message });
    };

    const onUserJoined = (data: UserJoinedPayload) => {
      store.setUserCount(data.userCount);
      store.addUser({
        socketId: data.socketId,
        permission: '400', // new users join read-only
        ip: data.ip,
      });
    };

    const onUserLeft = (data: UserLeftPayload) => {
      store.setUserCount(data.userCount);
      store.removeUser(data.socketId);
    };

    const onPtyLocked = (data: PTYLockedPayload) => {
      store.setLock(data.lockedBy, data.type);
    };

    const onPtyUnlocked = () => {
      store.clearLock();
    };

    const onPermissionChanged = (data: PermissionChangedPayload) => {
      store.setPermission(data.permission);
      debouncedToast('permission-changed', {
        title: 'Permission Updated',
        description:
          data.permission === '700'
            ? 'You now have write access.'
            : 'You are now in read-only mode.',
      });
    };

    const onInputRejected = (data: InputRejectedPayload) => {
      debouncedToast(`input-rejected-${data.reason}`, {
        title: 'Input Rejected',
        description: data.message,
        variant: 'destructive',
      });
    };

    const onKicked = (data: UserKickedPayload) => {
      store.setKickedMessage(data.message);
    };

    const onBlocked = (data: UserBlockedPayload) => {
      store.setBlockedMessage(data.message);
    };

    const onSessionEnded = (data: SessionEndedPayload) => {
      store.setSessionEnded({ reason: data.reason, message: data.message });
    };

    // ── Bind ─────────────────────────────────────────────────────────
    socket.on(CollabServerEvent.ROOM_STATUS, onRoomStatus);
    socket.on(CollabServerEvent.ROOM_STATE, onRoomState);
    socket.on(CollabServerEvent.JOIN_REJECTED, onJoinRejected);
    socket.on(CollabServerEvent.USER_JOINED, onUserJoined);
    socket.on(CollabServerEvent.USER_LEFT, onUserLeft);
    socket.on(CollabServerEvent.PTY_LOCKED, onPtyLocked);
    socket.on(CollabServerEvent.PTY_UNLOCKED, onPtyUnlocked);
    socket.on(CollabServerEvent.PERMISSION_CHANGED, onPermissionChanged);
    socket.on(CollabServerEvent.INPUT_REJECTED, onInputRejected);
    socket.on(CollabServerEvent.USER_KICKED, onKicked);
    socket.on(CollabServerEvent.USER_BLOCKED, onBlocked);
    socket.on(CollabServerEvent.SESSION_ENDED, onSessionEnded);

    return () => {
      socket.off(CollabServerEvent.ROOM_STATUS, onRoomStatus);
      socket.off(CollabServerEvent.ROOM_STATE, onRoomState);
      socket.off(CollabServerEvent.JOIN_REJECTED, onJoinRejected);
      socket.off(CollabServerEvent.USER_JOINED, onUserJoined);
      socket.off(CollabServerEvent.USER_LEFT, onUserLeft);
      socket.off(CollabServerEvent.PTY_LOCKED, onPtyLocked);
      socket.off(CollabServerEvent.PTY_UNLOCKED, onPtyUnlocked);
      socket.off(CollabServerEvent.PERMISSION_CHANGED, onPermissionChanged);
      socket.off(CollabServerEvent.INPUT_REJECTED, onInputRejected);
      socket.off(CollabServerEvent.USER_KICKED, onKicked);
      socket.off(CollabServerEvent.USER_BLOCKED, onBlocked);
      socket.off(CollabServerEvent.SESSION_ENDED, onSessionEnded);
      store.reset();
    };
  }, [socket, sessionId]);

  // ── Emitters ──────────────────────────────────────────────────────────

  /** Pre-flight: check if session exists and IP is not blocked */
  const emitCheckRoom = useCallback(() => {
    socket?.emit(CollabClientEvent.CHECK_ROOM, { sessionId });
  }, [socket, sessionId]);

  /** Join the collab room (call only after ROOM_STATUS confirms it's safe) */
  const joinRoom = useCallback(() => {
    socket?.emit(CollabClientEvent.JOIN_TERMINAL, { sessionId });
  }, [socket, sessionId]);

  const emitInput = useCallback(
    (data: string) => {
      socket?.emit(CollabClientEvent.INPUT, data);
    },
    [socket]
  );

  const emitAdminLock = useCallback(
    (lock: boolean) => {
      socket?.emit(CollabClientEvent.ADMIN_LOCK, { sessionId, lock });
    },
    [socket, sessionId]
  );

  const emitChangePermission = useCallback(
    (targetSocketId: string, permission: '400' | '700') => {
      socket?.emit(CollabClientEvent.CHANGE_PERMISSION, {
        sessionId,
        targetSocketId,
        permission,
      });
    },
    [socket, sessionId]
  );

  const emitKickUser = useCallback(
    (targetSocketId: string, message?: string) => {
      socket?.emit(CollabClientEvent.KICK_USER, {
        sessionId,
        targetSocketId,
        message,
      });
    },
    [socket, sessionId]
  );

  const emitBlockUser = useCallback(
    (targetSocketId: string, message?: string) => {
      socket?.emit(CollabClientEvent.BLOCK_USER, {
        sessionId,
        targetSocketId,
        message,
      });
    },
    [socket, sessionId]
  );

  const emitUnblockIP = useCallback(
    (ip: string) => {
      socket?.emit(CollabClientEvent.UNBLOCK_IP, { sessionId, ip });
    },
    [socket, sessionId]
  );

  return {
    emitCheckRoom,
    joinRoom,
    emitInput,
    emitAdminLock,
    emitChangePermission,
    emitKickUser,
    emitBlockUser,
    emitUnblockIP,
  };
}
