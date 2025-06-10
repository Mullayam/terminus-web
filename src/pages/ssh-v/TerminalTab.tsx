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
import { HostsObject } from '..';



interface Props {
    sessionId: string;
}
const formSchema = z
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

export default function TerminalTab({ sessionId }: Props) {
    const { setActiveTabData, activeTabData } = useStore()
    const [isLoading, setIsLoading] = useState(false)
    const socketRef = useRef<Socket | null>(null);


    const { tabs, activeTabId, sessions, addSession } = useSSHStore()





    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            host: '',
            port: 22,
            username: '',
            authMethod: 'password',
            password: '',
            privateKeyText: '',
            saveCredentials: false,
            localName: '',
        },
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
            status: 'connecting'
        })
        setActiveTabData(data);
        socketRef.current?.emit(SocketEventConstants.SSH_START_SESSION, JSON.stringify(data));
        setIsLoading(true);

    }

    React.useEffect(() => {
        const session = sessions[sessionId]

        if (!session?.socket) {
            session.socket = io('http://localhost:7145', {
                query: { sessionId }
            });
        }
        if (!socketRef.current) {
            socketRef.current = session.socket
        }
        const socket = session.socket;

        const handleSSHReady = (data: string) => {
            const updatedSession = {
                ...sessions[sessionId],
                status: 'connected',
                error: data,
                socket
            };
            addSession(updatedSession as any);
            setIsLoading(false);
        };

        const handleSSHError = (data: string) => {
            sessions[sessionId].status = 'error';
            sessions[sessionId].error = data;
            addSession(sessions[sessionId]);
            setIsLoading(false);
        };

        socket.on(SocketEventConstants.SSH_READY, handleSSHReady);
        socket.on(SocketEventConstants.SSH_EMIT_ERROR, handleSSHError);

        return () => {
            socket.off(SocketEventConstants.SSH_READY, handleSSHReady);
            socket.off(SocketEventConstants.SSH_EMIT_ERROR, handleSSHError);
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
            {sessions[sessionId].status === 'connected' && socketRef.current ?
                <>
                    <TerminalLayout>
                        <XTerminal sessionId={sessionId} socket={socketRef.current} />
                    </TerminalLayout>

                    {tabs.length !== 0 && activeTabId && (
                        <>
                            <div className="flex justify-between items-start flex-wrap px-4 py-1 border-t text-xs bg-[#1a1b26]">
                                <div className="flex flex-row  gap-4">
                                    <span>Public IPs: <a href={`http://${sessions[activeTabId].host}`}
                                        target="_blank" rel="noopener noreferrer" className="inline-block text-gray-200 dark:text-neutral-200 hover:underline" >
                                        {sessions[activeTabId].host} </a></span>
                                    <span>Username: {sessions[activeTabId].username}</span>
                                </div>
                                <div className=" text-gray-200 text-xs text-right">
                                    <InfoBadge status={sessions[activeTabId].status} />
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