/* eslint-disable @typescript-eslint/no-explicit-any */
import { socket } from ".";

export class SocketEmitters{
    static emit(event: string, data: any) {
        socket.emit(event, data)
    }
}