import React, { useState, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import { SFTPContext } from '@/pages/sftp/sftp-context';
import { FilePane } from '@/pages/sftp/components/FilePane';
import { SocketEventConstants } from '@/lib/sockets/event-constants';
import { SFTP_FILES_LIST } from '@/pages/sftp/components/interface';
import { useToast } from '@/hooks/use-toast';

interface SSHSftpViewerProps {
  socket: Socket;
  host: string;
}

/**
 * Lightweight SFTP viewer for the SSH terminal sidebar.
 * Wraps the shared FilePane with the SSH session's socket via SFTPContext.
 */
export default function SSHSftpViewer({ socket, host }: SSHSftpViewerProps) {
  const [currentDir, setCurrentDir] = useState('');
  const [homeDir, setHomeDir] = useState('');
  const [isError, setIsError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [remoteFiles, setRemoteFiles] = useState<Partial<SFTP_FILES_LIST[]>>([]);
  const { toast } = useToast();

  const handleSetCurrentDir = (path?: string) => {
    setLoading(true);
    const dirPath = path || homeDir || '';
    socket.emit(SocketEventConstants.SFTP_GET_FILE, { dirPath });
  };

  const handleSetLoading = (input: boolean) => {
    setLoading(input);
  };

  useEffect(() => {
    const onSftpReady = () => {
      socket.emit(SocketEventConstants.SFTP_GET_FILE, { dirPath: '' });
    };
    const onCurrentPath = (cwd: string) => {
      setCurrentDir(cwd);
      setHomeDir(cwd);
      setLoading(false);
    };
    const onGetFile = (data: SFTP_FILES_LIST[]) => {
      setRemoteFiles(data);
      setLoading(false);
    };
    const onFilesList = (data: any) => {
      setRemoteFiles(JSON.parse(data.files));
      setCurrentDir(data.currentDir);
      setHomeDir(data.workingDir);
      setLoading(false);
    };
    const onError = (data: string) => {
      setIsError(true);
      toast({ title: 'Error', description: data, variant: 'destructive' });
      setLoading(false);
    };

    socket.on(SocketEventConstants.SFTP_READY, onSftpReady);
    socket.on(SocketEventConstants.SFTP_CURRENT_PATH, onCurrentPath);
    socket.on(SocketEventConstants.SFTP_GET_FILE, onGetFile);
    socket.on(SocketEventConstants.SFTP_FILES_LIST, onFilesList);
    socket.on(SocketEventConstants.SFTP_EMIT_ERROR, onError);

    // Request initial listing
    socket.emit(SocketEventConstants.SFTP_GET_FILE, { dirPath: '' });

    return () => {
      socket.off(SocketEventConstants.SFTP_READY, onSftpReady);
      socket.off(SocketEventConstants.SFTP_CURRENT_PATH, onCurrentPath);
      socket.off(SocketEventConstants.SFTP_GET_FILE, onGetFile);
      socket.off(SocketEventConstants.SFTP_FILES_LIST, onFilesList);
      socket.off(SocketEventConstants.SFTP_EMIT_ERROR, onError);
    };
  }, [socket]);

  return (
    <SFTPContext.Provider value={{ socket, isConnected: true }}>
      <FilePane
        title={host}
        files={remoteFiles}
        path={currentDir}
        hasError={isError}
        handleSetCurrentDir={handleSetCurrentDir}
        handleSetLoading={handleSetLoading}
        loading={loading}
      />
    </SFTPContext.Provider>
  );
}
