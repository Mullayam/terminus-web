/**
 * @module monaco-editor/components/EditorNotifications
 *
 * VS Code-style notification center overlay for the Monaco Editor.
 *
 * Renders toast-like notifications in the bottom-right corner of the editor,
 * matching VS Code's notification UI:
 *   - Severity icons (info / warning / error / success)
 *   - Progress bar (optional)
 *   - Action buttons
 *   - Auto-dismiss with configurable timeout
 *   - Notification center toggle (bell icon)
 *   - Stacked layout with max visible count
 *
 * Notifications can come from:
 *   - The plugin system (ctx.notify)
 *   - Backend WebSocket events (socket.io)
 *   - Direct imperative API (addNotification)
 */

import React, {
  useState,
  useCallback,
  useRef,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from "react";

/* ── Types ─────────────────────────────────────────────────── */

export type NotificationSeverity = "info" | "warning" | "error" | "success";

export interface NotificationAction {
  label: string;
  onClick: () => void;
  primary?: boolean;
}

export interface EditorNotification {
  id: string;
  message: string;
  severity: NotificationSeverity;
  source?: string;
  detail?: string;
  actions?: NotificationAction[];
  progress?: number | "indeterminate";
  timeout?: number; // ms, 0 = no auto-dismiss
  timestamp: number;
  dismissed?: boolean;
}

export interface EditorNotificationsHandle {
  /** Add a notification and return its ID */
  addNotification: (
    notification: Omit<EditorNotification, "id" | "timestamp">,
  ) => string;
  /** Remove a notification by ID */
  removeNotification: (id: string) => void;
  /** Clear all notifications */
  clearAll: () => void;
  /** Update an existing notification (e.g. progress) */
  updateNotification: (
    id: string,
    updates: Partial<Omit<EditorNotification, "id" | "timestamp">>,
  ) => void;
  /** Toggle the notification center open/closed */
  toggleCenter: () => void;
  /** Get active (non-dismissed) notification count */
  getActiveCount: () => number;
}

interface EditorNotificationsProps {
  /** Max visible at once (default: 4) */
  maxVisible?: number;
  /** Default auto-dismiss timeout in ms (default: 8000, 0 = no auto-dismiss) */
  defaultTimeout?: number;
  /** Called whenever the active notification count changes */
  onCountChange?: (count: number) => void;
}

/* ── Helpers ───────────────────────────────────────────────── */

let notifCounter = 0;
function nextId(): string {
  return `notif-${++notifCounter}-${Date.now()}`;
}

/* ── Severity Icons (inline SVG) ───────────────────────────── */

const SeverityIcon: React.FC<{ severity: NotificationSeverity; className?: string }> = ({
  severity,
  className = "w-4 h-4 shrink-0",
}) => {
  switch (severity) {
    case "info":
      return (
        <svg className={className} viewBox="0 0 16 16" fill="currentColor" style={{ color: "#3794ff" }}>
          <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm1 10.5a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5v-4a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v4zM8 6a1 1 0 1 1 0-2 1 1 0 0 1 0 2z" />
        </svg>
      );
    case "warning":
      return (
        <svg className={className} viewBox="0 0 16 16" fill="currentColor" style={{ color: "#cca700" }}>
          <path d="M7.56 1.44a.5.5 0 0 1 .88 0l6.5 12A.5.5 0 0 1 14.5 14h-13a.5.5 0 0 1-.44-.74l6.5-12zM7.5 5.5v4a.5.5 0 0 0 1 0v-4a.5.5 0 0 0-1 0zM8 12a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5z" />
        </svg>
      );
    case "error":
      return (
        <svg className={className} viewBox="0 0 16 16" fill="currentColor" style={{ color: "#f14c4c" }}>
          <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm3.15 9.15a.5.5 0 0 1-.7.7L8 8.71l-2.45 2.14a.5.5 0 1 1-.7-.7L7.29 8 4.85 5.55a.5.5 0 0 1 .7-.7L8 7.29l2.45-2.44a.5.5 0 0 1 .7.7L8.71 8l2.44 2.15z" />
        </svg>
      );
    case "success":
      return (
        <svg className={className} viewBox="0 0 16 16" fill="currentColor" style={{ color: "#89d185" }}>
          <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm3.85 5.35-4.5 4.5a.5.5 0 0 1-.7 0l-2.5-2.5a.5.5 0 1 1 .7-.7L7 9.79l4.15-4.14a.5.5 0 0 1 .7.7z" />
        </svg>
      );
  }
};

/* ── Close Icon ────────────────────────────────────────────── */

const CloseIcon: React.FC<{ className?: string }> = ({ className = "w-3.5 h-3.5" }) => (
  <svg className={className} viewBox="0 0 16 16" fill="currentColor">
    <path d="M8.7 8l3.65-3.65a.5.5 0 0 0-.7-.7L8 7.29 4.35 3.65a.5.5 0 1 0-.7.7L7.29 8l-3.64 3.65a.5.5 0 0 0 .7.7L8 8.71l3.65 3.64a.5.5 0 0 0 .7-.7L8.71 8z" />
  </svg>
);

/* ── Bell Icon ─────────────────────────────────────────────── */

const BellIcon: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 16 16" fill="currentColor">
    <path d="M13.377 10.573a7.63 7.63 0 0 1-.383-2.38V6.195a5.115 5.115 0 0 0-1.268-3.446 5.138 5.138 0 0 0-3.242-1.722c-.694-.072-1.4 0-2.07.227-.67.215-1.28.574-1.794 1.053a4.923 4.923 0 0 0-1.208 1.675A5.067 5.067 0 0 0 2.94 6.197v1.996a7.63 7.63 0 0 1-.383 2.38 2.564 2.564 0 0 0-.142.58c0 .218.1.42.272.573A.96.96 0 0 0 3.344 12H5.5a2.5 2.5 0 0 0 5 0h2.156a.96.96 0 0 0 .656-.271.862.862 0 0 0 .272-.573 2.564 2.564 0 0 0-.207-.583zM8 13.5A1.5 1.5 0 0 1 6.5 12h3A1.5 1.5 0 0 1 8 13.5z" />
  </svg>
);

