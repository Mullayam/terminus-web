import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Check, Copy, CornerDownLeft, FolderOpen, KeyRound, Loader2, LocateFixed, RefreshCw } from 'lucide-react';
import { FilePane } from '@/pages/sftp/components/FilePane';
import { ShowProgressBar } from '@/pages/sftp/components/DownloadProgress';
import type { DownloadProgressType } from '@/pages/sftp/components/SFTPTabClient';
import { SFTPContext } from '@/pages/sftp/sftp-context';
import { useSftpSocket } from '@/hooks/useSftpSocket';
import { useSFTPStore, getOrCreateSocket, destroySocket } from '@/store/sftpStore';
import { useSSHStore } from '@/store/sshStore';
import { SocketEventConstants } from '@/lib/sockets/event-constants';
import { idb } from '@/lib/idb';
import { Button } from '@/components/ui/button';
import { connectPayloads } from '../connect-payloads';
import { useFilesNavStore } from '@/store/filesNavStore';
import { useTerminalStore } from '@/store/terminalStore';
import { cdTerminalTo, openTerminalFolderInFiles } from '../files-link';

/**
 * Files (SFTP) view inside an SSH tab.
 *
 * Reuses the SFTP page's building blocks unchanged — `useSftpSocket`, the
 * socket registry, `FilePane` — keyed by the SSH tab's own session id. Using
 * that id means the backend files the SFTP credentials under the SSH session
 * (`sftp:<sessionId>` in Redis), so a reload can reopen without asking, and the
 * SSH teardown already clears them. These sessions never get an SFTP-page tab,
 * so they don't show up on /ssh/sftp.
 */

interface Creds {
  host: string;
  port?: number;
  username: string;
  authMethod: 'password' | 'privateKey';
  password?: string;
  privateKeyText?: string;
}

/** Credentials typed into this view's prompt, per session (memory only). */
const promptedCreds = new Map<string, Creds>();

// Closing an SSH tab drops its SFTP socket + session too. SFTP-page tabs use
// their own ids, never SSH session ids, so they are left alone.
let cleanupBound = false;
function bindCleanup() {
  if (cleanupBound) return;
  cleanupBound = true;
  useSSHStore.subscribe((state, prev) => {
    for (const id of Object.keys(prev.sessions)) {
      if (state.sessions[id]) continue;
      promptedCreds.delete(id);
      const sftp = useSFTPStore.getState();
      if (!sftp.sessions[id]) continue;
      destroySocket(id);
      sftp.removeSession(id);
      localStorage.removeItem(`sftp_current_dir_${id}`);
    }
  });
}
bindCleanup();

async function findSavedHost(host?: string, username?: string): Promise<Creds | null> {
  if (!host) return null;
  try {
    const hosts = (await idb.getAllItems('hosts')) as unknown as Creds[] | undefined;
    return hosts?.find((h) => h.host === host && h.username === username) ?? null;
  } catch {
    return null;
  }
}

type Phase = 'auto' | 'prompt' | 'failed';

