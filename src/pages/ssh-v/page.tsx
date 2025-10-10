
import TerminalTab from './TerminalTab';
import { useSSHStore } from '@/store/sshStore';
import { v4 as uuid } from 'uuid'

import StoredHosts from './components/storedHosts';
import { useCustomEvent } from '@/hooks/use-events';
import { HostsObject } from '..';
import { useEffect, useState } from 'react';
import { idb } from '@/lib/idb';
import { useStore } from '@/store';

export default function NewSSH() {
    const { tabs, activeTabId, addSession, addTab, setActiveTab } = useSSHStore()
    const [hosts, setHosts] = useState<HostsObject[]>([])
    const { listen: listenNewConnectionClick } = useCustomEvent("NEW_SSH_CLIENT")
    const store = useStore()

    const handleClickOnHostCard = async (index: any) => {
        let data = hosts[index]
        if (!data) {
            idb.getAllItems("hosts").then((data) => {
                if (data) {
                    setHosts(data as any)
                }
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
            status: 'connecting',
            sftp_enabled: false
        })

        addTab({
            id,
            title: uniqueTitle,
            sessionId: id
        })

        store.setActiveTabData(data);
    }

    useEffect(() => {

        idb.getAllItems("hosts").then((data) => {
            if (data) {
                setHosts(data as any)
            }
        })

        const unsubscribe = listenNewConnectionClick(handleClickOnHostCard)
        return () => unsubscribe()
    }, [hosts, activeTabId])
    return (
        <div className='w-full'>

            {tabs.length === 0 && <StoredHosts hosts={hosts} handleClickOnHostCard={handleClickOnHostCard} />}
            {tabs.map((tab) => (
                tab.id === activeTabId ? <TerminalTab key={tab.id} sessionId={tab.sessionId} /> : null
            ))}
        </div>
    );
}
