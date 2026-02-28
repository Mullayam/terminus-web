/**
 * @module monaco-editor/plugins/notification-plugin
 *
 * VS Code-style notification plugin for Monaco Editor.
 *
 * Receives real-time notifications from the backend via Socket.IO
 * and displays them as VS Code-style toast overlays.
 *
 * Backend events supported:
 *   - `@@EDITOR_NOTIFICATION`  — display a notification
 *   - `@@EDITOR_NOTIFICATION_UPDATE` — update an existing notification (progress)
 *   - `@@EDITOR_NOTIFICATION_DISMISS` — dismiss a notification
 *
 * Also integrates with the plugin `ctx.notify()` system, so any
 * plugin can trigger a notification.
 *
 * Usage:
 *   import { createNotificationPlugin } from "@/modules/monaco-editor";
 *   import { socket } from "@/lib/sockets";
 *
 *   const notifPlugin = createNotificationPlugin({ socket });
 *   <MonacoEditor plugins={[notifPlugin]} />
 */

import type { MonacoPlugin, PluginContext } from "../types";
import type { Socket } from "socket.io-client";
import type { EditorNotificationsHandle, NotificationSeverity } from "../components/EditorNotifications";

/* ── Socket event names ────────────────────────────────────── */

export const NOTIFICATION_EVENTS = {
  /** Server → Client: show a notification */
  SHOW: "@@EDITOR_NOTIFICATION",
  /** Server → Client: update an existing notification */
  UPDATE: "@@EDITOR_NOTIFICATION_UPDATE",
  /** Server → Client: dismiss a notification */
  DISMISS: "@@EDITOR_NOTIFICATION_DISMISS",
} as const;

/* ── Backend payload types ─────────────────────────────────── */

export interface BackendNotification {
  /** Message text */
  message: string;
  /** Severity: "info" | "warning" | "error" | "success" */
  severity?: NotificationSeverity;
  /** Source label (e.g. "LSP", "Build", "Deploy") */
  source?: string;
  /** Expandable detail text */
  detail?: string;
  /** Progress: 0–100 or "indeterminate" */
  progress?: number | "indeterminate";
  /** Auto-dismiss timeout in ms (default: 8000, 0 = sticky) */
  timeout?: number;
  /** Action labels (clicks emit `@@EDITOR_NOTIFICATION_ACTION` back) */
  actions?: Array<{ label: string; id: string; primary?: boolean }>;
  /** Unique ID (server can set this to update/dismiss later) */
  id?: string;
}

export interface BackendNotificationUpdate {
  /** Notification ID to update */
  id: string;
  /** New message */
  message?: string;
  /** New progress */
  progress?: number | "indeterminate";
  /** New detail */
  detail?: string;
  /** New severity */
  severity?: NotificationSeverity;
}

export interface BackendNotificationDismiss {
  /** Notification ID to dismiss */
  id: string;
}

/* ── Plugin options ────────────────────────────────────────── */

export interface NotificationPluginOptions {
  /** Socket.IO client instance */
  socket?: Socket;
  /** Max visible notifications at once (default: 4) */
  maxVisible?: number;
  /** Default auto-dismiss timeout in ms (default: 8000) */
  defaultTimeout?: number;
}

/* ── Notification store (global for imperative access) ──────── */

let _notificationsHandle: EditorNotificationsHandle | null = null;
let _socket: Socket | null = null;
/** Map of server-assigned IDs → internal notification IDs */
const _serverIdMap = new Map<string, string>();

/**
 * Set the notifications handle (called by MonacoEditor when the
 * EditorNotifications component mounts).
 */
export function setNotificationsHandle(handle: EditorNotificationsHandle | null) {
  _notificationsHandle = handle;
}

/**
 * Get the current notifications handle for imperative use.
 */
export function getNotificationsHandle(): EditorNotificationsHandle | null {
  return _notificationsHandle;
}

