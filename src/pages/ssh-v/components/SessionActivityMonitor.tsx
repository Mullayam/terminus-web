import { useEffect } from 'react';
import { Socket } from 'socket.io-client';
import { useSSHStore } from '@/store/sshStore';
import { SocketEventConstants } from '@/lib/sockets/event-constants';

/**
 * Watches every session's socket for output and flags sessions whose tab is not
 * currently visible. This keeps working even when a tab is unmounted (inactive),
 * so background output surfaces as a pulsing indicator on its tab. The visible
 * tab(s) are handled by their mounted terminals and never flagged here.
 */
export default function SessionActivityMonitor() {
  useEffect(() => {
    const attached = new Map<string, { socket: Socket; handler: (input: string) => void }>();

    const reconcile = () => {
      const { sessions } = useSSHStore.getState();

      // Attach to any session socket we're not already tracking.
      for (const [sessionId, session] of Object.entries(sessions)) {
        const sock = session.socket;
        if (!sock) continue;
        const existing = attached.get(sessionId);
        if (existing?.socket === sock) continue;
        if (existing) existing.socket.off(SocketEventConstants.SSH_EMIT_DATA, existing.handler);

        const handler = () => {
          const st = useSSHStore.getState();
          const activeSessionId = st.tabs.find((t) => t.id === st.activeTabId)?.sessionId;
          const splitVisibleSessionId = st.splitMode !== 'none' ? st.splitTabId : null;
          // The visible terminal(s) already show this output — don't flag them.
          if (sessionId === activeSessionId || sessionId === splitVisibleSessionId) return;
          st.markSessionActivity(sessionId);
        };
        sock.on(SocketEventConstants.SSH_EMIT_DATA, handler);
        attached.set(sessionId, { socket: sock, handler });
      }

      // Detach from sessions that are gone (or lost their socket).
      for (const [sessionId, entry] of Array.from(attached.entries())) {
        if (!sessions[sessionId]?.socket) {
          entry.socket.off(SocketEventConstants.SSH_EMIT_DATA, entry.handler);
          attached.delete(sessionId);
        }
      }
    };

    reconcile();
    const unsubscribe = useSSHStore.subscribe(reconcile);

    return () => {
      unsubscribe();
      for (const entry of attached.values()) {
        entry.socket.off(SocketEventConstants.SSH_EMIT_DATA, entry.handler);
      }
      attached.clear();
    };
  }, []);

  return null;
}
