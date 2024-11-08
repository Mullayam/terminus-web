/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { memo, useEffect, useState } from "react"
import { FilePane } from "./FilePane"
import { useSockets } from "@/hooks/use-sockets"
import { SocketEventConstants } from "@/lib/sockets/event-constants"
import { useToast } from '@/hooks/use-toast';
import { SFTP_FILES_LIST } from "./interface";


function SFTPClient() {
  const [currentDir, setCurrentDir] = useState("")
  const [homeDir, setHomeDir] = useState("")
  const [remoteFiles, setRemoteFiles] = useState<Partial<SFTP_FILES_LIST[]>>([])
  const { socket, isSSH_Connected } = useSockets()
  const [loading, setLoading] = useState(true);
  const { toast } = useToast()
  const handleSetCurrentDir = (path?: string) => {
    setLoading(true)
    if (!path) {
      socket.emit(SocketEventConstants.SFTP_GET_FILE, { dirPath: homeDir })
      setLoading(false)
      return
    }
    socket.emit(SocketEventConstants.SFTP_GET_FILE, { dirPath: path })
    setLoading(false)
  }
  const handleSetLoading = (input: boolean) => {
    setLoading(input)
  }

  useEffect(() => {
    if (isSSH_Connected) {
      socket.on(SocketEventConstants.FILE_UPLOADED, (data: string) => {
        toast({
          title: 'File Uploaded',
          description: 'File uploaded successfully at ' + data,
          variant: 'default',
        })
      })
      socket.emit(SocketEventConstants.SFTP_GET_FILE)
      socket.on(SocketEventConstants.SFTP_FILES_LIST, (data: any) => {    
        setRemoteFiles(data.files)
        setCurrentDir(data.currentDir)
        setHomeDir(data.workingDir)
      })
    }
    socket.on(SocketEventConstants.ERROR, (data: string) => {
      toast({
        title: 'SFTP Error',
        description: data,
        variant: 'destructive',
      })
    });
    return () => {
      socket.off(SocketEventConstants.SFTP_FILES_LIST)
      socket.off(SocketEventConstants.ERROR)
      socket.off(SocketEventConstants.FILE_UPLOADED)
    }
  }, [socket, isSSH_Connected, toast])
  return (
    <FilePane
      title="WSL"
      files={remoteFiles}
      path={currentDir}
      handleSetCurrentDir={handleSetCurrentDir}
      handleSetLoading={handleSetLoading}
      loading={loading}
    />
  )
}
export default memo(SFTPClient)