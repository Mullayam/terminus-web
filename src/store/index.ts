/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from 'zustand'

type Store = {
    activeTabData: null | Record<string, any>
    setActiveTabData: (data: Record<string, any>|null) => void

}

type CommandStore = {
    command: string
    clickType: "single" | "double"
    setCommand: (command: string, clickType: "single" | "double") => void
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
    command: "",
    clickType: "single",
    setCommand: (command: string, clickType: "single" | "double") => set(() => ({ command: command, clickType: clickType }))
}))
export const useStore = create<Store>()((set) => ({
    activeTabData: null,

    setActiveTabData: (data: Record<string, any>|null) => set(({ activeTabData: data })),
}))