/**
 * Show a notification programmatically (from anywhere in the app).
 */
export function showEditorNotification(
  message: string,
  severity: NotificationSeverity = "info",
  options?: {
    source?: string;
    detail?: string;
    progress?: number | "indeterminate";
    timeout?: number;
    actions?: Array<{ label: string; onClick: () => void; primary?: boolean }>;
  },
): string | null {
  if (!_notificationsHandle) {
    console.warn("[Notifications] No notification handle available");
    return null;
  }
  return _notificationsHandle.addNotification({
    message,
    severity,
    source: options?.source,
    detail: options?.detail,
    progress: options?.progress,
    timeout: options?.timeout,
    actions: options?.actions,
  });
}

/* ── Socket event handlers ─────────────────────────────────── */

function handleShowNotification(payload: BackendNotification) {
  if (!_notificationsHandle) return;

  const internalId = _notificationsHandle.addNotification({
    message: payload.message,
    severity: payload.severity ?? "info",
    source: payload.source,
    detail: payload.detail,
    progress: payload.progress,
    timeout: payload.timeout,
    actions: payload.actions?.map((a) => ({
      label: a.label,
      primary: a.primary,
      onClick: () => {
        // Emit action back to server
        _socket?.emit("@@EDITOR_NOTIFICATION_ACTION", {
          notificationId: payload.id,
          actionId: a.id,
        });
      },
    })),
  });

  // Track server ID → internal ID mapping
  if (payload.id) {
    _serverIdMap.set(payload.id, internalId);
  }
}

function handleUpdateNotification(payload: BackendNotificationUpdate) {
  if (!_notificationsHandle) return;
  const internalId = _serverIdMap.get(payload.id) ?? payload.id;
  _notificationsHandle.updateNotification(internalId, {
    message: payload.message,
    progress: payload.progress,
    detail: payload.detail,
    severity: payload.severity,
  });
}

function handleDismissNotification(payload: BackendNotificationDismiss) {
  if (!_notificationsHandle) return;
  const internalId = _serverIdMap.get(payload.id) ?? payload.id;
  _notificationsHandle.removeNotification(internalId);
  _serverIdMap.delete(payload.id);
}

/* ── Plugin factory ────────────────────────────────────────── */

/**
 * Create the notification plugin.
 *
 * @param options Configuration (socket is optional — works without it)
 * @returns A MonacoPlugin
 */
export function createNotificationPlugin(
  options: NotificationPluginOptions = {},
): MonacoPlugin {
  const { socket, maxVisible = 4, defaultTimeout = 8000 } = options;

  return {
    id: "builtin-notifications",
    name: "Notification Center",
    version: "1.0.0",
    description: "VS Code-style notifications with backend socket integration",
    priority: 10,

    onMount(ctx: PluginContext) {
      _socket = socket ?? null;

      // Listen for socket events if a socket was provided
      if (socket) {
        socket.on(NOTIFICATION_EVENTS.SHOW, handleShowNotification);
        socket.on(NOTIFICATION_EVENTS.UPDATE, handleUpdateNotification);
        socket.on(NOTIFICATION_EVENTS.DISMISS, handleDismissNotification);

        ctx.addDisposable({
          dispose: () => {
            socket.off(NOTIFICATION_EVENTS.SHOW, handleShowNotification);
            socket.off(NOTIFICATION_EVENTS.UPDATE, handleUpdateNotification);
            socket.off(NOTIFICATION_EVENTS.DISMISS, handleDismissNotification);
          },
        });
      }

      // Register a command palette action
      ctx.addAction({
        id: "notifications.clearAll",
        label: "Notifications: Clear All",
        run: () => {
          _notificationsHandle?.clearAll();
        },
      });

      // Expose notification config for the EditorNotifications component
      (ctx as any).__notificationConfig = { maxVisible, defaultTimeout };
    },

    onDispose() {
      _serverIdMap.clear();
      _socket = null;
    },
  };
}
