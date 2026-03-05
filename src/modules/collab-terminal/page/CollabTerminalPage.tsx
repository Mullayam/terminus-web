/**
 * CollabTerminalPage — the complete page for collaborative terminal viewing/editing.
 *
 * This is a self-contained module that:
 *  1. Creates its own socket (no interference with admin's SSH socket)
 *  2. Joins the collab room
 *  3. Renders xterm with all collab overlays
 *  4. Shows admin panel in a right sidebar when isAdmin
 *
 * Route: /collab/terminal/:sessionId
 */
import '@xterm/xterm/css/xterm.css';
import React, { useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { WebglAddon } from '@xterm/addon-webgl';
import { CanvasAddon } from '@xterm/addon-canvas';
import { Unicode11Addon } from '@xterm/addon-unicode11';

import { __config } from '@/lib/config';
import { CollabClientEvent, CollabServerEvent } from '../types/events';
import { useCollabSocket } from '../hooks';
import { useCollabStore } from '../store';
import {
  PermissionBadge,
  UserCountBadge,
  LockIndicator,
  TypingIndicator,
  InputBufferBar,
  KickedModal,
  BlockedModal,
  AdminPanel,
  JoinError,
} from '../components';

import { Loader2, RefreshCcw } from 'lucide-react';

export default function CollabTerminalPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const socketRef = useRef<Socket | null>(null);
  const terminalRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [socketReady, setSocketReady] = React.useState(false);

  // ── Store selectors ──────────────────────────────────────────────────
  const joined = useCollabStore((s) => s.joined);
  const joinError = useCollabStore((s) => s.joinError);
  const permission = useCollabStore((s) => s.permission);
  const isAdmin = useCollabStore((s) => s.isAdmin);
  const isLocked = useCollabStore((s) => s.isLocked);
  const appendToBuffer = useCollabStore((s) => s.appendToBuffer);
  const [showAdmin, setShowAdmin] = React.useState(false);

  // ── Create socket once ───────────────────────────────────────────────
  useEffect(() => {
    if (!sessionId) return;

    const socket = io(__config.API_URL, {
      query: { sessionId },
      autoConnect: true,
      forceNew: true,
      multiplex: false,
    });

    socketRef.current = socket;

    socket.on('connect', () => setSocketReady(true));
    socket.on('disconnect', () => setSocketReady(false));

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
      setSocketReady(false);
    };
  }, [sessionId]);

  // ── Wire collab events ───────────────────────────────────────────────
  const {
    emitInput,
    emitAdminLock,
    emitChangePermission,
    emitKickUser,
    emitBlockUser,
    emitUnblockIP,
  } = useCollabSocket(socketRef.current, sessionId || '');

  // ── Terminal output handler ──────────────────────────────────────────
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !joined) return;

    const onOutput = (data: string) => {
      termRef.current?.write(data);
      termRef.current?.scrollToBottom();
    };

    socket.on(CollabServerEvent.TERMINAL_OUTPUT, onOutput);
    return () => {
      socket.off(CollabServerEvent.TERMINAL_OUTPUT, onOutput);
    };
  }, [socketRef.current, joined]);

  // ── xterm setup ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!terminalRef.current || !joined) return;

    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'block',
      allowProposedApi: true,
      fontFamily: 'monospace',
      theme: { background: '#181818', cursor: '#f1fa8c' },
    });

    termRef.current = term;
    const fitAddon = new FitAddon();
    fitAddonRef.current = fitAddon;

    term.loadAddon(fitAddon);
    term.loadAddon(new WebLinksAddon());
    term.loadAddon(new Unicode11Addon());

    // Try WebGL first, fall back to Canvas
    try {
      term.loadAddon(new WebglAddon());
    } catch {
      term.loadAddon(new CanvasAddon());
    }

    term.open(terminalRef.current);

    requestAnimationFrame(() => fitAddon.fit());

    const handleResize = () => fitAddon.fit();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      term.dispose();
      termRef.current = null;
    };
  }, [joined]);

  // ── xterm input → collab emit ────────────────────────────────────────
  useEffect(() => {
    const term = termRef.current;
    if (!term) return;

    const disposable = term.onData((data: string) => {
      const currentPermission = useCollabStore.getState().permission;
      const currentIsLocked = useCollabStore.getState().isLocked;
      const currentLockType = useCollabStore.getState().lockType;

      // Read-only: don't even try
      if (currentPermission === '400') return;

      // Admin is always allowed
      if (currentPermission === '777') {
        emitInput(data);
        return;
      }

      // Write user: buffer if locked
      if (currentIsLocked) {
        appendToBuffer(data);
        return;
      }

      emitInput(data);
    });

    return () => disposable.dispose();
  }, [termRef.current, emitInput, appendToBuffer]);

  // ── Buffer send ──────────────────────────────────────────────────────
  const handleBufferSend = useCallback(
    (buffer: string) => {
      emitInput(buffer);
    },
    [emitInput]
  );

  // ── Rejoin after kick ────────────────────────────────────────────────
  const handleRejoin = useCallback(() => {
    if (socketRef.current && sessionId) {
      socketRef.current.emit(CollabClientEvent.JOIN_TERMINAL, { sessionId });
    }
  }, [sessionId]);

  // ── Render ───────────────────────────────────────────────────────────
  if (joinError) return <JoinError />;

  if (!joined) {
    return (
      <div className="flex items-center justify-center h-screen w-full bg-[#0a0a0a]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          <span className="text-sm text-gray-500">Joining session…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-[#0a0a0a] overflow-hidden">
      {/* Main terminal area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Terminal container (relative for lock overlay) */}
        <div className="relative flex-1 min-h-0 overflow-hidden">
          <LockIndicator />
          <div
            ref={terminalRef}
            className="w-full h-full"
          />
        </div>

        {/* Typing indicator */}
        <TypingIndicator />

        {/* Input buffer bar */}
        <InputBufferBar onSend={handleBufferSend} />

        {/* Status bar */}
        <div className="flex items-center justify-between px-4 py-1 border-t border-gray-800 text-xs bg-[#1a1b26] text-gray-400 shrink-0">
          <div className="flex items-center gap-3">
            <PermissionBadge />
            <UserCountBadge />
          </div>
          <div className="flex items-center gap-3">
            <span className="cursor-pointer" onClick={() => sessionId && navigator.clipboard.writeText(sessionId)}>
              Session: {sessionId?.slice(0, 12)}…
            </span>
            {!socketReady && <RefreshCcw className="w-3 h-3 animate-spin" />}
            <span className={`w-2 h-2 rounded-full ${socketReady ? 'bg-green-500' : 'bg-red-500'}`} />
          </div>
          {isAdmin && (
            <button
              onClick={() => setShowAdmin(!showAdmin)}
              className="px-2 py-0.5 rounded text-[11px] font-medium bg-purple-700/60 text-purple-200 hover:bg-purple-600/70 transition-colors"
            >
              {showAdmin ? 'Hide Admin' : 'Admin Panel'}
            </button>
          )}
        </div>
      </div>

      {/* Admin sidebar */}
      {isAdmin && showAdmin && (
        <div className="w-80 border-l border-gray-800 bg-[#0e0e10] overflow-y-auto shrink-0">
          <AdminPanel
            onAdminLock={emitAdminLock}
            onChangePermission={emitChangePermission}
            onKick={emitKickUser}
            onBlock={emitBlockUser}
            onUnblock={emitUnblockIP}
          />
        </div>
      )}

      {/* Modals */}
      <KickedModal onRejoin={handleRejoin} />
      <BlockedModal />
    </div>
  );
}