export default function SshTabFiles({ sessionId }: { sessionId: string }) {
  const updateSession = useSFTPStore((s) => s.updateSession);
  const sshHost = useSSHStore((s) => s.sessions[sessionId]?.host ?? '');
  const sshUser = useSSHStore((s) => s.sessions[sessionId]?.username ?? '');

  // Must run before useSftpSocket's effect: it only patches an existing session.
  useEffect(() => {
    const store = useSFTPStore.getState();
    if (!store.sessions[sessionId]) {
      store.addSession({
        tabId: sessionId,
        host: sshHost,
        username: sshUser,
        status: 'idle',
        isConnecting: false,
        isConnected: false,
        isSftpConnected: false,
        loading: false,
        isError: false,
        currentDir: '',
        homeDir: '',
        title: sshHost,
        remoteFiles: [],
        authMethod: 'password',
      });
    }
    // If the socket dropped while this view was closed, the stored
    // "connected" flags are stale — the backend has no SFTP session any more.
    const sock = getOrCreateSocket(sessionId);
    if (!sock.connected) {
      store.updateSession(sessionId, { isConnected: false, isSftpConnected: false, isConnecting: false, status: 'idle' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const [downloadProgress, setDownloadProgress] = useState<Record<string, DownloadProgressType>>({});
  const { socket, connect, listDir } = useSftpSocket(sessionId, { onDownloadProgress: setDownloadProgress });
  const session = useSFTPStore((s) => s.sessions[sessionId]);

  const [phase, setPhase] = useState<Phase>('auto');
  /** What the last connect attempt used — decides what to do if it fails. */
  const triedRef = useRef<'none' | 'creds' | 'stored'>('none');

  const sendConnect = useCallback((payload: Partial<Creds>, kind: 'creds' | 'stored') => {
    triedRef.current = kind;
    updateSession(sessionId, { isConnecting: true, isError: false, error: undefined, status: 'connecting', loading: true });
    connect(JSON.stringify(payload));
  }, [sessionId, updateSession, connect]);

  const isConnected = session?.isConnected ?? false;
  const isSftpConnected = session?.isSftpConnected ?? false;
  const isConnecting = session?.isConnecting ?? false;
  const status = session?.status;

  // Auto-connect: SSH login in memory → saved host → credentials the backend
  // kept from an earlier open (empty payload). Also re-runs after a drop.
  useEffect(() => {
    if (phase !== 'auto' || !isConnected || isSftpConnected || isConnecting || status === 'error') return;
    let cancelled = false;
    (async () => {
      const creds: Creds | null =
        (connectPayloads.get(sessionId) as Creds | undefined) ??
        promptedCreds.get(sessionId) ??
        (await findSavedHost(sshHost, sshUser));
      if (cancelled) return;
      if (creds) sendConnect(creds, 'creds');
      else sendConnect({}, 'stored');
    })();
    return () => { cancelled = true; };
  }, [phase, isConnected, isSftpConnected, isConnecting, status, sessionId, sshHost, sshUser, sendConnect]);

  // A failed open: no stored creds → ask; bad creds → show the error.
  useEffect(() => {
    if (status !== 'error' || isSftpConnected || triedRef.current === 'none') return;
    setPhase(triedRef.current === 'stored' ? 'prompt' : 'failed');
    triedRef.current = 'none';
  }, [status, isSftpConnected]);

  useEffect(() => {
    if (isSftpConnected) setPhase('auto');
  }, [isSftpConnected]);

  // useSftpSocket only clears `isConnected` on a drop; also clear the SFTP
  // flag so the next `connect` re-opens the session instead of showing a dead pane.
  useEffect(() => {
    if (!socket) return;
    const onDisconnect = () => {
      updateSession(sessionId, { isSftpConnected: false, isConnecting: false, status: 'idle' });
      triedRef.current = 'none';
    };
    socket.on('disconnect', onDisconnect);
    return () => { socket.off('disconnect', onDisconnect); };
  }, [socket, sessionId, updateSession]);

  const retry = () => {
    updateSession(sessionId, { status: 'idle', isError: false, error: undefined });
    setPhase('auto');
  };

  const handleSetCurrentDir = useCallback((path?: string) => {
    updateSession(sessionId, { loading: true });
    const dirPath = path || session?.homeDir || '';
    localStorage.setItem(`sftp_current_dir_${sessionId}`, dirPath);
    if (session?.host) localStorage.setItem(`sftp_host_dir_${session.host}`, dirPath);
    listDir(dirPath);
  }, [sessionId, session?.homeDir, session?.host, updateSession, listDir]);

  const handleSetLoading = useCallback((v: boolean) => updateSession(sessionId, { loading: v }), [sessionId, updateSession]);

  const cancelDownload = useCallback((name: string) => {
    socket?.emit(SocketEventConstants.CANCEL_DOWNLOADING, name);
    setDownloadProgress({});
  }, [socket]);

  // "Show this in Files" requests from the terminal (path links, status bar).
  const navRequest = useFilesNavStore((s) => s.requests[sessionId]);
  const consumeNav = useFilesNavStore((s) => s.consume);
  useEffect(() => {
    if (!navRequest || !isSftpConnected) return;
    consumeNav(sessionId);
    handleSetCurrentDir(navRequest.dir);
    if (navRequest.file) {
      window.open(
        `/ssh/sftp/editor?path=${encodeURIComponent(navRequest.file)}&tabId=${encodeURIComponent(sessionId)}&user=${encodeURIComponent(sshHost)}`,
        '_blank',
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navRequest?.nonce, isSftpConnected]);

  const terminalCwd = useTerminalStore((s) => s.cwd[sessionId]);
  const [copied, setCopied] = useState(false);
  const copyPath = (p: string) => {
    void navigator.clipboard?.writeText(p).catch(() => { });
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  if (session && isConnected && isSftpConnected && socket) {
    return (
      <SFTPContext.Provider value={{ socket, isConnected: true, tabId: sessionId }}>
        <div className="flex flex-col w-full h-full min-w-0 min-h-0 bg-[#0A0A0A]">
          {/* Terminal ↔ Files bridge */}
          <div className="flex items-center gap-1 px-3 py-1 border-b border-gray-800 text-[11px] text-gray-400 shrink-0">
            <span className="truncate font-mono text-gray-300" title={session.currentDir}>{session.currentDir || '…'}</span>
            <button
              onClick={() => copyPath(session.currentDir)}
              title="Copy path"
              className="p-1 rounded hover:bg-gray-800 hover:text-gray-100"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
            <div className="flex-1" />
            <button
              onClick={() => void openTerminalFolderInFiles(sessionId)}
              title={terminalCwd ? `Go to the terminal's folder (${terminalCwd})` : "Go to the terminal's folder (turns on folder tracking in the shell)"}
              className="flex items-center gap-1 px-2 py-0.5 rounded hover:bg-gray-800 hover:text-gray-100"
            >
              <LocateFixed className="h-3.5 w-3.5" /> Terminal's folder
            </button>
            <button
              onClick={() => session.currentDir && cdTerminalTo(sessionId, session.currentDir)}
              disabled={!session.currentDir}
              title="cd the terminal into this folder and switch to it"
              className="flex items-center gap-1 px-2 py-0.5 rounded hover:bg-gray-800 hover:text-gray-100 disabled:opacity-40"
            >
              <CornerDownLeft className="h-3.5 w-3.5" /> cd here in terminal
            </button>
          </div>
          <div className="flex-1 min-h-0 overflow-hidden">
            <FilePane
              title={session.title || session.host || sshHost}
              files={session.remoteFiles}
              path={session.currentDir}
              hasError={session.isError}
              handleSetCurrentDir={handleSetCurrentDir}
              handleSetLoading={handleSetLoading}
              loading={session.loading}
            />
          </div>
          {Object.keys(downloadProgress).length > 0 && (
            <div className="p-2 shrink-0">
              {Object.entries(downloadProgress).map(([key, file], index) => (
                <ShowProgressBar key={key} download={file} onCancel={() => cancelDownload(file.name)} index={index} />
              ))}
            </div>
          )}
        </div>
      </SFTPContext.Provider>
    );
  }

  return (
    <div className="flex w-full h-full items-center justify-center bg-[#0A0A0A] p-6 text-gray-300">
      {phase === 'prompt' ? (
        <CredentialPrompt
          host={sshHost}
          username={sshUser}
          onSubmit={(creds) => {
            promptedCreds.set(sessionId, creds);
            setPhase('auto');
            updateSession(sessionId, { status: 'idle', isError: false });
            sendConnect(creds, 'creds');
          }}
        />
      ) : phase === 'failed' ? (
        <div className="flex max-w-sm flex-col items-center gap-3 text-center">
          <AlertTriangle className="h-9 w-9 text-red-400" />
          <p className="text-sm font-medium text-gray-100">Couldn't open files on {sshHost}</p>
          {session?.error && <p className="text-xs text-gray-400 break-words">{session.error}</p>}
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={retry} className="gap-1.5"><RefreshCw className="h-3.5 w-3.5" /> Retry</Button>
            <Button size="sm" variant="ghost" onClick={() => setPhase('prompt')} className="gap-1.5"><KeyRound className="h-3.5 w-3.5" /> Use other credentials</Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="relative">
            <FolderOpen className="h-10 w-10 text-green-500/60" />
            <Loader2 className="absolute -right-2 -bottom-2 h-5 w-5 animate-spin text-green-400" />
          </div>
          <p className="text-sm text-gray-200">{isConnected ? 'Opening files…' : 'Connecting…'}</p>
          <p className="text-xs text-gray-500">{sshUser ? `${sshUser}@` : ''}{sshHost}</p>
        </div>
      )}
    </div>
  );
}

function CredentialPrompt({ host, username, onSubmit }: { host: string; username: string; onSubmit: (c: Creds) => void }) {
  const [authMethod, setAuthMethod] = useState<'password' | 'privateKey'>('password');
  const [secret, setSecret] = useState('');
  const [port, setPort] = useState('22');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!secret) return;
    onSubmit({
      host,
      username,
      port: Number(port) || 22,
      authMethod,
      ...(authMethod === 'password' ? { password: secret } : { privateKeyText: secret }),
    });
  };

  const inputCls = 'w-full rounded-md border border-gray-700 bg-black/40 px-2.5 py-1.5 text-sm text-gray-100 outline-none focus:border-green-600';

  return (
    <form onSubmit={submit} className="flex w-full max-w-sm flex-col gap-3 rounded-xl border border-gray-800 bg-[#111] p-5">
      <div className="flex items-center gap-2">
        <KeyRound className="h-4 w-4 text-green-400" />
        <span className="text-sm font-semibold text-gray-100">Open files on {host}</span>
      </div>
      <p className="text-xs text-gray-500">
        The login for this tab isn't in memory (e.g. after a reload). Enter it once to open SFTP as <span className="text-gray-300">{username}</span>.
      </p>
      <div className="flex gap-1 rounded-md bg-black/40 p-0.5 text-xs">
        {(['password', 'privateKey'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => { setAuthMethod(m); setSecret(''); }}
            className={`flex-1 rounded px-2 py-1 ${authMethod === m ? 'bg-gray-700/70 text-gray-100' : 'text-gray-400 hover:text-gray-200'}`}
          >
            {m === 'password' ? 'Password' : 'Private key'}
          </button>
        ))}
      </div>
      {authMethod === 'password' ? (
        <input type="password" autoFocus value={secret} onChange={(e) => setSecret(e.target.value)} placeholder="Password" className={inputCls} />
      ) : (
        <textarea autoFocus value={secret} onChange={(e) => setSecret(e.target.value)} placeholder="-----BEGIN OPENSSH PRIVATE KEY-----" rows={5} className={`${inputCls} font-mono text-xs`} />
      )}
      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-500">Port</label>
        <input value={port} onChange={(e) => setPort(e.target.value.replace(/\D/g, ''))} className={`${inputCls} w-20`} />
        <Button type="submit" size="sm" disabled={!secret} className="ml-auto bg-green-600 text-white hover:bg-green-700">Open files</Button>
      </div>
    </form>
  );
}
