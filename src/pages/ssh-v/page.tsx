import React, { useEffect, useState } from 'react';
import TerminalTab from './TerminalTab';
import { useSSHStore } from '@/store/sshStore';
import { getAllData } from '@/lib/idb';
import { HostCard } from './components/HostCard';

import { v4 as uuid } from 'uuid'
import { useStore } from '@/store';
import { Button } from '@/components/ui/button';
import { useCustomEvent } from '@/hooks/use-events';
import { HostsObject } from '..';
export default function NewSSH() {
    const store = useStore()

    const { tabs, activeTabId, addSession, addTab, setActiveTab } = useSSHStore()
    const [hosts, setHosts] = useState<HostsObject[]>([])
    const { listen: listenNewConnectionClick } = useCustomEvent("NEW_SSH_CLIENT")

    const handleClickOnHostCard = async (index: any) => {
        let data = hosts[index]
        if (!data) {
            await getAllData<any>().then(data => {
                data = data[index]
            })

        }

        const id = uuid()


        const generateUniqueTitle = (baseHost: string) => {
            const existingTitles = tabs.map(tab => tab.title)

            if (!existingTitles.includes(baseHost)) {
                return baseHost
            }

            let maxNumber = 0
            const regex = new RegExp(`^${baseHost.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\((\\d+)\\)$`)

            existingTitles.forEach(title => {
                if (title === baseHost) {
                    maxNumber = Math.max(maxNumber, 0)
                } else {
                    const match = title.match(regex)
                    if (match) {
                        maxNumber = Math.max(maxNumber, parseInt(match[1]))
                    }
                }
            })

            return `${baseHost}(${maxNumber + 1})`
        }

        const uniqueTitle = generateUniqueTitle(data.host)
        addSession({
            sessionId: id,
            host: data.host,
            username: data.username,
            status: 'connecting'
        })

        addTab({
            id,
            title: uniqueTitle,
            sessionId: id
        })

        store.setActiveTabData(data);
    }
    const handleNewConnectionClick = () => {
        const id = uuid()
        addTab({
            id,
            title: `Terminal ${tabs.length + 1}`,
            sessionId: id
        })
        setActiveTab(id)
    }
    useEffect(() => {
        getAllData<any>().then(data => setHosts(data))
        const unsubscribe = listenNewConnectionClick(handleClickOnHostCard)
        return unsubscribe
    }, [hosts])

    return (
        <div className='w-full'>
            {tabs.length === 0 && (
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

            )}
            {tabs.map((tab) => (
                tab.id === activeTabId ? <TerminalTab key={tab.id} sessionId={tab.sessionId} /> : null
            ))}
        </div>
    );
}
