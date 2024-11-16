/* eslint-disable react-refresh/only-export-components */
/* eslint-disable @typescript-eslint/no-explicit-any */
import * as z from 'zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import XTerminal from './Terminal';
import { zodResolver } from '@hookform/resolvers/zod';
import SSHConnectionForm from '@/pages/ssh/ssh-connection-form';
import { socket } from '@/lib/sockets';
import { SocketEventConstants } from '@/lib/sockets/event-constants';
import { FullScreenLoader } from '@/components/loader';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useSockets } from '@/hooks/use-sockets';
import { useLocation, useNavigate } from 'react-router-dom';
import { TerminalLayout } from './terminal2';
import { addData, getDataById, updateData } from '@/lib/idb';
import { useStore } from '@/store';

const formSchema = z
    .object({
        host: z.string().min(1, 'Host is required'),
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
const SSH = () => {
    const { toast } = useToast();
    const store = useStore()
    const navigate = useNavigate();
    const location = useLocation()
    const { isSSH_Connected, handleSSHConnection } = useSockets();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [value, setValue] = useState({
        host: '',
        username: '',
    });
    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            host: '',
            username: '',
            authMethod: 'password',
            password: '',
            privateKeyText: '',
            saveCredentials: false,
            localName: '',
        },
    });

    const handleSubmit = async (data: any) => {
        setIsLoading(true);
        setError('');
        setValue(data);
        if (data.saveCredentials) {
            if (!await getDataById(data.host)) {
                addData<FormValues>(data.host, data);
            }
            else {
                updateData<FormValues>(data, data.host);
            }
        }
        try {
            socket.emit(SocketEventConstants.SSH_CONNECT, data);
        } catch (err:any) {
            setError(err instanceof Error ? err.message : 'An unexpected error occurred');
            setIsLoading(false);
            toast({
                title: 'Socket Connection Error',
                description:  error,
                variant: 'destructive',
            });
        }
    };
    useEffect(() => {

        socket.on(SocketEventConstants.SSH_READY, ({uid, sessionId}: {uid: string, sessionId: string}) => {
            setIsLoading(false);
            store.addTab({ sessionId,uid, data: { host: value.host, username: value.username } });
            handleSSHConnection?.();
            form.reset();
        });
        socket.on("disconnect", () => {
            handleSSHConnection?.(false);
            navigate('/ssh/connect');
        });
        socket.on(SocketEventConstants.SSH_EMIT_ERROR, (data: string) => {
            setIsLoading(false);
            toast({
                title: 'SSH Error',
                description: data,
                variant: 'destructive',
            })
        });

        return () => {
            socket.off(SocketEventConstants.SSH_READY);
            socket.off(SocketEventConstants.SSH_DISCONNECTED);
        };
    }, [form, handleSSHConnection, navigate, store, toast, value]);

    useEffect(() => {
        if (!isSSH_Connected) {
            navigate('/ssh/connect');
        }
        if (location.state) {
            form.reset(location.state);
        }
    }, [form, isSSH_Connected, location.state, navigate,]);

    return (
        <div>
            {isLoading && <FullScreenLoader />}
            {isSSH_Connected ? (
                <>
                    <TerminalLayout>
                        <XTerminal backgroundColor='#1a1b26' />
                    </TerminalLayout>
                    <div className="flex justify-between items-start flex-wrap px-4 py-1 border-t text-xs bg-[#1a1b26]">
                        <div className="flex flex-row  gap-4">
                            <span>Public IPs: <a href={`http://${store.tabs[store.activeTab].data.host}`} className="inline-block text-gray-200 dark:text-neutral-200 hover:underline" >{(store.tabs[store.activeTab].data.host)} </a></span>
                            <span>Username: {store.tabs[store.activeTab].data.username}</span>
                        </div>
                        <div className=" text-gray-200   text-xs text-right">
                            Status:{' '}
                            {isSSH_Connected ? (
                                <div className="inline-flex items-center">
                                    <span className="size-2 inline-block bg-green-500 rounded-full me-2"></span>
                                    <span className="text-gray-200 dark:text-neutral-200">Connected</span>
                                </div>
                            ) : (
                                <div className="inline-flex items-center">
                                    <span className="size-2 inline-block bg-red-500 rounded-full me-2"></span>
                                    <span className="text-gray-200 dark:text-neutral-200">Disconnected</span>
                                </div>
                            )}
                        </div>
                    </div>
                    <Alert className='my-4'>
                        <AlertDescription>
                            SSH connection established successfully!Do No Refresh the page , otherwise the connection will be lost
                        </AlertDescription>
                    </Alert>

                </>
            ) : (
                <SSHConnectionForm<typeof form> form={form} handleSubmit={handleSubmit} isLoading={isLoading} />
            )}
        </div>
    );
};

export default SSH;
