import { Avatar } from '@/components/ui/avatar'
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Copy, Share2, } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useSockets } from '@/hooks/use-sockets';
import { SocketEventConstants } from '@/lib/sockets/event-constants';
import React, { useEffect } from 'react';
const TerminalShare = () => {
    const { socket } = useSockets()
    const [sharingUrl, setSharingUrl] = React.useState<string | null>(null)
    const handleCreateShareTerminalClick = () => {
        socket.emit(SocketEventConstants.CreateTerminal)
    }
    useEffect(() => {
        socket.on(SocketEventConstants.TerminalUrl, (data: string) => {
            setSharingUrl(data)
        })
        return () => {
            socket.off(SocketEventConstants.TerminalUrl)
        }
    }, [socket])
    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium">Terminal sharing</h2>
                {sharingUrl ? <Avatar className="h-6 w-6 bg-red-500 items-center justify-center">
                    <span className="text-xs">M</span>
                </Avatar> : (
                    <Button onClick={handleCreateShareTerminalClick} className="flex items-center gap-2"> <Share2 className="h-4 w-4" /></Button>
                )}
            </div>
            {
                sharingUrl && (
                    <>
                        <div className="space-y-2">
                            <label className="text-sm text-slate-400">Viewers permissions:</label>
                            <Select defaultValue="view">
                                <SelectTrigger className="w-full bg-slate-800 border-slate-700">
                                    <SelectValue placeholder="Select permission" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="view">view only</SelectItem>
                                    <SelectItem value="edit">can edit</SelectItem>
                                    <SelectItem value="admin">admin</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex items-center gap-2 bg-slate-800 rounded-md p-2">
                            <div className="space-y-2">
                                <div className="flex items-center gap-2 rounded bg-zinc-900 px-2 py-1.5 text-sm">
                                    <span className="truncate text-emerald-500">
                                        {sharingUrl}
                                    </span>
                                </div>
                            </div>
                            <Button variant="ghost" size="sm" className="h-6 px-2">
                                <Copy className="h-4 w-4"
                                    onClick={() => navigator.clipboard.writeText(sharingUrl)}
                                />
                            </Button>
                        </div>

                        {/* Autocomplete Setting */}
                        <div className="flex items-center justify-between">
                            <span className="text-sm">Autocomplete</span>
                            <Badge variant="outline" className="bg-slate-800 text-slate-300">
                                Disabled
                            </Badge>
                        </div></>
                )
            }

        </div>
    )
}

export default TerminalShare