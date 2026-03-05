/**
 * Collaborative terminal event constants.
 * All prefixed with @@COLLAB_ to avoid clashing with existing @@SSH_* events.
 */

// ─── Client → Server ─────────────────────────────────────────────────────────
export enum CollabClientEvent {
  CHECK_ROOM          = '@@COLLAB_CHECK_ROOM',
  JOIN_TERMINAL       = '@@COLLAB_JOIN_TERMINAL',
  INPUT               = '@@COLLAB_INPUT',
  ADMIN_LOCK          = '@@COLLAB_ADMIN_LOCK',
  CHANGE_PERMISSION   = '@@COLLAB_CHANGE_PERMISSION',
  KICK_USER           = '@@COLLAB_KICK_USER',
  BLOCK_USER          = '@@COLLAB_BLOCK_USER',
  UNBLOCK_IP          = '@@COLLAB_UNBLOCK_IP',
}

// ─── Server → Client ─────────────────────────────────────────────────────────
export enum CollabServerEvent {
  ROOM_STATUS         = '@@COLLAB_ROOM_STATUS',
  ROOM_STATE          = '@@COLLAB_ROOM_STATE',
  JOIN_REJECTED       = '@@COLLAB_JOIN_REJECTED',
  USER_JOINED         = '@@COLLAB_USER_JOINED',
  USER_LEFT           = '@@COLLAB_USER_LEFT',
  TERMINAL_OUTPUT     = '@@COLLAB_TERMINAL_OUTPUT',
  PTY_LOCKED          = '@@COLLAB_PTY_LOCKED',
  PTY_UNLOCKED        = '@@COLLAB_PTY_UNLOCKED',
  PERMISSION_CHANGED  = '@@COLLAB_PERMISSION_CHANGED',
  INPUT_REJECTED      = '@@COLLAB_INPUT_REJECTED',
  USER_KICKED         = '@@COLLAB_USER_KICKED',
  USER_BLOCKED        = '@@COLLAB_USER_BLOCKED',
  SESSION_ENDED       = '@@COLLAB_SESSION_ENDED',
}
