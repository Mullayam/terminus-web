import { SocketContext } from "@/context/socket-context"
import { useContext } from "react"

export const useSockets = () => useContext(SocketContext)