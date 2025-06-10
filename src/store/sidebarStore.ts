import { create } from 'zustand'

type Store = {
    activeItem: 'Terminal' | 'SFTP'
    setActiveItem: (item: 'Terminal' | 'SFTP') => void

}

export const useSidebarState = create<Store>()((set) => ({
    activeItem: 'Terminal',
    setActiveItem: (item) => set(({ activeItem: item }))
}))