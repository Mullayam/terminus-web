/* eslint-disable @typescript-eslint/no-explicit-any */

import * as React from "react"
import { Plus, Search, Server, } from "lucide-react"
import { v4 as uuidv4 } from 'uuid';


import { getAllData } from "@/lib/idb"
import { SocketEventConstants } from "@/lib/sockets/event-constants"
import { socket } from "@/lib/sockets"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { useStore } from "@/store";
import { useSSHStore } from "@/store/sshStore";
import { useCustomEvent } from "@/hooks/use-events";
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
    const { addTab, tabs } = useSSHStore()
    const { emit } = useCustomEvent("NEW_SSH_CLIENT")

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

    const addNewTab = () => {
        const id = uuidv4();
        addTab({
            id,
            title: `Terminal ${tabs.length + 1}`,
            sessionId: id,
        });
        setOpen(false)
    };
    const filteredHosts = hosts.filter((host) => {
        return (
            host.host.toLowerCase().includes(searchQuery.toLowerCase()) ||
            host.localName.toLowerCase().includes(searchQuery.toLowerCase())
        )
    })
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
                            <div className="px-3 py-1 border-l border-gray-700" onClick={addNewTab}>
                                <div className="flex items-center gap-2 text-sm text-gray-400" >
                                    <Plus className="w-4 h-4" />
                                </div>
                            </div>
                        </div>
                        {/* Hosts List */}
                        <div>
                            <h2 className="text-sm font-medium mb-2 text-gray-300">{hosts.length > 0 ? "Quick Connect" : 'You have no hosts'} </h2>
                            <div className="space-y-1">
                                {filteredHosts.map((host: any, index: number) => (
                                    <div
                                        key={host.id}
                                        onClick={() => {
                                            emit(index)
                                            setOpen(false)
                                        }}
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
