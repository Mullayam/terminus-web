import React, { useMemo, useRef, useState } from 'react';
import { z } from 'zod';
import { useStore } from '@/store';
import { io, Socket } from 'socket.io-client';
import { SocketEventConstants } from '@/lib/sockets/event-constants';


import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import SSHConnectionForm from './components/ssh-connection-form';
import { idb } from '@/lib/idb';

import { useSSHStore } from '../../store/sshStore';
import XTerminal from './components/Terminal';
import { FullScreenLoader } from '@/components/loader';
import InfoBadge from './components/InfoBadge';
import TerminalLayout from './components/terminal2';
import { RefreshCcw } from 'lucide-react';
import { useDiagnosticsStore } from '@/store/diagnosticsStore';
import { DiagnosticsStatus } from './components/terminal2/diagnostics';
import { useTabStore } from '@/store/rightSidebarTabStore';
import { useIdleReconnect } from '@/hooks/useIdleReconnect';
import { useSessionDisconnect } from '@/hooks/useSessionDisconnect';
import { useSessionTheme } from '@/hooks/useSessionTheme';
import { __config } from '@/lib/config';
import { useTerminalStore } from '@/store/terminalStore';
import { useSidebarState } from '@/store/sidebarStore';
import SSHSftpViewer from './components/SSHSftpViewer';
import ServerStatus from '@/components/layout/ServerStatus';
import { useNavigate } from 'react-router-dom';
import { useSFTPStore } from '@/store/sftpStore';



interface Props {
    sessionId: string;
}
export const formSchema = z
    .object({
        host: z.string().min(1, 'Host is required'),
        port: z.number().min(1, 'Port is required').default(22),
        username: z.string().min(1, 'Username is required'),
        authMethod: z.enum(['password', 'privateKey']),
        password: z.string().optional(),
        privateKeyText: z.string().optional(),
        privateKeyFile: z.instanceof(File).optional(),
        saveCredentials: z.boolean(),
        localName: z.string().optional(),
    })
    .refine(
        (data) => {
            if (data.authMethod === 'password') {
                return !!data.password;
            } else {
                return !!data.privateKeyText || !!data.privateKeyFile;
            }
        },
        {
            message: 'Please provide either a password or a private key',
            path: ['authMethod'],
        }
    );
export type FormValues = z.infer<typeof formSchema>;
export const DEFAULT_FORM_VALUES: FormValues = {
    host: '',
    port: 22,
    username: '',
    authMethod: 'password',
    password: '',
    privateKeyText: '',
    saveCredentials: false,
    localName: '',
}

/** Inline diagnostics counts for the status bar */
function StatusBarDiagnostics({ sessionId }: { sessionId: string }) {
    const diagnosticsEnabled = useTabStore((s) => s.settings.diagnostics);
    const diag = useDiagnosticsStore((s) => s.sessions[sessionId]);
    const clearSession = useDiagnosticsStore((s) => s.clearSession);
    const openDiagChat = useDiagnosticsStore((s) => s.openDiagChat);

    if (!diagnosticsEnabled || !diag) return null;
    if (diag.counts.errors === 0 && diag.counts.warnings === 0) return null;

    return (
        <DiagnosticsStatus
            counts={diag.counts}
            onClickErrors={() => openDiagChat('error')}
            onClickWarnings={() => openDiagChat('warning')}
            onClear={() => clearSession(sessionId)}
        />
    );
}

