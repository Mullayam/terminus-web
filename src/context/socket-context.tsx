"use client"
import { useToast } from "@/hooks/use-toast";
import { socket as appSocket } from "@/lib/sockets";
import { SocketEventConstants } from "@/lib/sockets/event-constants";
import { SocketListener } from "@/lib/sockets/listeners";

import React, { PropsWithChildren } from "react";
import { Socket } from "socket.io-client";
export const SocketContext = React.createContext<{
    socket: Socket,
    isSftpConnected: boolean,
    isConnected: boolean
}>({ socket: appSocket, isConnected: false, isSftpConnected: false });
const listeners = new SocketListener()
const SocketContextProvider = ({ children }: PropsWithChildren) => {
    const { toast } = useToast()
    const [isConnected, setIsConnected] = React.useState(appSocket.connected);

    const [isSftpConnected, setIsSftpConnected] = React.useState(false)

    React.useEffect(() => {
        appSocket.once("connect", () => {
            setIsConnected(true)
            toast({
                title: "Socket Connected",
                variant: "default"
            })
        })
        appSocket.on("disconnect", () => {
            setIsConnected(false)
        })
        appSocket.on(SocketEventConstants.SFTP_READY, () => {
            setIsSftpConnected(true)
        })
        appSocket.on("connection_error", () => setIsConnected(false));
        appSocket.connected && setIsConnected(true)
        listeners.socketAddListeners(appSocket);

        return () => {
            listeners.socketRemoveListeners(appSocket)
        }
    }, [isConnected,isSftpConnected])

    return (
        <SocketContext.Provider value={{ socket: appSocket, isConnected, isSftpConnected: isSftpConnected }}>
            {children}
        </SocketContext.Provider>
    )
}
export default SocketContextProvider