
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { } from "lucide-react";
import { Users, Play, Pause, Square, Globe, Copy, Check } from 'lucide-react';


import { SocketEventConstants } from "@/lib/sockets/event-constants";
import { useEffect, useState } from "react";
import { useSSHStore } from "@/store/sshStore";
import { useTerminalStore } from '@/store/terminalStore';
import { toast } from "@/hooks/use-toast";
type SocketPermission = '400' | '700' | '777';

const TerminalShare = () => {
    const { sessions, activeTabId } = useSSHStore()
    const { sessionInfo, addPermissions } = useTerminalStore()
    const [isCopied, setIsCopied] = useState(false)
    const [selectedSocketId, setSelectedSocketId] = useState<string | null>(null)
    const info = sessionInfo?.shared_sessions[activeTabId!]
    const socket = sessions[activeTabId!].socket
    const handleCreateShareTerminalClick = () => {
        handleCopySessionLink();
        toast({
            title: "Shared Terminal URL Copied",
            description: "Paste URL in browser tab",
        })
    }
    const updateSessionSettings = (socketId: string, type: "pause" | "kick") => {
        const data = {
            socketId,
            sessionId: activeTabId!,
            type
        }
        socket?.emit(SocketEventConstants.SSH_SESSION, JSON.stringify(data))
    }
    const handleCopySessionLink = () => {
        const link = `${window.location.origin}/ssh/terminal/${activeTabId}`;
        navigator.clipboard.writeText(link);
        setIsCopied(true);
        const timer = setTimeout(() => {
            setIsCopied(false);
        }, 2000);
        return () => clearTimeout(timer);

    };
    const updateSessionPermission = (socketId: string, permissions: SocketPermission) => {

        const data = {
            socketId,
            permissions,
            sessionId: activeTabId!
        };
        socket?.emit(SocketEventConstants.SSH_PERMISSIONS, JSON.stringify(data))
    }


    useEffect(() => {
        socket?.on(SocketEventConstants.SSH_PERMISSIONS, (input: string) => {
            const data = JSON.parse(input) as {
                socketId: string,
                permissions: SocketPermission,
                sessionId: string
            };
            addPermissions(activeTabId!, data.socketId, data.permissions)
            toast({ title: "Permissions updated successfully" })
        })



        return () => {

            socket?.off(SocketEventConstants.SSH_PERMISSIONS);
        }
    }, [socket, activeTabId])
    return (
        <div className="p-4">
            <div className="flex flex-col w-full">
                {info?.socketIds.length > 0 ? (
                    <div className="flex flex-col">
                        <h3 className="text-lg font-semibold text-gray-300">Terminal Sharing sessions
                            {info?.socketIds.length > 0 ? info?.socketIds.length : 0}
                        </h3>

                        {info?.socketIds.map((session) => {
                            return (
                                <div
                                    onClick={() => setSelectedSocketId(session)}
                                    key={session}
                                    className="bg-transparent rounded-lg p-4 border border-gray-200 hover:border-blue-300 transition-colors"
                                >

                                    <div className="bg-transparent rounded p-2">
                                        <div className="flex items-center justify-between">
                                            <code className="text-xs text-gray-600 font-mono truncate flex-1 mr-2">
                                                {session}
                                            </code>
                                            <button
                                                onClick={handleCopySessionLink}
                                                className={`p-1 rounded transition-colors ${isCopied
                                                    ? 'bg-green-100 text-green-600'
                                                    : 'bg-gray-200 hover:bg-gray-300 text-gray-600'
                                                    }`}
                                            >
                                                {isCopied ? <Check size={12} /> : <Copy size={12} />}
                                            </button>
                                        </div>

                                        <div className="flex space-x-2 pt-1">

                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    updateSessionSettings(session, "pause")
                                                }}
                                                className="flex-1 bg-yellow-100 hover:bg-yellow-200 text-yellow-700 py-1 px-2 rounded text-xs font-medium transition-colors">
                                                Pause
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    updateSessionSettings(session, "kick")
                                                }}
                                                className="flex-1 bg-red-100 hover:bg-red-200 text-red-700 py-1 px-2 rounded text-xs font-medium transition-colors">
                                                End
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )
                        }
                        )}
                    </div>

                ) : (
                    <>
                        <div className="text-center py-8   w-full rounded-none border border-gray-200">
                            <Globe size={32} className="mx-auto text-gray-300 mb-2" />
                            <h4 className="text-sm font-medium text-gray-300 mb-1">No sessions</h4>
                            <p className="text-xs text-gray-500 mb-3">Create your first session</p>
                            <Button
                                variant={"outline"}
                                onClick={handleCreateShareTerminalClick}

                                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                            >
                                Create Session
                            </Button>
                        </div>

                    </>

                )}
            </div>
            {selectedSocketId && (
                <div className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm text-slate-400">
                            Viewers permissions:
                        </label>
                        <Select
                            defaultValue="view"
                            onValueChange={(value) => updateSessionPermission(selectedSocketId, value as any)}
                        >
                            <SelectTrigger
                                className="w-full bg-slate-800 text-gray-200 border-slate-700"
                                defaultValue={"400"}
                            >
                                <SelectValue placeholder="Select permission" />
                            </SelectTrigger>
                            <SelectContent defaultValue={"400"}>
                                <SelectItem value="400">can view</SelectItem>
                                <SelectItem value="777">can edit</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                </div>
            )}
        </div>
    );
};

export default TerminalShare;