/* ── Single Notification Card ──────────────────────────────── */

const NotificationCard: React.FC<{
  notification: EditorNotification;
  onDismiss: (id: string) => void;
}> = ({ notification, onDismiss }) => {
  const { id, message, severity, source, detail, actions, progress } = notification;
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="pointer-events-auto animate-in slide-in-from-right-5 fade-in duration-200"
      style={{
        width: 340,
        background: "#252526",
        border: "1px solid #3c3c3c",
        borderRadius: 6,
        boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
        overflow: "hidden",
        fontSize: 13,
      }}
    >
      {/* Progress bar */}
      {progress !== undefined && (
        <div style={{ height: 2, background: "#3c3c3c", width: "100%" }}>
          {progress === "indeterminate" ? (
            <div
              style={{
                height: "100%",
                width: "30%",
                background: "#0078d4",
                animation: "notif-progress-indeterminate 1.5s ease-in-out infinite",
              }}
            />
          ) : (
            <div
              style={{
                height: "100%",
                width: `${Math.min(100, Math.max(0, progress))}%`,
                background: "#0078d4",
                transition: "width 0.3s ease",
              }}
            />
          )}
        </div>
      )}

      {/* Header row */}
      <div style={{ display: "flex", alignItems: "flex-start", padding: "10px 10px 6px 10px", gap: 8 }}>
        <SeverityIcon severity={severity} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              color: "#cccccc",
              lineHeight: "18px",
              wordBreak: "break-word",
              cursor: detail ? "pointer" : "default",
            }}
            onClick={() => detail && setExpanded((e) => !e)}
          >
            {message}
          </div>
          {source && (
            <div style={{ color: "#808080", fontSize: 11, marginTop: 2 }}>
              Source: {source}
            </div>
          )}
        </div>
        <button
          onClick={() => onDismiss(id)}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 2,
            color: "#808080",
            display: "flex",
            alignItems: "center",
          }}
          title="Dismiss"
          onMouseEnter={(e) => { e.currentTarget.style.color = "#cccccc"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "#808080"; }}
        >
          <CloseIcon />
        </button>
      </div>

      {/* Expanded detail */}
      {expanded && detail && (
        <div
          style={{
            padding: "0 10px 8px 32px",
            color: "#9d9d9d",
            fontSize: 12,
            lineHeight: "16px",
            whiteSpace: "pre-wrap",
            maxHeight: 120,
            overflowY: "auto",
          }}
        >
          {detail}
        </div>
      )}

      {/* Actions */}
      {actions && actions.length > 0 && (
        <div
          style={{
            display: "flex",
            gap: 6,
            padding: "0 10px 8px 32px",
            flexWrap: "wrap",
          }}
        >
          {actions.map((action, i) => (
            <button
              key={i}
              onClick={() => {
                action.onClick();
                onDismiss(id);
              }}
              style={{
                background: action.primary ? "#0078d4" : "transparent",
                border: action.primary ? "1px solid #0078d4" : "1px solid #3c3c3c",
                color: action.primary ? "#ffffff" : "#cccccc",
                padding: "3px 10px",
                borderRadius: 3,
                cursor: "pointer",
                fontSize: 12,
                lineHeight: "18px",
              }}
              onMouseEnter={(e) => {
                if (!action.primary) {
                  e.currentTarget.style.background = "#3c3c3c";
                }
              }}
              onMouseLeave={(e) => {
                if (!action.primary) {
                  e.currentTarget.style.background = "transparent";
                }
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

/* ── Main Component ────────────────────────────────────────── */

export const EditorNotifications = forwardRef<
  EditorNotificationsHandle,
  EditorNotificationsProps
>(({ maxVisible = 4, defaultTimeout = 8000, onCountChange }, ref) => {
  const [notifications, setNotifications] = useState<EditorNotification[]>([]);
  const [showCenter, setShowCenter] = useState(false);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Auto-dismiss timer management
  const startTimer = useCallback(
    (id: string, timeout: number) => {
      if (timeout <= 0) return;
      const timer = setTimeout(() => {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
        timersRef.current.delete(id);
      }, timeout);
      timersRef.current.set(id, timer);
    },
    [],
  );

  const clearTimer = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  // Cleanup all timers on unmount
  useEffect(() => {
    return () => {
      timersRef.current.forEach((timer) => clearTimeout(timer));
      timersRef.current.clear();
    };
  }, []);

  const addNotification = useCallback(
    (input: Omit<EditorNotification, "id" | "timestamp">): string => {
      const id = nextId();
      const notification: EditorNotification = {
        ...input,
        id,
        timestamp: Date.now(),
      };
      setNotifications((prev) => [notification, ...prev]);

      const timeout = input.timeout ?? (input.progress !== undefined ? 0 : defaultTimeout);
      startTimer(id, timeout);

      return id;
    },
    [defaultTimeout, startTimer],
  );

  const removeNotification = useCallback(
    (id: string) => {
      clearTimer(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    },
    [clearTimer],
  );

  const clearAll = useCallback(() => {
    timersRef.current.forEach((timer) => clearTimeout(timer));
    timersRef.current.clear();
    setNotifications([]);
  }, []);

  const updateNotification = useCallback(
    (id: string, updates: Partial<Omit<EditorNotification, "id" | "timestamp">>) => {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, ...updates } : n)),
      );

      // If progress completed, start a dismiss timer
      if (typeof updates.progress === "number" && updates.progress >= 100) {
        clearTimer(id);
        startTimer(id, 3000);
      }
    },
    [clearTimer, startTimer],
  );

  // Notify parent of count changes
  const activeCount = notifications.filter((n) => !n.dismissed).length;
  useEffect(() => {
    onCountChange?.(activeCount);
  }, [activeCount, onCountChange]);

  useImperativeHandle(ref, () => ({
    addNotification,
    removeNotification,
    clearAll,
    updateNotification,
    toggleCenter: () => setShowCenter((s) => !s),
    getActiveCount: () => notifications.filter((n) => !n.dismissed).length,
  }));

  const activeNotifications = notifications.filter((n) => !n.dismissed);
  const visibleNotifications = showCenter
    ? activeNotifications
    : activeNotifications.slice(0, maxVisible);
  const hiddenCount = activeNotifications.length - visibleNotifications.length;

  return (
    <>
      {/* Inject keyframes for indeterminate progress */}
      <style>{`
        @keyframes notif-progress-indeterminate {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(430%); }
        }
      `}</style>

      {/* Notification toast stack — bottom-right of editor */}
      <div
        style={{
          position: "absolute",
          bottom: 32,
          right: 16,
          zIndex: 1000,
          display: "flex",
          flexDirection: "column-reverse",
          gap: 8,
          pointerEvents: "none",
          maxHeight: "calc(100% - 64px)",
          overflowY: showCenter ? "auto" : "hidden",
        }}
      >
        {visibleNotifications.map((n) => (
          <NotificationCard
            key={n.id}
            notification={n}
            onDismiss={removeNotification}
          />
        ))}

        {/* Hidden count badge */}
        {hiddenCount > 0 && !showCenter && (
          <button
            onClick={() => setShowCenter(true)}
            className="pointer-events-auto"
            style={{
              alignSelf: "flex-end",
              background: "#252526",
              border: "1px solid #3c3c3c",
              borderRadius: 4,
              color: "#cccccc",
              padding: "4px 10px",
              fontSize: 12,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <BellIcon className="w-3.5 h-3.5" />
            {hiddenCount} more notification{hiddenCount > 1 ? "s" : ""}
          </button>
        )}
      </div>

      {/* Clear All header when notification center is open */}
      {showCenter && activeNotifications.length > 1 && (
        <div
          className="pointer-events-auto"
          style={{
            position: "absolute",
            bottom: 32 + visibleNotifications.length * 90 + (visibleNotifications.length - 1) * 8 + 8,
            right: 16,
            zIndex: 1001,
          }}
        >
          <button
            onClick={clearAll}
            style={{
              background: "#252526",
              border: "1px solid #3c3c3c",
              borderRadius: 4,
              color: "#808080",
              padding: "4px 10px",
              fontSize: 11,
              cursor: "pointer",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "#cccccc"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "#808080"; }}
          >
            Clear All
          </button>
        </div>
      )}
    </>
  );
});

EditorNotifications.displayName = "EditorNotifications";
