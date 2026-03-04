import { HostCard } from './HostCard'
import { v4 as uuid } from 'uuid'
import { useSSHStore } from '@/store/sshStore'
import { useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'

const StoredHosts = ({ hosts, handleClickOnHostCard }: { hosts: any[], handleClickOnHostCard: (index: any) => void }) => {

    const { tabs, addTab, setActiveTab } = useSSHStore()
    const navigate = useNavigate()

    const handleNewConnectionClick = () => {
        const id = uuid()
        addTab({
            id,
            title: `Terminal ${tabs.length + 1}`,
            sessionId: id
        })
        setActiveTab(id)
    }

    return (
        <div className="p-8 pb-10 relative h-full">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-white text-xl font-semibold">Hosts</h2>
                <Button
                    variant={"ghost"}
                    onClick={handleNewConnectionClick} // Optional handler
                    className="text-sm text-blue-400 hover:underline"
                >
                    New Connection
                </Button>
            </div>

            {hosts.length > 0 ? (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {hosts.map((host, index) => (
                            <HostCard
                                key={index}
                                index={index}
                                info={host}
                                onClick={handleClickOnHostCard}
                            />
                        ))}
                    </div>
                    <p className="text-center text-gray-700 text-[11px] italic mt-6">Switch to SFTP via the bottom bar</p>
                </>
            ) : (
                <div className="flex flex-col items-center justify-center h-[70vh] gap-4">
                    <h2 className="text-2xl text-white">No Saved Hosts</h2>
                    <p className="text-gray-400">Create a new connection to get started.</p>
                    <Button
                        variant={"secondary"}
                        onClick={handleNewConnectionClick}
                        className="text-sm mt-2"
                    >
                        New Connection
                    </Button>
                    <p className="text-gray-700 text-[11px] italic mt-2">Switch to SFTP via the bottom bar</p>
                </div>
            )}

            {/* SSH / SFTP toggle — bottom bar */}
            <div className="absolute bottom-0 inset-x-0 flex justify-end items-center flex-wrap px-4 py-1 border-t text-xs shrink-0 border-gray-800 bg-[#0A0A0A]/90 text-gray-300 z-10">
                <div className="flex items-center gap-1">
                    <button
                        className="px-2 py-0.5 rounded text-[11px] font-medium transition-colors text-gray-200 bg-gray-700/50"
                    >
                        SSH
                    </button>
                    <button
                        onClick={() => navigate('/ssh/sftp')}
                        className="px-2 py-0.5 rounded text-[11px] font-medium transition-colors text-gray-400 hover:text-gray-100"
                    >
                        SFTP
                    </button>
                </div>
            </div>
        </div>
    )
}

export default StoredHosts