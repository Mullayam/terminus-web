import React, { useRef, useState } from 'react';
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
import { useIdleReconnect } from '@/hooks/useIdleReconnect';
import { useSessionDisconnect } from '@/hooks/useSessionDisconnect';
import { __config } from '@/lib/config';
import { useTerminalStore } from '@/store/terminalStore';




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
export default function TerminalTab({ sessionId }: Props) {
    const [isLoading, setIsLoading] = useState(false)
    const [hostId, setHostId] = useState<string | null>(null)
    const startTracking = useIdleReconnect()
    const { disconnect } = useSessionDisconnect()
    const { setActiveTabData, activeTabData } = useStore()
    const { addSharedSession, addPermissions, deletePermission, deleteSharedSession } = useTerminalStore()

    const { tabs, sessions, addSession, updateStatus, updateSftpStatus, activeTabId } = useSSHStore()
    const socketRef = useRef<Socket | null>(null);

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: DEFAULT_FORM_VALUES
    });


    const handleSubmit = async (data: FormValues) => {
        if (data.saveCredentials) {
            const randomId = Math.random().toString(36).substring(2, 9);
            idb.has("hosts", hostId||"").then((exists) => {
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

        let socket = null
        if (session && session?.socket) {
            socket = session.socket
            socketRef.current = session.socket
        } else {
            socket = io(__config.API_URL, {
                query: { sessionId },
                autoConnect: true,
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
        const closeIdleTabSession = startTracking(handleCLoseSession);

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

        socket.on(SocketEventConstants.session_info, handleAddSession)
        socket.on(SocketEventConstants.SSH_DISCONNECTED, handleDeleteSession);
        socket.on(SocketEventConstants.SSH_EMIT_LOGS, storeHandshakeLogs);
        socket.on(SocketEventConstants.SSH_READY, handleSSHReady);
        socket.on(SocketEventConstants.SFTP_READY, handleSFTPStatus);
        socket.on(SocketEventConstants.SSH_EMIT_ERROR, handleSSHError);
        socket.on('connect', () => console.log('Connected'));
        socket.on('disconnect', () => console.log('Disconnected'));
        socket.on('connect_error', (error) => console.error('Error:', error));


        return () => {
            socket.off(SocketEventConstants.SSH_DISCONNECTED, handleDeleteSession);
            socket.off(SocketEventConstants.SSH_EMIT_LOGS, storeHandshakeLogs);
            socket.off(SocketEventConstants.SSH_READY, handleSSHReady);
            socket.off(SocketEventConstants.SFTP_READY, handleSFTPStatus);
            socket.off(SocketEventConstants.SSH_EMIT_ERROR, handleSSHError);
            socket.off(SocketEventConstants.session_info, handleAddSession);
            socket.off("connect");
            socket.off("connect_error");
            socket.off("disconnect");
            closeIdleTabSession()
        }


    }, [sessionId]);
    React.useEffect(() => {
        if (activeTabData !== null) {
            form.reset(activeTabData);
            setHostId(activeTabData.id)
            setActiveTabData(null);
            return
        }
    }, [])

    return (
        <div>
            {isLoading && <FullScreenLoader />}
            {sessions[sessionId]?.status === 'connected' && socketRef.current ?
                <>
                    <TerminalLayout>
                        <XTerminal sessionId={sessionId} socket={socketRef.current} />
                    </TerminalLayout>

                    {tabs.length !== 0 && sessions[sessionId] && (
                        <>
                            <div className="flex justify-between items-start flex-wrap px-4 py-1 border-t text-xs bg-[#1a1b26]">
                                <div className="flex flex-row  gap-4">
                                    <span>Public IPs: <a href={`http://${sessions[sessionId].host}`}
                                        target="_blank" rel="noopener noreferrer" className="inline-block text-gray-200 dark:text-neutral-200 hover:underline" >
                                        {sessions[sessionId].host} </a></span>
                                    <span>Username: {sessions[sessionId].username}</span>
                                    <span>SFTP:  {sessions[sessionId].sftp_enabled ? 'Enabled' : 'Disabled'} </span>
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
                                    <InfoBadge status={socketRef.current?.connected ? sessions[sessionId].status : 'disconnected'} />
                                </div>
                            </div>
                        </>
                    )
                    }
                </>
                : (
                    <div className='flex items-center justify-center'>
                        <SSHConnectionForm<typeof form> form={form} handleSubmit={handleSubmit} isLoading={false} />
                    </div>
                )}
        </div>
    );
}