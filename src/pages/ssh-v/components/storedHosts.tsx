import { HostCard } from './HostCard'
import { v4 as uuid } from 'uuid'
import { useSSHStore } from '@/store/sshStore'

import { Button } from '@/components/ui/button'

const StoredHosts = ({ hosts, handleClickOnHostCard }: { hosts: any[], handleClickOnHostCard: (index: any) => void }) => {

    const { tabs, addTab, setActiveTab } = useSSHStore()

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
        <div className="p-8">
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

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {hosts.length > 0 && hosts.map((host, index) => (
                    <HostCard
                        key={index}
                        index={index}
                        info={host}
                        onClick={handleClickOnHostCard}
                    />
                ))}
            </div>
        </div>
    )
}

export default StoredHosts