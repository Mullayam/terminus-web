/**
 * @module useSftpSocket
 *
 * Centralised hook for managing a per-tab SFTP socket connection.
 *
 * Responsibilities:
 *   1. Gets or creates a socket from the persistent registry (forceNew, /sftp namespace).
 *   2. Registers all SFTP event listeners and patches the Zustand store.
 *   3. Handles auto-reconnect with re-emit of @@SFTP_CONNECT (the backend tears down
 *      the SFTP session on disconnect — a raw reconnect gives a socket but no SFTP session).
 *   4. Returns the socket ref so callers can emit events directly.
 *   5. Cleans up listeners on unmount (but does NOT destroy the socket — tabs survive
 *      React remounts; only `removeTab` tears down the socket).
 *
 * Usage:
 *   const { socket, isReady } = useSftpSocket(tabId);
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { SocketEventConstants } from '@/lib/sockets/event-constants';
import { useSFTPStore, getOrCreateSocket, type SFTPSession } from '@/store/sftpStore';
import { useToast } from '@/hooks/use-toast';
import type { DownloadProgressType } from '@/pages/sftp/components/SFTPTabClient';

export interface UseSftpSocketOptions {
  /** Called when download progress updates — kept local to avoid store churn */
  onDownloadProgress?: (progress: Record<string, DownloadProgressType>) => void;
}

export interface UseSftpSocketReturn {
  /** The socket instance (null until first render cycle completes) */
  socket: Socket | null;
  /** True once @@SFTP_READY has been received for this lifecycle */
  isReady: boolean;
  /** Emit @@SFTP_CONNECT with the given credentials payload (JSON string) */
  connect: (payload: string) => void;
  /** Emit @@SFTP_GET_FILE with a directory path  */
  listDir: (dirPath: string) => void;
}

