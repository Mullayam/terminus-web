/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { memo, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
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
import { X } from 'lucide-react';
import { __config } from '@/lib/config';
import { useSFTPStore } from '@/store/sftpStore';
import { SFTPContext } from '../SftpClient';

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

function SFTPTabClient({ tabId }: { tabId: string }) {
  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: DEFAULT_FORM_VALUES,
  });

  const { updateSession } = useSFTPStore();
  const session = useSFTPStore((s) => s.sessions[tabId]);
  const socketRef = useRef<Socket | null>(null);

  const [hosts, setHosts] = useState<HostsObject[]>([]);
  const [title, setTitle] = useState<string | null>(null);
  const [hostId, setHostId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [currentDir, setCurrentDir] = useState('');
  const [homeDir, setHomeDir] = useState('');
  const [isError, setIsError] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isSftpConnected, setIsSftpConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<Record<string, DownloadProgressType>>({});
  const [remoteFiles, setRemoteFiles] = useState<Partial<SFTP_FILES_LIST[]>>([]);

  const { toast } = useToast();

  // Create a dedicated socket for this tab
  useEffect(() => {
    const socket = io(__config.API_URL, {
      query: { sessionId: tabId },
      autoConnect: true,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      updateSession(tabId, { socket });
    });
    socket.on('disconnect', () => setIsConnected(false));
    socket.on('connect_error', (err) => {
      console.error('SFTP socket error:', err);
      setIsConnected(false);
    });

    socket.on(SocketEventConstants.SFTP_READY, () => {
      setIsSftpConnected(true);
      updateSession(tabId, { status: 'connected' });
    });

    socket.on(SocketEventConstants.SFTP_CURRENT_PATH, (cwd: string) => {
      setCurrentDir(cwd);
      setHomeDir(cwd);
      setLoading(false);
    });

    socket.on(SocketEventConstants.FILE_UPLOADED, (data: string) => {
      toast({ title: 'File Uploaded', description: 'File uploaded successfully at ' + data, variant: 'default' });
      socket.emit(SocketEventConstants.SFTP_GET_FILE, { dirPath: currentDir });
    });

    socket.on(SocketEventConstants.SFTP_FILES_LIST, (data: any) => {
      setRemoteFiles(JSON.parse(data.files));
      setCurrentDir(data.currentDir);
      setHomeDir(data.workingDir);
    });

    socket.on(SocketEventConstants.ERROR, (data: string) => {
      setIsError(true);
      updateSession(tabId, { status: 'error', error: data });
      toast({ title: 'SFTP Error', description: data, variant: 'destructive' });
      setLoading(false);
    });

    socket.on(SocketEventConstants.SUCCESS, (data: string) => {
      toast({ description: data, variant: 'default' });
    });

    socket.on(SocketEventConstants.COMPRESSING, (data: string) => {
      console.log(data);
    });

    socket.on(SocketEventConstants.DOWNLOAD_PROGRESS, (data: DownloadProgressType) => {
      setDownloadProgress((prev) => {
        if (data.percent >= 100) {
          const { [data.name]: _, ...rest } = prev;
          return rest;
        }
        return { ...prev, [data.name]: data };
      });
    });

    return () => {
      socket.off(SocketEventConstants.SFTP_READY);
      socket.off(SocketEventConstants.SFTP_CURRENT_PATH);
      socket.off(SocketEventConstants.SFTP_FILES_LIST);
      socket.off(SocketEventConstants.ERROR);
      socket.off(SocketEventConstants.SUCCESS);
      socket.off(SocketEventConstants.FILE_UPLOADED);
      socket.off(SocketEventConstants.DOWNLOAD_PROGRESS);
      socket.off(SocketEventConstants.COMPRESSING);
      socket.disconnect();
    };
  }, [tabId]);

  // Load hosts
  useEffect(() => {
    idb.getAllItems('hosts').then((data) => {
      if (data) setHosts(data as any);
    });
  }, []);

  const handleSetCurrentDir = (path?: string) => {
    setLoading(true);
    const dirPath = path || homeDir;
    socketRef.current?.emit(SocketEventConstants.SFTP_GET_FILE, { dirPath });
    setLoading(false);
  };

  const handleSetLoading = (input: boolean) => {
    setLoading(input);
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

    setLoading(true);
    updateSession(tabId, { status: 'connecting', host: data.host, username: data.username });
    socketRef.current?.emit(SocketEventConstants.SFTP_CONNECT, JSON.stringify(data));
  };

  const downloadCancel = (filename: string) => {
    socketRef.current?.emit(SocketEventConstants.CANCEL_DOWNLOADING, filename);
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
    setTitle(data.host);
  };

  if (isConnected && isSftpConnected) {
    return (
      <SFTPContext.Provider value={{ socket: socketRef.current || undefined, isConnected: true }}>
        <div className="flex flex-col h-full">
          <FilePane
            title={title || session?.host || 'SFTP Host'}
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
    <div className="w-full h-full">
      {hosts.length > 0 && !showForm ? (
        <div className="p-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-white text-xl font-semibold">Hosts</h2>
            <Button variant="ghost" onClick={() => setShowForm(true)} className="text-sm text-blue-400 hover:underline">
              New Connection
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {hosts.map((host, index) => (
              <HostCard key={index} index={index} info={host} onClick={handleClickOnHostCard} />
            ))}
          </div>
        </div>
      ) : (
        <SSHConnectionForm<typeof form> isLoading={loading} form={form} handleSubmit={handleSubmit}>
          {hosts.length > 0 && (
            <Button variant="secondary" className="mx-4" onClick={() => setShowForm(false)}>
              <X className="w-6 h-6 cursor-pointer" />
            </Button>
          )}
        </SSHConnectionForm>
      )}
    </div>
  );
}

export default memo(SFTPTabClient);
