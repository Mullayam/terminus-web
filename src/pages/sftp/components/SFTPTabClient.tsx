/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useCallback, useState } from 'react';
import { FilePane } from './FilePane';
import { SocketEventConstants } from '@/lib/sockets/event-constants';
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
import { useSFTPStore } from '@/store/sftpStore';
import { SFTPContext } from '../sftp-context';
import { useSftpSocket } from '@/hooks/useSftpSocket';

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

    // Only truly local UI state (not per-tab data)
    const [hosts, setHosts] = useState<HostsObject[]>([]);
    const [hostId, setHostId] = useState<string | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState<Record<string, DownloadProgressType>>({});

    // ── Centralised socket lifecycle via hook ────────────────
    const { socket, isReady, connect, listDir } = useSftpSocket(tabId, {
        onDownloadProgress: setDownloadProgress,
    });

    // Helper to patch this tab's session in the store
    const patch = useCallback(
        (p: Partial<typeof session>) => updateSession(tabId, p as any),
        [tabId, updateSession],
    );

    // Load hosts from IDB
    useEffect(() => {
        idb.getAllItems('hosts').then((data) => {
            if (data) setHosts(data as any);
        });
    }, []);

    const handleSetCurrentDir = useCallback(
        (path?: string) => {
            patch({ loading: true });
            const dirPath = path || session?.homeDir || '';
            localStorage.setItem(`sftp_current_dir_${tabId}`, dirPath);
            if (session?.host) {
                localStorage.setItem(`sftp_host_dir_${session.host}`, dirPath);
            }
            listDir(dirPath);
        },
        [tabId, session?.homeDir, session?.host, patch, listDir],
    );

    const handleSetLoading = useCallback(
        (input: boolean) => patch({ loading: input }),
        [patch],
    );

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

        // Store credentials in session for potential auto-reconnect
        updateSession(tabId, {
            password: data.password,
            authMethod: data.authMethod,
            username: data.username,
            host: data.host,
        });
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
        connect(JSON.stringify(data));
    };

    const downloadCancel = useCallback(
        (filename: string) => {
            socket?.emit(SocketEventConstants.CANCEL_DOWNLOADING, filename);
            setDownloadProgress({});
        },
        [socket],
    );

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

    // ── Connected view ──────────────────────────────────────
    if (isConnected && isSftpConnected && socket) {
        return (
            <SFTPContext.Provider value={{ socket, isConnected: true, tabId }}>
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

    // ── Connection form / host picker ───────────────────────
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