export function useSftpSocket(
  tabId: string,
  options?: UseSftpSocketOptions,
): UseSftpSocketReturn {
  const socketRef = useRef<Socket | null>(null);
  const [socketState, setSocketState] = useState<Socket | null>(null);
  const [isReady, setIsReady] = useState(false);

  const { updateSession } = useSFTPStore();
  const { toast } = useToast();

  // Keep callbacks in refs so the effect closure never goes stale
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const toastRef = useRef(toast);
  toastRef.current = toast;

  // Stable reference to the store patcher
  const patch = useCallback(
    (p: Partial<SFTPSession>) => updateSession(tabId, p),
    [tabId, updateSession],
  );

  // Download progress kept outside React state to avoid unnecessary re-renders
  const downloadProgressRef = useRef<Record<string, DownloadProgressType>>({});

  // ── Main effect: socket lifecycle ──────────────────────────
  useEffect(() => {
    const socket = getOrCreateSocket(tabId);
    socketRef.current = socket;
    setSocketState(socket);

    // If the socket is already connected (remount), restore flag
    if (socket.connected) {
      patch({ isConnected: true, socket });
    }

    // Check if we had a previously-connected session (page navigation / HMR)
    const storedSession = useSFTPStore.getState().sessions[tabId];
    if (storedSession?.status === 'connected' && socket.connected) {
      patch({ isSftpConnected: true, isConnected: true });
      setIsReady(true);
      const savedDir =
        localStorage.getItem(`sftp_current_dir_${tabId}`) ||
        (storedSession.host
          ? localStorage.getItem(`sftp_host_dir_${storedSession.host}`)
          : '') ||
        '';
      socket.emit(SocketEventConstants.SFTP_GET_FILE, { dirPath: savedDir });
    }

    /* ── Handlers ──────────────────────────────────────────── */

    const onConnect = () => {
      patch({ isConnected: true, socket });
    };

    const onDisconnect = () => {
      patch({ isConnected: false });
      setIsReady(false);
    };

    const onConnectError = (err: Error) => {
      console.error(`[SFTP:${tabId}] socket error:`, err.message);
      patch({ isConnected: false });
    };

    /**
     * @@SFTP_READY — backend has a live SFTP subsystem for this session.
     * Restore the last-visited directory so the user picks up where they left off.
     */
    const onSftpReady = () => {
      setIsReady(true);
      const sess = useSFTPStore.getState().sessions[tabId];
      const savedDir =
        localStorage.getItem(`sftp_current_dir_${tabId}`) ||
        (sess?.host ? localStorage.getItem(`sftp_host_dir_${sess.host}`) : '') ||
        '';
      socket.emit(SocketEventConstants.SFTP_GET_FILE, { dirPath: savedDir });
      patch({
        isSftpConnected: true,
        isConnecting: false,
        loading: false,
        status: 'connected',
      });
    };

    /**
     * Auto-reconnect: socket.io reconnects the transport, but the backend
     * tore down the SFTPClient on disconnect. Re-emit @@SFTP_CONNECT with
     * the stored credentials so the SFTP session is re-established.
     */
    const onReconnect = () => {
      const sess = useSFTPStore.getState().sessions[tabId];
      if (sess && sess.host && sess.username) {
        patch({ isConnecting: true, isSftpConnected: false, status: 'connecting' });
        socket.emit(
          SocketEventConstants.SFTP_CONNECT,
          JSON.stringify({
            host: sess.host,
            username: sess.username,
            password: sess.password,
            authMethod: sess.authMethod,
          }),
        );
      }
    };

    const onCurrentPath = (cwd: string) => {
      patch({ currentDir: cwd, homeDir: cwd, loading: false });
    };

    const onFileUploaded = (data: string) => {
      toastRef.current({
        title: 'File Uploaded',
        description: 'File uploaded successfully at ' + data,
        variant: 'default',
      });
      const currentSession = useSFTPStore.getState().sessions[tabId];
      socket.emit(SocketEventConstants.SFTP_GET_FILE, {
        dirPath: currentSession?.currentDir || '',
      });
    };

    const onFilesList = (data: { files: string; currentDir: string; workingDir: string }) => {
      patch({
        loading: false,
        remoteFiles: JSON.parse(data.files),
        currentDir: data.currentDir,
        homeDir: data.workingDir,
      });
      // Persist per-host directory
      const sess = useSFTPStore.getState().sessions[tabId];
      if (sess?.host && data.currentDir) {
        localStorage.setItem(`sftp_host_dir_${sess.host}`, data.currentDir);
      }
    };

    const onError = (data: string) => {
      patch({
        isError: true,
        isConnecting: false,
        status: 'error',
        error: data,
        loading: false,
      });
      toastRef.current({ title: 'SFTP Error', description: data, variant: 'destructive' });
    };

    const onSftpEnded = (msg: string) => {
      setIsReady(false);
      patch({ isSftpConnected: false, status: 'idle', isConnecting: false });
      toastRef.current({ title: 'SFTP Disconnected', description: msg || 'Session ended.', variant: 'default' });
    };

    const onSuccess = (data: string) => {
      toastRef.current({ description: data, variant: 'default' });
    };

    const onDownloadProgress = (data: DownloadProgressType) => {
      if (data.percent >= 100) {
        const { [data.name]: _, ...rest } = downloadProgressRef.current;
        downloadProgressRef.current = rest;
      } else {
        downloadProgressRef.current = {
          ...downloadProgressRef.current,
          [data.name]: data,
        };
      }
      optionsRef.current?.onDownloadProgress?.({ ...downloadProgressRef.current });
    };

    /* ── Register ──────────────────────────────────────────── */
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.on('reconnect', onReconnect);  // auto-reconnect → re-auth
    socket.on(SocketEventConstants.SFTP_READY, onSftpReady);
    socket.on(SocketEventConstants.SFTP_ENDED, onSftpEnded);
    socket.on(SocketEventConstants.SFTP_CURRENT_PATH, onCurrentPath);
    socket.on(SocketEventConstants.FILE_UPLOADED, onFileUploaded);
    socket.on(SocketEventConstants.SFTP_FILES_LIST, onFilesList);
    socket.on(SocketEventConstants.SFTP_EMIT_ERROR, onError);
    socket.on(SocketEventConstants.ERROR, onError);
    socket.on(SocketEventConstants.SUCCESS, onSuccess);
    socket.on(SocketEventConstants.DOWNLOAD_PROGRESS, onDownloadProgress);
    socket.on(SocketEventConstants.STARTING, onDownloadProgress);
    socket.on(SocketEventConstants.COMPRESSING, onDownloadProgress);

    /* ── Cleanup (unmount only — socket stays alive in registry) */
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      socket.off('reconnect', onReconnect);
      socket.off(SocketEventConstants.SFTP_READY, onSftpReady);
      socket.off(SocketEventConstants.SFTP_ENDED, onSftpEnded);
      socket.off(SocketEventConstants.SFTP_CURRENT_PATH, onCurrentPath);
      socket.off(SocketEventConstants.FILE_UPLOADED, onFileUploaded);
      socket.off(SocketEventConstants.SFTP_FILES_LIST, onFilesList);
      socket.off(SocketEventConstants.SFTP_EMIT_ERROR, onError);
      socket.off(SocketEventConstants.ERROR, onError);
      socket.off(SocketEventConstants.SUCCESS, onSuccess);
      socket.off(SocketEventConstants.DOWNLOAD_PROGRESS, onDownloadProgress);
      socket.off(SocketEventConstants.STARTING, onDownloadProgress);
      socket.off(SocketEventConstants.COMPRESSING, onDownloadProgress);
    };
    // Only re-run when tabId changes (socket identity change)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabId]);

  /* ── Public helpers ──────────────────────────────────────── */

  const connect = useCallback(
    (payload: string) => {
      socketRef.current?.emit(SocketEventConstants.SFTP_CONNECT, payload);
    },
    [],
  );

  const listDir = useCallback(
    (dirPath: string) => {
      socketRef.current?.emit(SocketEventConstants.SFTP_GET_FILE, { dirPath });
    },
    [],
  );

  return { socket: socketState, isReady, connect, listDir };
}
