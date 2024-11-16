/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from 'zustand'
type TabsData = {
    host: string
    username: string
}
type TabsContent = Array<{ id: number; title: string,uid: string, sessionId: string, data: TabsData }>
type Store = {
    tabs: TabsContent
    activeTab: number
    setActiveTab: (index: number) => void
    addTab: (data: any) => void
    removeTab: (index: number) => void
}

type CommandStore = {
    command: string
    clickType: "single" | "double"
    setCommand: (command: string, clickType: "single" | "double") => void
}
export const useCommandStore = create<CommandStore>()((set) => ({
    command: "",
    clickType: "single",
    setCommand: (command: string, clickType: "single" | "double") => set(() => ({ command: command , clickType: clickType }))
}))
export const useStore = create<Store>()((set) => ({

    tabs: [],
    addTab: (data: any) => set((state) => {
        return {
            ...state,
            tabs: [...state.tabs, { id: state.tabs.length + 1, title: `Terminal ${state.tabs.length + 1}`, uid: data.uid, sessionId: data.sessionId, data: data.data }],
        }
    }
    ),
    
    removeTab: (index: number) => set((state: any) => {
        const filteredTabs = state.tabs.filter((tab: any, i: number) => i !== index)
        return {
            ...state,
            tabs: filteredTabs,
            activeTab: index > 0 ? index - 1 : 0
        }
    }),
    activeTab: 0,
    setActiveTab: (index: number) => set((state) => ({ ...state, activeTab: index })),
}))