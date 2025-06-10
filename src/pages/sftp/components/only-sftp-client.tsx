/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { memo, useEffect, useId, useState } from "react"
import { FilePane } from "./FilePane"
import { useSockets } from "@/hooks/use-sockets"
import { SocketEventConstants } from "@/lib/sockets/event-constants"
import { useToast } from '@/hooks/use-toast';
import { SFTP_FILES_LIST } from "./interface";
import { useSSHStore } from "@/store/sshStore";
import SSHConnectionForm from "@/pages/ssh-v/components/ssh-connection-form";
import { useForm } from "react-hook-form";
import { DEFAULT_FORM_VALUES, formSchema, FormValues } from "@/pages/ssh-v/TerminalTab";
import { zodResolver } from "@hookform/resolvers/zod";
import { addData, getDataById, updateData } from "@/lib/idb";
import { Progress } from "@/components/ui/progress";


function OnlySFTPClient() {
  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: DEFAULT_FORM_VALUES,
  })
  const [currentDir, setCurrentDir] = useState("")
  const [homeDir, setHomeDir] = useState("")
  const [isError, setIsError] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState<Record<string, any>>({})
  //  const{setLoading} =  useLoadingState()

  const [remoteFiles, setRemoteFiles] = useState<Partial<SFTP_FILES_LIST[]>>([])
  const { socket, isSftpConnected, isConnected } = useSockets()
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
  const handleSubmit = async (data: FormValues) => {
    if (data.saveCredentials) {
      if (!await getDataById(data.host)) {
        addData(data.host, data);
      }
      else {
        updateData(data, data.host);
      }
    }

    setLoading(true);
    socket?.emit(SocketEventConstants.SFTP_CONNECT, JSON.stringify(data));
  }
  useEffect(() => {
    socket.on(SocketEventConstants.SFTP_CURRENT_PATH, (cwd: string) => {

      setCurrentDir(cwd)
      setHomeDir(cwd)
      setLoading(false)
    })
    socket.on(SocketEventConstants.FILE_UPLOADED, (data: string) => {
      toast({
        title: 'File Uploaded',
        description: 'File uploaded successfully at ' + data,
        variant: 'default',
      })
      socket.emit(SocketEventConstants.SFTP_GET_FILE, { dirPath: currentDir })
    })

    socket.on(SocketEventConstants.SFTP_FILES_LIST, (data: any) => {
      setRemoteFiles(JSON.parse(data.files))
      setCurrentDir(data.currentDir)
      setHomeDir(data.workingDir)

    })
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
        description: data,
        variant: 'default',
      })
    });
    socket.on(SocketEventConstants.DOWNLOAD_PROGRESS, (data: {
      name: string,
      percent: number,
      totalSize: number
    }) => {
      setDownloadProgress(prev => {
        if (data.percent >= 100) {
          const { [data.name]: _, ...rest } = prev;
          return rest;
        } else {
          return {
            ...prev,
            [data.name]: data
          };
        }
      });
    });

    return () => {
      socket.off(SocketEventConstants.SFTP_FILES_LIST)
      socket.off(SocketEventConstants.ERROR)
      socket.off(SocketEventConstants.SUCCESS)
      socket.off(SocketEventConstants.FILE_UPLOADED)
    }
  }, [socket, isSftpConnected, toast])


  return (
    isConnected && isSftpConnected ?
      <>
        <FilePane
          title={"Host"}
          files={remoteFiles}
          path={currentDir}
          hasError={isError}
          handleSetCurrentDir={handleSetCurrentDir}
          handleSetLoading={handleSetLoading}
          loading={loading}
        />




        {Object.keys(downloadProgress).length > 0 && (
          <div className="p-2 bg-gray-900 text-sm space-y-2">
            {Object.entries(downloadProgress).map(([key, file]) => (
              <div key={key} className="fixed bottom-4 right-4 w-72 bg-gray-900 shadow-lg rounded-lg p-4 z-50">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-800">{file.name}</span>
                  <span className="text-xs text-gray-500">{file.percent}</span>
                </div>
                <Progress value={parseInt(file.percent)} className="h-1.5 w-full" />
              </div>

            ))}
          </div>
        )}

      </>
      :
      <SSHConnectionForm<typeof form>
        isLoading={!loading}
        form={form}
        handleSubmit={handleSubmit}
      />

  )
}
export default memo(OnlySFTPClient)