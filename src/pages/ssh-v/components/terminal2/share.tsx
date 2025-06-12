import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { } from "lucide-react";
import { Share, Users, Plus, Play, Pause, Square, Clock, Globe, Copy, Share2, Check } from 'lucide-react';

import { Badge } from "@/components/ui/badge";
import { SocketEventConstants } from "@/lib/sockets/event-constants";
import { useEffect, useState } from "react";
import { useSSHStore } from "@/store/sshStore";
import { useTerminalStore } from '@/store/terminalStore';
import { toast } from "@/hooks/use-toast";
const TerminalShare = () => {
    const { sessions, activeTabId } = useSSHStore()
    const { sessionInfo, addSharedSession } = useTerminalStore()
    const [isCopied, setIsCopied] = useState(false)

    const socket = sessions[activeTabId!].socket
    const handleCreateShareTerminalClick = () => {
        socket?.emit(SocketEventConstants.CreateTerminal, activeTabId);

    }
    const handleCreateSession = (e: React.FormEvent) => {
        e.preventDefault();

    };

    const handleCopySessionLink = (sessionId: string) => {
        const link = `${window.location.origin}/ssh/terminal/${activeTabId}`;
        navigator.clipboard.writeText(link);
        setIsCopied(true);
        const timer = setTimeout(() => {
            setIsCopied(false);
        }, 2000);
        return () => clearTimeout(timer);

    };

    const getStatusColor = (status: 'active' | 'paused' | 'ended') => {
        switch (status) {
            case 'active': return 'text-green-600 bg-green-100';
            case 'paused': return 'text-yellow-600 bg-yellow-100';
            case 'ended': return 'text-gray-600 bg-gray-100';
            default: return 'text-gray-600 bg-gray-100';
        }
    };

    const getStatusIcon = (status: 'active' | 'paused' | 'ended') => {
        switch (status) {
            case 'active': return Play;
            case 'paused': return Pause;
            case 'ended': return Square;
            default: return Square;
        }
    };

    const formatTimeAgo = (date: Date) => {
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const minutes = Math.floor(diff / (1000 * 60));
        const hours = Math.floor(diff / (1000 * 60 * 60));

        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        return `${Math.floor(hours / 24)}d ago`;
    };

    useEffect(() => {
        socket?.on(SocketEventConstants.join_terminal, () => {
            addSharedSession(activeTabId!)
            toast({
                title: "Terminal shared",
                description: "Terminal shared successfully",
            })
        })
        return () => {
            socket?.off(SocketEventConstants.join_terminal);
        }
    }, [socket])
    return (
        <div className="p-4">

            <div className="flex flex-col w-full">
                {sessionInfo?.shared_sessions?.includes(activeTabId!) ? (
                    <div className="flex flex-col">
                        <h3 className="text-lg font-semibold text-gray-300">Terminal Sharing sessions </h3>

                        {sessionInfo?.shared_sessions.map((session) => {
                            return (
                                <div
                                    key={session}
                                    className="bg-transparent rounded-lg p-4 border border-gray-200 hover:border-blue-300 transition-colors"
                                >

                                    <div className="space-y-2">
                                        <div className="flex items-center space-x-1 text-gray-600">
                                            <Users size={12} />
                                            {/* <span>{session} participant{session.participants !== 1 ? 's' : ''}</span> */}
                                        </div>

                                        <div className="bg-transparent rounded p-2">
                                            <div className="flex items-center justify-between">
                                                <code className="text-xs text-gray-600 font-mono truncate flex-1 mr-2">
                                                    {session}
                                                </code>
                                                <button
                                                    onClick={() => handleCopySessionLink(session)}
                                                    className={`p-1 rounded transition-colors ${isCopied
                                                        ? 'bg-green-100 text-green-600'
                                                        : 'bg-gray-200 hover:bg-gray-300 text-gray-600'
                                                        }`}
                                                >
                                                    {isCopied ? <Check size={12} /> : <Copy size={12} />}
                                                </button>
                                            </div>
                                        </div>

                                        <div className="flex space-x-2 pt-1">
                                            {/* {session.status === 'active' && ( */}
                                            <button className="flex-1 bg-yellow-100 hover:bg-yellow-200 text-yellow-700 py-1 px-2 rounded text-xs font-medium transition-colors">
                                                Pause
                                            </button>
                                            {/* )} */}
                                            {/* {session.status === 'paused' && ( */}
                                            <button className="flex-1 bg-green-100 hover:bg-green-200 text-green-700 py-1 px-2 rounded text-xs font-medium transition-colors">
                                                Resume
                                            </button>
                                            {/* )} */}
                                            <button className="flex-1 bg-red-100 hover:bg-red-200 text-red-700 py-1 px-2 rounded text-xs font-medium transition-colors">
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


            {sessionInfo?.shared_sessions?.includes(activeTabId!) && (
                <div className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm text-slate-400">
                            Viewers permissions:
                        </label>
                        <Select
                            disabled
                            defaultValue="view"
                            onValueChange={(value) => {

                            }}
                        >
                            <SelectTrigger
                                className="w-full bg-slate-800 text-gray-200 border-slate-700"
                                defaultValue={"read"}
                            >
                                <SelectValue placeholder="Select permission" />
                            </SelectTrigger>
                            <SelectContent defaultValue={"read"}>
                                <SelectItem value="read">view only</SelectItem>
                                <SelectItem value="write">can edit</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
 
                </div>
            )}
        </div>
    );
};

export default TerminalShare;
