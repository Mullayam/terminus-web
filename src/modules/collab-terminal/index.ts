/**
 * @module collab-terminal
 *
 * Self-contained collaborative terminal sharing module.
 * Can be plugged into any route — just import CollabTerminalPage.
 *
 * Architecture:
 *   types/     — Event enums + payload interfaces
 *   store/     — Zustand store (single source of truth)
 *   hooks/     — useCollabSocket (event wiring), useDebouncedToast
 *   components/— Pure UI components (badges, overlays, modals, admin panel)
 *   page/      — The assembled page component
 */

// Page (main entry point)
export { CollabTerminalPage } from './page';

// Store (for external read access if needed)
export { useCollabStore } from './store';

// Hooks
export { useCollabSocket, useDebouncedToast } from './hooks';

// Components (for à la carte usage)
export {
  PermissionBadge,
  UserCountBadge,
  LockIndicator,
  TypingIndicator,
  InputBufferBar,
  KickedModal,
  BlockedModal,
  AdminPanel,
  AdminUserList,
  AdminUnblockList,
  JoinError,
} from './components';

// Types
export type {
  CollabPermission,
  LockType,
  RejectionReason,
  JoinRejectionReason,
  RoomStatePayload,
  CollabUser,
} from './types';
export { CollabClientEvent, CollabServerEvent } from './types';
