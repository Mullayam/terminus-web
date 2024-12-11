/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { memo, useEffect, useId, useState } from "react"
import { FilePane } from "./FilePane"
import { useSockets } from "@/hooks/use-sockets"
import { SocketEventConstants } from "@/lib/sockets/event-constants"
import { useToast } from '@/hooks/use-toast';
import { SFTP_FILES_LIST } from "./interface";


function SFTPClient() {
 
  const [currentDir, setCurrentDir] = useState("")
  const [homeDir, setHomeDir] = useState("")
  const [isError, setIsError] = useState(false)
  //  const{setLoading} =  useLoadingState()

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
        socket.emit(SocketEventConstants.SFTP_GET_FILE, { dirPath: currentDir })

      })
      socket.emit(SocketEventConstants.SFTP_GET_FILE)

      socket.on(SocketEventConstants.SFTP_FILES_LIST, (data: any) => {
        setRemoteFiles(JSON.parse(data.files))
        setCurrentDir(data.currentDir)
        setHomeDir(data.workingDir)

      })
    }
    socket.on(SocketEventConstants.ERROR, (data: string) => {
      setIsError(true)
      toast({
        title: 'SFTP Error',
        description: data,
        variant: 'destructive',
      })
    });
    socket.on(SocketEventConstants.SUCCESS, (data: string) => {
      setIsError(true)
      toast({
        title: data,
        description: data,
        variant: 'default',
      })
    });

    return () => {
      socket.off(SocketEventConstants.SFTP_FILES_LIST)
      socket.off(SocketEventConstants.ERROR)
      socket.off(SocketEventConstants.SUCCESS)
      socket.off(SocketEventConstants.FILE_UPLOADED)
    }
  }, [socket, isSSH_Connected, toast])
  return (
    <FilePane
      title="WSL"
      files={remoteFiles}
      path={currentDir}
      hasError={isError}
      handleSetCurrentDir={handleSetCurrentDir}
      handleSetLoading={handleSetLoading}
      loading={loading}
    />
  )
}
export default memo(SFTPClient)