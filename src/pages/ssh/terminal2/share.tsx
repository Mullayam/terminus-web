import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Copy, Share2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useSockets } from "@/hooks/use-sockets";
import { SocketEventConstants } from "@/lib/sockets/event-constants";
import React, { useEffect } from "react";
const TerminalShare = () => {
    const { socket } = useSockets();
    const [permissions, setPermissions] = React.useState({
        read: false,
        write: false,
    });
    const [session, setSession] = React.useState<{
        uid: string;    
        sessionId: string
    } | null>(null);
    
    const handleCreateShareTerminalClick = () =>
        socket.emit(SocketEventConstants.CreateTerminal, {
            config: {
                password: "Mullayam",
                host: "127.0.0.1",
                username: "mullayam",
            },
            permissions,
        });
    useEffect(() => {
        socket.emit(SocketEventConstants.SSH_PERMISSIONS, {
            ...session,
            permissions
        });
        socket.on(SocketEventConstants.TerminalUrl, (data: {uid: string, sessionId:string}) => {
            setSession(data)
        });

        return () => {
            socket.off(SocketEventConstants.TerminalUrl);
        };
    }, [socket, permissions]);
    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium">Terminal sharing</h2>
                {session ? (
                    <Avatar className="h-6 w-6 bg-red-500 items-center justify-center">
                        <span className="text-xs">M</span>
                    </Avatar>
                ) : (
                    <Button
                        onClick={handleCreateShareTerminalClick}
                        className="flex items-center gap-2"
                    >
                        {" "}
                        <Share2 className="h-4 w-4" />
                    </Button>
                )}
            </div>
            {session && (
                <>
                    <div className="space-y-2">
                        <label className="text-sm text-slate-400">
                            Viewers permissions:
                        </label>
                        <Select
                            defaultValue="view"
                            onValueChange={(value) => {
                                if (value === "read") {
                                    setPermissions({ ...permissions, read: true, write: false });
                                    return;
                                }
                                setPermissions({ ...permissions, read: true, write: true });
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
                    <div className="flex items-center gap-2 bg-slate-800 rounded-md p-2">
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 rounded bg-zinc-900 px-2 py-1.5 text-sm max-w-full">
                                <input
                                    className="truncate text-emerald-500 overflow-x-auto"
                                    value={`${window.location.origin}/ssh/terminal/${session.sessionId}`}
                                    readOnly
                                />
                            </div>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2"
                            onClick={() => navigator.clipboard.writeText(`${window.location.origin}/ssh/terminal/${session.sessionId}`)}
                        >
                            <Copy className="h-4 w-4" />
                        </Button>
                    </div>

                    {/* Autocomplete Setting */}
                    <div className="flex items-center justify-between">
                        <span className="text-sm">Autocomplete</span>
                        <Badge variant="outline" className="bg-slate-800 text-slate-300">
                            Disabled
                        </Badge>
                    </div>
                </>
            )}
        </div>
    );
};

export default TerminalShare;
