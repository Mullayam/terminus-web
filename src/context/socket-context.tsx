"use client"
import { useToast } from "@/hooks/use-toast";
import { socket as appSocket } from "@/lib/sockets";
import { SocketListener } from "@/lib/sockets/listeners";

import React, { PropsWithChildren } from "react";
import { Socket } from "socket.io-client";
export const SocketContext = React.createContext<{
    socket: Socket,
    isConnected: boolean
}>({ socket: appSocket, isConnected: false });
const listeners = new SocketListener()
const SocketContextProvider = ({ children }: PropsWithChildren) => {
    const { toast } = useToast()
    const [isConnected, setIsConnected] = React.useState(appSocket.connected);

    React.useEffect(() => {
        // Connect the global socket lazily — only when this provider mounts
        if (!appSocket.connected) {
            appSocket.connect();
        }

        const onConnect = () => {
            setIsConnected(true)
            toast({
                title: "Socket Connected",
                variant: "default"
            })
        };
        const onDisconnect = () => setIsConnected(false);
        const onConnectError = () => setIsConnected(false);

        appSocket.once("connect", onConnect);
        appSocket.on("disconnect", onDisconnect);
        appSocket.on("connection_error", onConnectError);

        if (appSocket.connected) setIsConnected(true);
        listeners.socketAddListeners(appSocket);

        return () => {
            appSocket.off("connect", onConnect);
            appSocket.off("disconnect", onDisconnect);
            appSocket.off("connection_error", onConnectError);
            listeners.socketRemoveListeners(appSocket);
        }
    }, []) // Run once on mount — no state deps needed

    return (
        <SocketContext.Provider value={{ socket: appSocket, isConnected }}>
            {children}
        </SocketContext.Provider>
    )
}
export default SocketContextProvider