export default function TerminalTab({ sessionId }: Props) {
    const [isLoading, setIsLoading] = useState(false)
    const [hostId, setHostId] = useState<string | null>(null)
    const startTracking = useIdleReconnect()
    const { disconnect } = useSessionDisconnect()
    const { colors } = useSessionTheme();
    const navigate = useNavigate();
    const { setActiveTabData, activeTabData } = useStore()
    const { addSharedSession, addPermissions, deletePermission, deleteSharedSession } = useTerminalStore()
    const { activeItem } = useSidebarState();

    const { tabs, sessions, addSession, updateStatus, updateSftpStatus, activeTabId, loadSessionTheme, loadSessionFont, splitMode, splitTabId } = useSSHStore();
    const socketRef = useRef<Socket | null>(null);

    // Check if SFTP is available on any session connected to the same host
    // Also cross-check the independent SFTP store for same-host connections
    const sftpSessions = useSFTPStore((s) => s.sessions);
    const sftpAvailableForHost = useMemo(() => {
        const host = sessions[sessionId]?.host;
        if (!host) return false;
        // Check SSH store sessions
        if (Object.values(sessions).some(s => s.host === host && s.sftp_enabled)) return true;
        // Check SFTP store sessions (independent SFTP connections)
        return Object.values(sftpSessions).some(s => s.host === host && s.isSftpConnected);
    }, [sessions, sftpSessions, sessionId]);

    // Get the socket that has SFTP enabled (prefer current session, fall back to same-host session)
    const sftpSocket = useMemo(() => {
        if (sessions[sessionId]?.sftp_enabled) return null; // will use socketRef.current
        const host = sessions[sessionId]?.host;
        if (!host) return null;
        const sftpSession = Object.values(sessions).find(s => s.host === host && s.sftp_enabled);
        return sftpSession?.socket ?? null;
    }, [sessions, sessionId]);

    // Split view: get the split session's socket
    const splitSession = splitMode !== 'none' && splitTabId && splitTabId !== sessionId ? sessions[splitTabId] : null;
    const splitSocket = splitSession?.socket ?? null;

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: DEFAULT_FORM_VALUES
    });


    const handleSubmit = async (data: FormValues) => {
        if (data.saveCredentials) {
            const randomId = Math.random().toString(36).substring(2, 9);
            idb.has("hosts", hostId || "").then((exists) => {
                if (!exists) {
                    idb.addNestedItem("hosts", randomId, {
                        id: randomId,
                        ...data,
                    });
                } else {
                    idb.updateItem("hosts", hostId!, data as any);
                }
            })

        }
        addSession({
            host: data.host,
            username: data.username,
            sessionId: sessionId,
            status: 'connecting',
            socket: socketRef.current,
            sftp_enabled: false
        })

        setActiveTabData(data);
        socketRef.current?.emit(SocketEventConstants.SSH_START_SESSION, JSON.stringify(data));
        setIsLoading(true);
        hostId && setHostId(null)

    }

    React.useEffect(() => {
        const session = sessions[sessionId]

        // Load persisted theme from IndexedDB for this session
        loadSessionTheme(sessionId);
        // Load persisted font settings from localStorage for this session
        loadSessionFont(sessionId);

        let socket = null
        if (session && session?.socket) {
            socket = session.socket
            socketRef.current = session.socket
        } else {
            socket = io(__config.API_URL, {
                query: { sessionId },
                autoConnect: true,
                forceNew: true,      // each SSH tab gets its own transport
                multiplex: false,
            });
            socketRef.current = socket;
            if (session) {
                session.socket = socket;
            }
        }

        const handleSSHReady = (data: string) => {
            console.log("Ready")
            updateStatus(sessionId, 'connected', data)
            setIsLoading(false);
        };

        const handleSSHError = (data: string) => {
            updateStatus(sessionId, 'error', data)
            setIsLoading(false);
        };
        const handleSFTPStatus = (data: string) => {
            updateSftpStatus(sessionId, true)
        }
        const handleCLoseSession = () => disconnect(sessionId, activeTabId!)


        const storeHandshakeLogs = (data: string) => {
            //  console.log(data)   
        }
        const handleDeleteSession = (socketId: string) => {
          
            deletePermission(activeTabId!, socketId)
            deleteSharedSession(activeTabId!, socketId)
        }
        const handleAddSession = ({ socketId, socketIds }: { socketId: string, socketIds: string[] }) => {
            addSharedSession(activeTabId!, socketIds)
            addPermissions(activeTabId!, socketId, '400')
        }
        const handleCollabUserJoined = (data: { socketId: string; userCount: number; ip?: string }) => {
            const current = useTerminalStore.getState().sessionInfo.shared_sessions[activeTabId!];
            const existing = current?.socketIds ?? [];
            if (!existing.includes(data.socketId)) {
                addSharedSession(activeTabId!, [...existing, data.socketId])
            }
            addPermissions(activeTabId!, data.socketId, '400')
        }
        const handleCollabUserLeft = (data: { socketId: string; userCount: number }) => {
            deleteSharedSession(activeTabId!, data.socketId)
        }
        const onResume = () => {
            socket?.emit(SocketEventConstants.SSH_RESUME, sessionId)

        }
        socket.on(SocketEventConstants.session_info, handleAddSession)
        socket.on(SocketEventConstants.COLLAB_USER_JOINED, handleCollabUserJoined)
        socket.on(SocketEventConstants.COLLAB_USER_LEFT, handleCollabUserLeft)
        socket.on(SocketEventConstants.SSH_DISCONNECTED, handleDeleteSession);
        socket.on(SocketEventConstants.SSH_EMIT_LOGS, storeHandshakeLogs);
        socket.on(SocketEventConstants.SSH_READY, handleSSHReady);
        socket.on(SocketEventConstants.SFTP_READY, handleSFTPStatus);
        socket.on(SocketEventConstants.SSH_EMIT_ERROR, handleSSHError);
        socket.on('connect', () => console.log('Connected', socket.id));
        socket.on('disconnect', () => {
            console.log('Disconnected');
            navigate('/ssh/connect');
        });
        socket.on('connect_error', (error) => console.error('Error:', error));



        return () => {
            socket.off(SocketEventConstants.SSH_DISCONNECTED, handleDeleteSession);
            socket.off(SocketEventConstants.SSH_EMIT_LOGS, storeHandshakeLogs);
            socket.off(SocketEventConstants.SSH_READY, handleSSHReady);
            socket.off(SocketEventConstants.SFTP_READY, handleSFTPStatus);
            socket.off(SocketEventConstants.SSH_EMIT_ERROR, handleSSHError);
            socket.off(SocketEventConstants.session_info, handleAddSession);
            socket.off(SocketEventConstants.COLLAB_USER_JOINED, handleCollabUserJoined);
            socket.off(SocketEventConstants.COLLAB_USER_LEFT, handleCollabUserLeft);
            socket.off("connect");
            socket.off("connect_error");
            socket.off("disconnect");
        }


    }, [sessionId, activeTabId]);
    React.useEffect(() => {

        if (activeTabData !== null) {
            form.reset(activeTabData);
            setHostId(activeTabData.id)
            setActiveTabData(null);
            return
        }

    }, [])

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {isLoading && <FullScreenLoader text={sessions[sessionId]?.host || 'starting session'} />}
            {sessions[sessionId]?.status === 'connected' && socketRef.current ?
                <>
                    <div className="flex-1 min-h-0 overflow-hidden">
                        <TerminalLayout>
                            <div style={{ display: activeItem === 'Terminal' ? 'contents' : 'none' }}>
                                {splitMode !== 'none' && splitSocket ? (
                                    <div className={`flex ${splitMode === 'horizontal' ? 'flex-col' : 'flex-row'} w-full h-full`}>
                                        <div className="flex-1 min-w-0 min-h-0 overflow-hidden">
                                            <XTerminal sessionId={sessionId} socket={socketRef.current} />
                                        </div>
                                        <div className={`${splitMode === 'horizontal' ? 'h-[2px]' : 'w-[2px]'} shrink-0`} style={{ backgroundColor: `${colors.foreground}30` }} />
                                        <div className="flex-1 min-w-0 min-h-0 overflow-hidden">
                                            <XTerminal key={`split-${splitTabId}`} sessionId={splitTabId!} socket={splitSocket} />
                                        </div>
                                    </div>
                                ) : (
                                    <XTerminal sessionId={sessionId} socket={socketRef.current} />
                                )}
                            </div>
                            {activeItem === 'SFTP' && sftpAvailableForHost && (
                                <SSHSftpViewer socket={(sftpSocket || socketRef.current)!} host={sessions[sessionId]?.host || 'SFTP Host'} />
                            )}
                            {activeItem === 'SFTP' && !sftpAvailableForHost && (
                                <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                                    SFTP is not available for this session.
                                </div>
                            )}
                        </TerminalLayout>
                    </div>
                    {tabs.length !== 0 && sessions[sessionId] && (
                        <>
                            <div className="flex justify-between items-center flex-wrap px-4 py-1 border-t text-xs shrink-0" style={{ backgroundColor: `${colors.background}dd`, color: colors.foreground, borderColor: `${colors.foreground}20` }}>

                                <div className="flex flex-row gap-4">
                                    <span>Public IPs: <a href={`http://${sessions[sessionId].host}`}
                                        target="_blank" rel="noopener noreferrer" className="inline-block text-gray-200 dark:text-neutral-200 hover:underline" >
                                        {sessions[sessionId].host} </a></span>
                                    <span>Username: {sessions[sessionId].username}</span>
                                    <span>SFTP:  {sftpAvailableForHost ? 'Enabled' : 'Disabled'} </span>
                                    <StatusBarDiagnostics sessionId={sessionId} />
                                </div>
                                <div className="flex flex-row gap-4">
                                    <div>
                                        Socket: {socketRef.current?.connected ? <span
                                            className={`size-2 inline-block rounded-full me-2 bg-green-500`}
                                        ></span> : <span
                                            className={`size-2 inline-block rounded-full me-2 bg-red-500`}
                                        ></span>}</div>
                                    <div className='cursor-pointer' onClick={() => window.navigator.clipboard.writeText(sessionId)}>
                                        Session:  {sessionId}
                                    </div>

                                </div>
                                <div className=" text-gray-200 text-xs text-right flex flex-row gap-4">

                                    {!socketRef.current?.connected && <RefreshCcw className='w-4 h-4 animate-spin' />}
                                    <ServerStatus isConnected={socketRef.current?.connected} />
                                </div>
                                {/* Left: SSH/SFTP toggle */}
                                <div className="flex items-center gap-1 mr-3">
                                    <button
                                        className="px-2 py-0.5 rounded text-[11px] font-medium transition-colors"
                                        style={{ background: colors.foreground + '20', color: colors.foreground }}
                                    >
                                        SSH
                                    </button>
                                    <button
                                        onClick={() => navigate('/ssh/sftp')}
                                        className="px-2 py-0.5 rounded text-[11px] font-medium transition-colors opacity-60 hover:opacity-100"
                                        style={{ color: colors.foreground }}
                                    >
                                        SFTP
                                    </button>
                                </div>

                            </div>
                        </>
                    )
                    }
                </>
                : (
                    <div className='flex items-center justify-center relative h-full '>
                        <SSHConnectionForm<typeof form> form={form} handleSubmit={handleSubmit} isLoading={false} />
                        {/* SSH / SFTP toggle — bottom bar */}
                        <div className="absolute bottom-0 inset-x-0 flex justify-end items-center flex-wrap  px-4 py-1 border-t text-xs shrink-0 border-gray-800 bg-[#0A0A0A]/90 text-gray-300 z-10">
                            <div className="flex items-center gap-1">
                                <button className="px-2 py-0.5 rounded text-[11px] font-medium transition-colors text-gray-200 bg-gray-700/50">
                                    SSH
                                </button>
                                <button
                                    onClick={() => navigate('/ssh/sftp')}
                                    className="px-2 py-0.5 rounded text-[11px] font-medium transition-colors text-gray-400 hover:text-gray-100"
                                >
                                    SFTP
                                </button>
                            </div>
                        </div>
                    </div>
                )}
        </div>
    );
}
