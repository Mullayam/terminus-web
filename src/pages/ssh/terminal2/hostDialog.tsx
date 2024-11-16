/* eslint-disable @typescript-eslint/no-explicit-any */

import * as React from "react"
import { Plus, Search, Server,  } from "lucide-react"


import { getAllData } from "@/lib/idb"
import { SocketEventConstants } from "@/lib/sockets/event-constants"
import { socket } from "@/lib/sockets"
import { Dialog, DialogContent } from "@/components/ui/dialog"
interface HostsList {
    id: string;
    host: string;
    username: string;
    authMethod: string;
    password: string;
    privateKeyText: string;
    saveCredentials: boolean;
    localName: string;
}
export function HostDialog({ open, setOpen }: { open: boolean, setOpen: React.Dispatch<React.SetStateAction<boolean>> }) {
    const [hosts, setHosts] = React.useState<HostsList[]>([])

    const [searchQuery, setSearchQuery] = React.useState('');
    React.useEffect(() => {
        getAllData().then((data: any[]) => {
            setHosts(data)
        })
        const down = (e: KeyboardEvent) => {
            if (e.key === "j" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                setOpen((open) => !open)
            }
        }

        document.addEventListener("keydown", down)
        return () => document.removeEventListener("keydown", down)
    }, [setOpen])
    const connectSSH = (index: number) => {

        const sshConfig = {
            host: hosts[index].host,
            username: hosts[index].username,
            authMethod: hosts[index].authMethod,
            password: hosts[index].password,
            privateKeyText: hosts[index].privateKeyText
        }
        socket.emit(SocketEventConstants.SSH_CONNECT, sshConfig);
        setOpen(false)

    }
    return (
        <>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="overflow-hidden p-4 shadow-lg bg-[#1e2030]">
                    <h2 className="text-sm font-medium mb-2 text-gray-300">Hosts</h2>
                    <div className="space-y-4">
                        {/* Search Bar */}
                        <div className="flex items-center bg-[#2a2f42] rounded-lg">
                            <Search className="w-5 h-5 ml-3 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search hosts or ssh user@address"
                                className="w-full py-2 px-3 bg-transparent outline-none text-gray-300"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                            <div className="px-3 py-1 border-l border-gray-700">
                                <div className="flex items-center gap-2 text-sm text-gray-400">
                                    <Plus className="w-4 h-4" />
                                </div>
                            </div>
                        </div>
                        {/* Hosts List */}
                        <div>
                            <h2 className="text-sm font-medium mb-2 text-gray-300">{hosts.length > 0 ? "Quick Connect" : 'You have no hosts'} </h2>
                            <div className="space-y-1">                                 
                                {hosts.map((host: any, index: number) => (
                                    <div
                                        key={host.id}
                                        onClick={() => connectSSH(index)}
                                        className="flex items-center gap-3 p-2 hover:bg-[#2a2f42] rounded-lg cursor-pointer transition-colors"
                                    >
                                        <div className={`w-2 h-2 rounded-full ${host.color}`} /> <Server />
                                        <span>{host.localName || host.host}</span>
                                    </div>

                                ))}
                            </div>
                        </div>

                    </div>

                </DialogContent>
            </Dialog>

        </>
    )
}
