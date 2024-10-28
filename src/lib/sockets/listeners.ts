import { Socket } from "socket.io-client";

export class SocketListener{
    socketAddListeners(appSocket:Socket){

    } 
    socketRemoveListeners(appSocket:Socket){
        appSocket.off('connect')
        appSocket.off('disconnecting')
        appSocket.off('disconnect')
        // appSocket.disconnect()
    }
    
}