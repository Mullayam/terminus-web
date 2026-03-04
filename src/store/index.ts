/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from 'zustand'
import { idb } from '@/lib/idb'

const DEFAULT_COMMANDS = [
    { name: 'PM2 restart', command: 'pm2 restart' },
    { name: 'PM2 Stop', command: 'pm2 stop' },
    { name: 'PM2 Logs', command: 'pm2 logs' },
    { name: 'Nginx Test', command: 'sudo nginx -t' },
    { name: 'Reload Nginx File', command: 'sudo systemctl reload nginx' },
    { name: 'Stop Nginx', command: 'sudo systemctl stop nginx' },
    { name: 'Restart Nginx', command: 'sudo systemctl restart nginx' },
    { name: 'systemctl', command: 'systemctl' },
];

type Store = {
    activeTabData: null | Record<string, any>
    setActiveTabData: (data: Record<string, any> | null) => void

}

type CommandItem = { name: string; command: string }

type CommandStore = {
    recentCommands: string[]
    allCommands: CommandItem[]
    command: string
    clickType: "single" | "double"
    _hydrated: boolean
    setCommand: (command: string, clickType: "single" | "double") => void
    addRecentCommand: (command: string) => void
    addToAllCommands: (command: CommandItem) => void
    setAllCommands: (commands: CommandItem[]) => void
    removeFromAllCommands: (command: string) => void
    hydrate: () => Promise<void>
}

export const useLoadingState = create<{
    loading: boolean
    setLoading: (value: boolean) => void
}>()((set) => ({
    loading: false,
    setLoading: (value: boolean) => set(() => ({ loading: value }))
}))

export const useDialogState = create<{
    openDialog: boolean
    setOpenDialog: (value: boolean) => void
}>()((set) => ({
    openDialog: false,
    setOpenDialog: (value: boolean) => set(() => ({ openDialog: value }))
}))


export const useCommandStore = create<CommandStore>()((set, get) => ({
    recentCommands: [],
    allCommands: DEFAULT_COMMANDS,
    command: "",
    clickType: "single",
    _hydrated: false,
    setCommand: (command: string, clickType: "single" | "double") => set(() => ({ command, clickType })),
    addRecentCommand: (command) => set((state) => ({ recentCommands: [command, ...state.recentCommands] })),

    addToAllCommands: (command) => {
        set((state) => ({ allCommands: [command, ...state.allCommands] }))
        idb.putItem("all_commands", command as any).catch(console.error)
    },

    setAllCommands: (commands) => {
        set({ allCommands: commands })
        // Sync full list to IDB: clear then bulk-put
        const table = idb.getRawDb().all_commands
        table.clear().then(() => table.bulkPut(commands as any[])).catch(console.error)
    },

    removeFromAllCommands: (command) => {
        set((state) => ({ allCommands: state.allCommands.filter((c) => c.command !== command) }))
        idb.deleteItem("all_commands", command).catch(console.error)
    },

    hydrate: async () => {
        if (get()._hydrated) return
        try {
            const stored = await idb.getAllItems("all_commands") as unknown as CommandItem[]
            if (stored && stored.length > 0) {
                set({ allCommands: stored, _hydrated: true })
            } else {
                // First run: seed IDB with defaults
                const table = idb.getRawDb().all_commands
                await table.bulkPut(DEFAULT_COMMANDS as any[])
                set({ _hydrated: true })
            }
        } catch (e) {
            console.error("Failed to hydrate commands from IDB:", e)
            set({ _hydrated: true })
        }
    },
}))
export const useStore = create<Store>()((set) => ({
    activeTabData: null,

    setActiveTabData: (data: Record<string, any> | null) => set(({ activeTabData: data })),
}))
