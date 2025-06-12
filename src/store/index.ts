/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from 'zustand'
const commands = [

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

type CommandStore = {
    recentCommands: string[]
    allCommands: { name: string, command: string }[]
    command: string
    clickType: "single" | "double"
    setCommand: (command: string, clickType: "single" | "double") => void
    addRecentCommand: (command: string) => void
    addToAllCommands: (command: { name: string, command: string }) => void
    setAllCommands: (commands: { name: string, command: string }[]) => void

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


export const useCommandStore = create<CommandStore>()((set) => ({
    recentCommands: [],
    allCommands: commands,
    command: "",
    clickType: "single",
    setCommand: (command: string, clickType: "single" | "double") => set(() => ({ command: command, clickType: clickType })),
    addRecentCommand: (command) => set((state) => ({ recentCommands: [command, ...state.recentCommands] })),
    addToAllCommands: (command) => set((state) => ({ allCommands: [command, ...state.allCommands] })),
    setAllCommands: (commands) => set(({ allCommands: commands }))

}))
export const useStore = create<Store>()((set) => ({
    activeTabData: null,

    setActiveTabData: (data: Record<string, any> | null) => set(({ activeTabData: data })),
}))
