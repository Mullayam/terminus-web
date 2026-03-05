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
import { WebglAddon } from '@xterm/addon-webgl';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { ImageAddon } from '@xterm/addon-image';
import { CanvasAddon } from '@xterm/addon-canvas';
import { ClipboardAddon } from '@xterm/addon-clipboard';
import { LigaturesAddon } from '@xterm/addon-ligatures';
import { SearchAddon } from '@xterm/addon-search';
import { SerializeAddon } from '@xterm/addon-serialize';
import { Unicode11Addon } from '@xterm/addon-unicode11';

import { __config } from '@/lib/config';
import { XtermTheme } from '@/pages/ssh-v/components/themes';
import { CollabServerEvent } from '../types/events';
import { useCollabSocket, useCollabTheme, useCollabTerminalEffects } from '../hooks';
import { useCollabStore } from '../store';
import {
  PermissionBadge,
  UserCountBadge,
  LockGhostOverlay,
  TypingIndicator,
  InputBufferBar,
  JoinError,
  CollabRightSidebar,
} from '../components';

import { Loader2, RefreshCcw, Settings, AlertTriangle } from 'lucide-react';

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
  const sessionEnded = useCollabStore((s) => s.sessionEnded);
  const [showSettings, setShowSettings] = React.useState(false);

  // ── Theme ────────────────────────────────────────────────────────────
  const { colors } = useCollabTheme();

  // ── Terminal effects (theme apply, kick/block xterm-inline) ──────────
  useCollabTerminalEffects(termRef);

  // ── Create socket once ───────────────────────────────────────────────
  useEffect(() => {
    if (!sessionId) return;

    const socket = io(__config.API_URL, {
      query: { sessionId, role: 'collab' },
      autoConnect: true,
      forceNew: true,
      multiplex: false,
    });

    socketRef.current = socket;

    socket.on('connect', () => setSocketReady(true));
    socket.on('disconnect', () => {
      setSocketReady(false);
      // Show disconnect message in xterm
      const term = termRef.current;
      if (term) {
        term.writeln('');
        term.writeln('\x1b[1;31m  Socket disconnected.\x1b[0m');
        term.writeln('\x1b[33m  Please refresh the page to reconnect to the session.\x1b[0m');
        term.writeln('');
      }
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
      setSocketReady(false);
    };
  }, [sessionId]);

  // ── Wire collab events ───────────────────────────────────────────────
  const {
    emitCheckRoom,
    joinRoom,
    emitInput,
    emitAdminLock,
    emitChangePermission,
    emitKickUser,
    emitBlockUser,
    emitUnblockIP,
  } = useCollabSocket(socketRef.current, sessionId || '');

  // ── Pre-join: check room once socket is ready ─────────────────────────
  const roomStatus = useCollabStore((s) => s.roomStatus);
  const roomChecking = useCollabStore((s) => s.roomChecking);

  useEffect(() => {
    if (!socketReady || !sessionId) return;
    // Only check once (roomStatus starts null)
    if (roomStatus !== null) return;
    useCollabStore.getState().setRoomChecking(true);
    emitCheckRoom();
  }, [socketReady, sessionId, roomStatus, emitCheckRoom]);

  // ── After room check passes, join the room ────────────────────────────
  useEffect(() => {
    if (!roomStatus) return;
    if (roomStatus.exists && !roomStatus.blocked) {
      joinRoom();
    }
  }, [roomStatus, joinRoom]);

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

    const currentTheme = XtermTheme[useCollabStore.getState().themeName] || XtermTheme.custom;

    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'block',
      allowProposedApi: true,
      fontFamily: 'monospace',
      theme: currentTheme,
    });

    termRef.current = term;
    const fitAddon = new FitAddon();
    fitAddonRef.current = fitAddon;

    term.loadAddon(fitAddon);
    term.loadAddon(new WebglAddon());
    term.loadAddon(new ImageAddon());
    term.loadAddon(new SerializeAddon());
    term.loadAddon(new Unicode11Addon());
    term.loadAddon(new CanvasAddon());
    term.loadAddon(new ClipboardAddon());
    term.loadAddon(new WebLinksAddon());
    term.loadAddon(new SearchAddon());

    term.open(terminalRef.current);

    new LigaturesAddon().activate(term);

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
      const { permission: currentPermission, isLocked: currentIsLocked, lockedBy: currentLockedBy, mySocketId } = useCollabStore.getState();

      // Read-only: don't even try
      if (currentPermission === '400') return;

      // Admin is always allowed
      if (currentPermission === '777') {
        emitInput(data);
        return;
      }

      // Write user: buffer if locked by someone else
      if (currentIsLocked && currentLockedBy !== mySocketId) {
        appendToBuffer(data);
        return;
      }

      emitInput(data);
    });

    return () => disposable.dispose();
  }, [termRef.current, emitInput, appendToBuffer]);

  // ── Block user (track IP locally for unblock UI) ─────────────────────
  const handleBlockUser = useCallback(
    (targetSocketId: string, message?: string) => {
      const user = useCollabStore.getState().users.find((u) => u.socketId === targetSocketId);
      if (user?.ip) {
        useCollabStore.getState().addBlockedIP(user.ip);
      }
      emitBlockUser(targetSocketId, message);
    },
    [emitBlockUser]
  );

  // ── Buffer send ──────────────────────────────────────────────────────
  const handleBufferSend = useCallback(
    (buffer: string) => {
      emitInput(buffer);
    },
    [emitInput]
  );

  // ── Render ───────────────────────────────────────────────────────────
  if (joinError) return <JoinError />;

  if (sessionEnded) {
    return (
      <div className="flex items-center justify-center h-screen w-full bg-[#0a0a0a]">
        <div className="flex flex-col items-center gap-4 max-w-md text-center px-6">
          <AlertTriangle className="w-12 h-12 text-red-400" />
          <h2 className="text-lg font-semibold text-gray-200">Session Ended</h2>
          <p className="text-sm text-gray-400">{sessionEnded.message}</p>
          <span className="text-xs text-gray-600">Reason: {sessionEnded.reason}</span>
        </div>
      </div>
    );
  }

  // Room check in progress
  if (roomChecking || (!roomStatus && !joined)) {
    return (
      <div className="flex items-center justify-center h-screen w-full bg-[#0a0a0a]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          <span className="text-sm text-gray-500">Checking session…</span>
        </div>
      </div>
    );
  }

  // Room does not exist
  if (roomStatus && !roomStatus.exists) {
    return (
      <div className="flex items-center justify-center h-screen w-full bg-[#0a0a0a]">
        <div className="flex flex-col items-center gap-4 max-w-md text-center px-6">
          <AlertTriangle className="w-12 h-12 text-yellow-400" />
          <h2 className="text-lg font-semibold text-gray-200">Session Not Found</h2>
          <p className="text-sm text-gray-400">This session does not exist or has already ended.</p>
        </div>
      </div>
    );
  }

  // IP is blocked
  if (roomStatus && roomStatus.blocked) {
    return (
      <div className="flex items-center justify-center h-screen w-full bg-[#0a0a0a]">
        <div className="flex flex-col items-center gap-4 max-w-md text-center px-6">
          <AlertTriangle className="w-12 h-12 text-red-400" />
          <h2 className="text-lg font-semibold text-gray-200">Access Blocked</h2>
          <p className="text-sm text-gray-400">Your IP has been blocked from this session by the admin.</p>
        </div>
      </div>
    );
  }

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
    <div className="flex h-screen w-full overflow-hidden" style={{ backgroundColor: colors.background }}>
      {/* Main terminal area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Terminal container (relative for ghost lock overlay) */}
        <div className="relative flex-1 min-h-0 overflow-hidden">
          <LockGhostOverlay />
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
        <div
          className="flex items-center justify-between px-4 py-1 border-t text-xs shrink-0"
          style={{
            backgroundColor: colors.background,
            borderColor: `${colors.foreground}20`,
            color: `${colors.foreground}99`,
          }}
        >
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
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-1 rounded hover:bg-white/10 transition-colors"
              title="Settings"
            >
              <Settings size={14} style={{ color: `${colors.foreground}99` }} />
            </button>
          </div>
        </div>
      </div>

      {/* Right sidebar (Settings + Admin) */}
      <CollabRightSidebar
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        onAdminLock={emitAdminLock}
        onChangePermission={emitChangePermission}
        onKick={emitKickUser}
        onBlock={handleBlockUser}
        onUnblock={emitUnblockIP}
      />
    </div>
  );
}
