/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from 'zustand'
import { idb } from '@/lib/idb'
import { getAllCommandData, clearAllCommandData } from '@/lib/context-engine/contextEngineStorage'

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

/** Upper bound on retained per-host shell history. */
const SHELL_HISTORY_CAP = 5000
const historyWriteTimers: Record<string, ReturnType<typeof setTimeout>> = {}
function persistShellHistory(host: string, commands: string[]) {
    clearTimeout(historyWriteTimers[host])
    historyWriteTimers[host] = setTimeout(() => {
        idb.putItem("shell_history", { host, commands }).catch(console.error)
    }, 400)
}

type CommandStore = {
    /** Per-host shell history (zustand-only, resets on page reload) */
    shellHistory: Record<string, string[]>
    allCommands: CommandItem[]
    command: string
    clickType: "single" | "double"
    _hydrated: boolean
    setCommand: (command: string, clickType: "single" | "double") => void
    addShellHistoryCommand: (host: string, command: string) => void
    addShellHistoryBatch: (host: string, commands: string[]) => void
    removeShellHistoryCommand: (host: string, command: string) => void
    /** Load a host's persisted shell history from IndexedDB into the store */
    loadShellHistory: (host: string) => Promise<void>
    addToAllCommands: (command: CommandItem) => void
    setAllCommands: (commands: CommandItem[]) => void
    removeFromAllCommands: (command: string) => void
    resetToDefaults: () => void
    /** Re-merge pack commands from context-engine DB (call after install/uninstall) */
    syncPacks: () => Promise<void>
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
    shellHistory: {},
    allCommands: DEFAULT_COMMANDS,
    command: "",
    clickType: "single",
    _hydrated: false,
    setCommand: (command: string, clickType: "single" | "double") => set(() => ({ command, clickType })),

    /** Add a single command to a host's shell history (no duplicates) */
    addShellHistoryCommand: (host, command) => set((state) => {
        const prev = state.shellHistory[host] ?? [];
        if (prev.includes(command)) return state;
        const next = [...prev, command];
        const capped = next.length > SHELL_HISTORY_CAP ? next.slice(-SHELL_HISTORY_CAP) : next;
        persistShellHistory(host, capped);
        return { shellHistory: { ...state.shellHistory, [host]: capped } };
    }),

    /** Merge a batch of commands (e.g. from SSH_EXEC_SILENT_RESULT) */
    addShellHistoryBatch: (host, commands) => set((state) => {
        const prev = state.shellHistory[host] ?? [];
        const set2 = new Set(prev);
        const newCmds = commands.filter(c => c && !set2.has(c));
        if (newCmds.length === 0) return state;
        const next = [...prev, ...newCmds];
        const capped = next.length > SHELL_HISTORY_CAP ? next.slice(-SHELL_HISTORY_CAP) : next;
        persistShellHistory(host, capped);
        return { shellHistory: { ...state.shellHistory, [host]: capped } };
    }),

    /** Remove a single command from a host's history */
    removeShellHistoryCommand: (host, command) => set((state) => {
        const prev = state.shellHistory[host] ?? [];
        const next = prev.filter(c => c !== command);
        persistShellHistory(host, next);
        return { shellHistory: { ...state.shellHistory, [host]: next } };
    }),

    /** Load persisted history from IDB and merge it into the in-memory store */
    loadShellHistory: async (host) => {
        try {
            const rec = await idb.getItemByKey("shell_history", host) as { host: string; commands: string[] } | undefined;
            if (!rec?.commands?.length) return;
            set((state) => {
                const existing = state.shellHistory[host] ?? [];
                const merged = Array.from(new Set([...rec.commands, ...existing]));
                const capped = merged.length > SHELL_HISTORY_CAP ? merged.slice(-SHELL_HISTORY_CAP) : merged;
                return { shellHistory: { ...state.shellHistory, [host]: capped } };
            });
        } catch (e) {
            console.error("Failed to load shell history:", e);
        }
    },

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

    resetToDefaults: () => {
        set({ allCommands: DEFAULT_COMMANDS })
        const table = idb.getRawDb().all_commands
        table.clear().then(() => table.bulkPut(DEFAULT_COMMANDS as any[])).catch(console.error)
        clearAllCommandData().catch(console.error)
    },

    syncPacks: async () => {
        try {
            const stored = await idb.getAllItems("all_commands") as unknown as CommandItem[]
            const userCommands = stored && stored.length > 0 ? stored : DEFAULT_COMMANDS
            const packData = await getAllCommandData().catch(() => [])
            const packCommands: CommandItem[] = []
            for (const entry of packData) {
                const d = entry.data as any
                if (!d || !d.name) continue
                const parentName = d.name
                if (d.globalOptions) {
                    for (const opt of d.globalOptions) {
                        packCommands.push({ name: opt.description, command: `${parentName} ${opt.name}` })
                    }
                }
                if (d.subcommands) {
                    for (const sub of d.subcommands) {
                        packCommands.push({ name: sub.description, command: `${parentName} ${sub.name}` })
                    }
                }
            }
            const existingSet = new Set(userCommands.map(c => c.command))
            const newFromPacks = packCommands.filter(c => !existingSet.has(c.command))
            set({ allCommands: [...userCommands, ...newFromPacks] })
        } catch (e) {
            console.error("Failed to sync pack commands:", e)
        }
    },

    hydrate: async () => {
        if (get()._hydrated) return
        try {
            const stored = await idb.getAllItems("all_commands") as unknown as CommandItem[]

            if (stored && stored.length > 0) {
                // Merge commands from installed command packs (context-engine DB)
                const packData = await getAllCommandData().catch(() => [])

                const packCommands: CommandItem[] = []
                for (const entry of packData) {
                    const d = entry.data as any
                    if (!d || !d.name) continue
                    const parentName = d.name
                    if (d.globalOptions) {
                        for (const opt of d.globalOptions) {
                            packCommands.push({ name: opt.description, command: `${parentName} ${opt.name}` })
                        }
                    }
                    if (d.subcommands) {
                        for (const sub of d.subcommands) {
                            packCommands.push({ name: sub.description, command: `${parentName} ${sub.name}` })
                        }
                    }
                }

                // Deduplicate: only add pack commands not already in stored
                const existingSet = new Set(stored.map(c => c.command))
                const newFromPacks = packCommands.filter(c => !existingSet.has(c.command))
                const merged = [...stored, ...newFromPacks]
                set({ allCommands: merged, _hydrated: true })
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
