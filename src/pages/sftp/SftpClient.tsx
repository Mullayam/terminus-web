import { useSSHStore } from '@/store/sshStore'
import React, { useState } from 'react'
import { SFTP_FILES_LIST } from './components/interface'
import { useToast } from '@/hooks/use-toast'
import { FilePane } from './components/FilePane'
import { Socket } from 'socket.io-client'
import { socket } from '../../lib/sockets/index';
import { SocketEventConstants } from '@/lib/sockets/event-constants'
export const SFTPContext = React.createContext<{
    socket: Socket | undefined,
    handleSSHConnection?: (data?: boolean) => void,

    isConnected: boolean
}>({ socket: socket, isConnected: false, });
const SftpClient = () => {
    const { sessions, activeTabId } = useSSHStore()

    const session = activeTabId ? sessions[activeTabId] : undefined
    const socket = session?.socket || undefined

    const [currentDir, setCurrentDir] = useState("")


    const [homeDir, setHomeDir] = useState("")
    const [isError, setIsError] = useState(false)
    const [loading, setLoading] = useState(true);
    const { toast } = useToast()
    const [remoteFiles, setRemoteFiles] = useState<Partial<SFTP_FILES_LIST[]>>([])
    const handleSetCurrentDir = (path?: string) => {
        setLoading(true)

        if (!path) {
            socket && socket.emit(SocketEventConstants.SFTP_GET_FILE, { dirPath: homeDir })
            setLoading(false)
            return
        }
        socket && socket.emit(SocketEventConstants.SFTP_GET_FILE, { dirPath: path })
        setLoading(false)
    }
    const handleSetLoading = (input: boolean) => {
        setLoading(input)
    }
    React.useEffect(() => {
        const dir = localStorage.getItem(`sftp_current_dir_${activeTabId}`)
        if (activeTabId && dir) {
            setCurrentDir(dir)
        }
        if (socket) {

            socket.on(SocketEventConstants.SFTP_CURRENT_PATH, (cwd: string) => {

                setCurrentDir(cwd)
                setHomeDir(cwd)
                setLoading(false)
            })
            socket.on(SocketEventConstants.SFTP_GET_FILE, (data: SFTP_FILES_LIST[]) => {
                setRemoteFiles(data)
                setLoading(false)
            })
            socket.on(SocketEventConstants.SFTP_FILES_LIST, (data: any) => {
                setRemoteFiles(JSON.parse(data.files))
                setCurrentDir(data.currentDir)
                setHomeDir(data.workingDir)
                setLoading(false)
            })
            socket.on(SocketEventConstants.SFTP_EMIT_ERROR, (data: string) => {
                setIsError(true)
                toast({
                    title: 'Error',
                    description: data,
                    variant: 'destructive'
                })
                setLoading(false)
            })

            // Request initial file listing
            socket.emit(SocketEventConstants.SFTP_GET_FILE, { dirPath: '' })
        }
        return () => {
            if (socket) {

                socket.off(SocketEventConstants.SFTP_CURRENT_PATH)
                socket.off(SocketEventConstants.SFTP_GET_FILE)
                socket.off(SocketEventConstants.SFTP_FILES_LIST)
                socket.off(SocketEventConstants.SFTP_EMIT_ERROR)

            }
        }
    }, [socket])

    return (
        <SFTPContext.Provider value={{ socket, isConnected: true }}>
            <FilePane
                title={session?.host || "SFTP Host"}
                files={remoteFiles}
                path={currentDir}
                hasError={isError}
                handleSetCurrentDir={handleSetCurrentDir}
                handleSetLoading={handleSetLoading}
                loading={loading}
            />
        </SFTPContext.Provider>
    )
}
export const useSFTPContext = () => React.useContext(SFTPContext)
export default SftpClient