/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { FilePane } from './FilePane';
import { SocketEventConstants } from '@/lib/sockets/event-constants';
import { useToast } from '@/hooks/use-toast';
import { SFTP_FILES_LIST } from './interface';
import SSHConnectionForm from '@/pages/ssh-v/components/ssh-connection-form';
import { useForm } from 'react-hook-form';
import { DEFAULT_FORM_VALUES, formSchema, FormValues } from '@/pages/ssh-v/TerminalTab';
import { zodResolver } from '@hookform/resolvers/zod';
import { idb } from '@/lib/idb';
import { ShowProgressBar } from './DownloadProgress';
import { HostsObject } from '@/pages';
import { Button } from '@/components/ui/button';
import { HostCard } from '@/pages/ssh-v/components/HostCard';
import { Loader2, X } from 'lucide-react';
import { useSFTPStore, getOrCreateSocket } from '@/store/sftpStore';
import { SFTPContext } from '../sftp-context';

export interface DownloadProgressType {
    name: string;
    transferred: number;
    totalSize: number;
    percent: number;
    speed: { speed: string; unit: string };
    eta: number;
    status: string;
    remaining: { size: string; unit: string };
}

export default function SFTPTabClient({ tabId }: { tabId: string }) {
    const form = useForm({
        resolver: zodResolver(formSchema),
        defaultValues: DEFAULT_FORM_VALUES,
    });

    const { updateSession } = useSFTPStore();
    const session = useSFTPStore((s) => s.sessions[tabId]);
    const updateTab = useSFTPStore((s) => s.addTab); // for title updates
    const socketRef = useRef<Socket | null>(null);
    // Track socket as state so children re-render only after socket is set
    const [socketReady, setSocketReady] = useState<Socket | null>(null);

    // Only truly local UI state (not per-tab data)
    const [hosts, setHosts] = useState<HostsObject[]>([]);
    const [hostId, setHostId] = useState<string | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState<Record<string, DownloadProgressType>>({});

    const { toast } = useToast();

    // Helper to patch this tab's session in the store
    const patch = useCallback(
        (p: Partial<typeof session>) => updateSession(tabId, p as any),
        [tabId, updateSession]
    );

    // Get or reuse the persistent socket for this tab
    useEffect(() => {
        const socket = getOrCreateSocket(tabId);
        socketRef.current = socket;
        setSocketReady(socket);

        // If already connected & SFTP ready (remount scenario), restore state
        if (socket.connected) {
            patch({ isConnected: true });
        }
        const storedSession = useSFTPStore.getState().sessions[tabId];
        if (storedSession?.status === 'connected') {
            patch({ isSftpConnected: true, isConnected: true });
            const savedDir = localStorage.getItem(`sftp_current_dir_${tabId}`) || '';
            socket.emit(SocketEventConstants.SFTP_GET_FILE, { dirPath: savedDir });
        }

        const onConnect = () => {
            patch({ isConnected: true });
            updateSession(tabId, { socket });
        };
        const onDisconnect = () => patch({ isConnected: false });
        const onConnectError = (err: Error) => {
            console.error('SFTP socket error:', err);
            patch({ isConnected: false });
        };
        const onSftpReady = () => {
            const savedDir = localStorage.getItem(`sftp_current_dir_${tabId}`) || '';
            socket.emit(SocketEventConstants.SFTP_GET_FILE, { dirPath: savedDir });
            patch({ isSftpConnected: true, isConnecting: false, loading: false, status: 'connected' });
        };
        const onCurrentPath = (cwd: string) => {
            patch({ currentDir: cwd, homeDir: cwd, loading: false });
        };
        const onFileUploaded = (data: string) => {
            toast({ title: 'File Uploaded', description: 'File uploaded successfully at ' + data, variant: 'default' });
            const currentSession = useSFTPStore.getState().sessions[tabId];
            socket.emit(SocketEventConstants.SFTP_GET_FILE, { dirPath: currentSession?.currentDir || '' });
        };
        const onFilesList = (data: any) => {
            patch({
                loading: false,
                remoteFiles: JSON.parse(data.files),
                currentDir: data.currentDir,
                homeDir: data.workingDir,
            });
        };
        const onError = (data: string) => {
            patch({ isError: true, isConnecting: false, status: 'error', error: data, loading: false });
            toast({ title: 'SFTP Error', description: data, variant: 'destructive' });
        };
        const onSuccess = (data: string) => {
            toast({ description: data, variant: 'default' });
        };
        const onCompressing = (data: string) => {
            console.log(data);
        };
        const onDownloadProgress = (data: DownloadProgressType) => {
            setDownloadProgress((prev) => {
                if (data.percent >= 100) {
                    const { [data.name]: _, ...rest } = prev;
                    return rest;
                }
                return { ...prev, [data.name]: data };
            });
        };

        socket.on('connect', onConnect);
        socket.on('disconnect', onDisconnect);
        socket.on('connect_error', onConnectError);
        socket.on(SocketEventConstants.SFTP_READY, onSftpReady);
        socket.on(SocketEventConstants.SFTP_CURRENT_PATH, onCurrentPath);
        socket.on(SocketEventConstants.FILE_UPLOADED, onFileUploaded);
        socket.on(SocketEventConstants.SFTP_FILES_LIST, onFilesList);
        socket.on(SocketEventConstants.ERROR, onError);
        socket.on(SocketEventConstants.SUCCESS, onSuccess);
        socket.on(SocketEventConstants.COMPRESSING, onCompressing);
        socket.on(SocketEventConstants.DOWNLOAD_PROGRESS, onDownloadProgress);
        socket.on(SocketEventConstants.STARTING, onDownloadProgress);
        socket.on(SocketEventConstants.COMPRESSING, onDownloadProgress);
        return () => {
            socket.off('connect', onConnect);
            socket.off('disconnect', onDisconnect);
            socket.off('connect_error', onConnectError);
            socket.off(SocketEventConstants.SFTP_READY, onSftpReady);
            socket.off(SocketEventConstants.SFTP_CURRENT_PATH, onCurrentPath);
            socket.off(SocketEventConstants.FILE_UPLOADED, onFileUploaded);
            socket.off(SocketEventConstants.SFTP_FILES_LIST, onFilesList);
            socket.off(SocketEventConstants.ERROR, onError);
            socket.off(SocketEventConstants.SUCCESS, onSuccess);
            socket.off(SocketEventConstants.COMPRESSING, onCompressing);
            socket.off(SocketEventConstants.DOWNLOAD_PROGRESS, onDownloadProgress);
            socket.off(SocketEventConstants.STARTING, onDownloadProgress);
            socket.off(SocketEventConstants.COMPRESSING, onDownloadProgress);

        };
    }, [tabId]);

    // Load hosts from IDB
    useEffect(() => {
        idb.getAllItems('hosts').then((data) => {
            if (data) setHosts(data as any);
        });
    }, []);

    const handleSetCurrentDir = (path?: string) => {
        patch({ loading: true });
        const dirPath = path || session?.homeDir || '';
        localStorage.setItem(`sftp_current_dir_${tabId}`, dirPath);
        socketRef.current?.emit(SocketEventConstants.SFTP_GET_FILE, { dirPath });
    };

    const handleSetLoading = (input: boolean) => {
        patch({ loading: input });
    };

    const handleSubmit = async (data: FormValues) => {
        if (data.saveCredentials) {
            const randomId = Math.random().toString(36).substring(2, 9);
            idb.has('hosts', hostId || '').then((exists) => {
                if (!exists) {
                    idb.addNestedItem('hosts', randomId, { id: randomId, ...data });
                } else {
                    idb.updateItem('hosts', hostId!, data as any);
                }
            });
        }

        updateSession(tabId, { password: data.password, authMethod: data.authMethod, username: data.username, host: data.host }); // Store password in session for potential reconnects
        patch({
            loading: true,
            isConnecting: true,
            isError: false,
            status: 'connecting',
            host: data.host,
            username: data.username,
            title: data.host,
            authMethod: data.authMethod,
        });
        socketRef.current?.emit(SocketEventConstants.SFTP_CONNECT, JSON.stringify(data));
    };

    const downloadCancel = (filename: string) => {
        socketRef.current?.emit(SocketEventConstants.CANCEL_DOWNLOADING, filename);
        setDownloadProgress({});
        
    };

    const handleClickOnHostCard = (index: number) => {
        const data = hosts[index];
        if (!data) {
            idb.getAllItems('hosts').then((d) => {
                if (d) setHosts(d as any);
            });
            return;
        }
        setHostId(data.id);
        form.reset(data);
        handleSubmit(data as any);
    };

    // --- Read per-tab state from the store ---
    const isConnected = session?.isConnected ?? false;
    const isSftpConnected = session?.isSftpConnected ?? false;
    const isConnecting = session?.isConnecting ?? false;
    const loading = session?.loading ?? false;
    const isError = session?.isError ?? false;
    const currentDir = session?.currentDir ?? '';
    const remoteFiles = session?.remoteFiles ?? [];
    const sftpTitle = session?.title || session?.host || 'SFTP Host';

    if (isConnected && isSftpConnected && socketReady) {
        return (
            <SFTPContext.Provider value={{ socket: socketReady, isConnected: true, tabId }}>
                <div className="flex flex-col h-full">
                    <FilePane
                        title={sftpTitle}
                        files={remoteFiles}
                        path={currentDir}
                        hasError={isError}
                        handleSetCurrentDir={handleSetCurrentDir}
                        handleSetLoading={handleSetLoading}
                        loading={loading}
                    />
                    {Object.keys(downloadProgress).length > 0 && (
                        <div className="p-2">
                            {Object.entries(downloadProgress).map(([key, file]) => (
                                <ShowProgressBar
                                    key={key}
                                    download={file}
                                    onCancel={() => downloadCancel(file.name)}
                                    index={Object.keys(downloadProgress).indexOf(key)}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </SFTPContext.Provider>
        );
    }

    return (
        <div className="w-full h-full relative">
            {/* Connecting overlay */}
            {isConnecting && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm">
                    <Loader2 className="h-10 w-10 text-green-500 animate-spin" />
                    <p className="mt-3 text-sm text-gray-300">Connecting to SFTP server...</p>
                    <p className="mt-1 text-xs text-gray-500">{session?.host || ''}</p>
                </div>
            )}

            {hosts.length > 0 && !showForm ? (
                <div className="p-8">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-white text-xl font-semibold">Hosts</h2>
                        <Button
                            variant="ghost"
                            onClick={() => setShowForm(true)}
                            disabled={isConnecting}
                            className="text-sm text-blue-400 hover:underline"
                        >
                            New Connection
                        </Button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {hosts.map((host, index) => (
                            <div key={index} className={isConnecting ? 'pointer-events-none opacity-50' : ''}>
                                <HostCard index={index} info={host} onClick={handleClickOnHostCard} />
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <SSHConnectionForm<typeof form> isLoading={loading} form={form} handleSubmit={handleSubmit}>
                    {hosts.length > 0 && (
                        <Button variant="secondary" className="mx-4" onClick={() => setShowForm(false)} disabled={isConnecting}>
                            <X className="w-6 h-6 cursor-pointer" />
                        </Button>
                    )}
                </SSHConnectionForm>
            )}
        </div>
    );
}
