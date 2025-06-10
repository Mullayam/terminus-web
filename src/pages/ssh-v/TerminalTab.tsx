import React, { useRef, useState } from 'react';
import { z } from 'zod';
import { useStore } from '@/store';
import { io, Socket } from 'socket.io-client';
import { SocketEventConstants } from '@/lib/sockets/event-constants';


import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import SSHConnectionForm from './components/ssh-connection-form';
import { addData, getDataById, updateData } from '@/lib/idb';

import { useSSHStore } from '../../store/sshStore';
import XTerminal from './components/Terminal';
import { FullScreenLoader } from '@/components/loader';
import InfoBadge from './components/InfoBadge';
import { TerminalLayout } from './components/terminal2';
import { RefreshCcw } from 'lucide-react';




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
    const { setActiveTabData, activeTabData } = useStore()
    const [isLoading, setIsLoading] = useState(false)
    const socketRef = useRef<Socket | null>(null);
    const { tabs, sessions, addSession, updateStatus, updateSftpStatus } = useSSHStore()



    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: DEFAULT_FORM_VALUES
    });


    const handleSubmit = async (data: FormValues) => {
        if (data.saveCredentials) {
            if (!await getDataById(data.host)) {
                addData(data.host, data);
            }
            else {
                updateData(data, data.host);
            }
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

    }

    React.useEffect(() => {
        const session = sessions[sessionId]

        let socket = null
        if (session && !session?.socket) {
            session.socket = io('http://localhost:7145', {
                query: { sessionId },
                autoConnect: true,
                reconnection: false,

            });
            socket = session.socket
        } else {
            socket = io('http://localhost:7145', {
                query: { sessionId },
                autoConnect: true,
                reconnection: false,
            });
        }
        if (!socketRef.current) {
            socketRef.current = socket
        }


        const handleSSHReady = (data: string) => {

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
        socket.on(SocketEventConstants.SSH_READY, handleSSHReady);
        socket.on(SocketEventConstants.SFTP_READY, handleSFTPStatus);
        socket.on(SocketEventConstants.SSH_EMIT_ERROR, handleSSHError);

        socket.on("connect", () => {
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
                reconnectTimeoutRef.current = null;
            }
        })
        socket.on("disconnect", () => {
            updateStatus(sessionId, 'disconnected', 'Disconnected from server');
        });
        socket.on('connect_error', (error) => {
            console.log('Socket connection error:', error);
            updateStatus(sessionId, 'error', `Connection error: ${error.message}`);

        });
        return () => {
            socket.off(SocketEventConstants.SSH_READY, handleSSHReady);
            socket.off(SocketEventConstants.SSH_EMIT_ERROR, handleSSHError);
            socket.off("connect");
            socket.off("connect_error");
            socket.off("disconnect");
        };
    }, [sessionId]);


    React.useEffect(() => {
        if (activeTabData !== null) {
            form.reset(activeTabData);
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
                                <div className=" text-gray-200 text-xs text-right flex flex-row gap-4">
                                    {!socketRef.current?.connected && <RefreshCcw className='w-4 h-4' />}
                                    <InfoBadge status={sessions[sessionId].status} />
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