"use client"
import { useToast } from "@/hooks/use-toast";
import { socket as appSocket } from "@/lib/sockets";
import { SocketListener } from "@/lib/sockets/listeners";
import React, { PropsWithChildren } from "react";
import { Socket } from "socket.io-client";
export const SocketContext = React.createContext<{
    socket: Socket, handleSSHConnection?: () => void,
    isSSH_Connected: boolean,
    isConnected: boolean
}>({ socket: appSocket, isConnected: false, isSSH_Connected: false });
const listeners = new SocketListener()
const SocketContextProvider = ({ children }: PropsWithChildren) => {
    const { toast } = useToast()
    const [isConnected, setIsConnected] = React.useState(appSocket.connected);
    const [isSSH_Connected, setIsSSH_Connected] = React.useState(false)
    const handleSSHConnection = () => {
        setIsSSH_Connected(true)
    }
    React.useEffect(() => {
        appSocket.once("connect", () =>  {
            setIsConnected(true)
            toast({
                title: "Socket Connected",
                variant: "default"
            })
        })
        appSocket.on("disconnect", () => {
            setIsConnected(false)         
        })       
        appSocket.on("connection_error", () => setIsConnected(false));
        appSocket.connected && setIsConnected(true)
        listeners.socketAddListeners(appSocket);
       
        return () =>{
            listeners.socketRemoveListeners(appSocket)
        }
    }, [isConnected, toast,])

    return (
        <SocketContext.Provider value={{ socket: appSocket, isConnected, isSSH_Connected, handleSSHConnection }}>
            {children}
        </SocketContext.Provider>
    )
}
export default SocketContextProvider