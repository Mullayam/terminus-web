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
    const socket = sessions[activeTabId!].socket || undefined

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
        if (socket) {
            socket.on(SocketEventConstants.SFTP_READY, (cwd: string) => {
                console.log("Ready")

            })
            socket.on(SocketEventConstants.SFTP_CURRENT_PATH, (cwd: string) => {

                setCurrentDir(cwd)
                setHomeDir(cwd)
                setLoading(false)
            })
            socket.on(SocketEventConstants.SFTP_GET_FILE, (data: SFTP_FILES_LIST[]) => {
                setRemoteFiles(data)
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
        }
        return () => {
            if (socket) {
                socket.off(SocketEventConstants.SFTP_READY)
                socket.off(SocketEventConstants.SFTP_CURRENT_PATH)
                socket.off(SocketEventConstants.SFTP_GET_FILE)
                socket.off(SocketEventConstants.SFTP_EMIT_ERROR)
            }
        }
    }, [socket])

    return (
        <SFTPContext.Provider value={{ socket, isConnected: true }}>
            <FilePane
                title={activeTabId ? sessions[activeTabId].host : "SFTP Host"}
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