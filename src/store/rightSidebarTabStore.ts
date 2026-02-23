import { create } from 'zustand';
import { ThemeName } from '@/pages/ssh-v/components/themes';

export type TabType = 'commands' | 'sharing' | 'settings';

interface Command {
  id: string;
  name: string;
  description: string;
  category: string;
  shortcut?: string;
  lastUsed?: Date;
}

interface SharingSession {
  id: string;
  name: string;
  status: 'active' | 'paused' | 'ended';
  participants: number;
  createdAt: Date;
}

interface Settings {
  theme: ThemeName;
  notifications: boolean;
  autoSave: boolean;
  fontSize: 'small' | 'medium' | 'large';
}

interface TabState {
  activeTab: TabType;
  commands: Command[];
  sharingSessions: SharingSession[];
  settings: Settings;
  leftSidebarOpen: boolean;
  rightSidebarOpen: boolean;
  setActiveTab: (tab: TabType) => void;
  executeCommand: (commandId: string) => void;
  createSharingSession: (name: string) => void;
  updateSettings: (settings: Partial<Settings>) => void;
  toggleLeftSidebar: () => void;
  toggleRightSidebar: () => void;
  setRightSidebarOpen: (open: boolean) => void;
}

export const useTabStore = create<TabState>((set, get) => ({
  activeTab: 'commands',
  leftSidebarOpen: true,
  rightSidebarOpen: false,
  commands: [
    {
      id: '1',
      name: 'Clear Terminal',
      description: 'Clear all terminal output and start fresh',
      category: 'Terminal',
      shortcut: 'Ctrl+L',
      lastUsed: new Date(Date.now() - 1000 * 60 * 30) // 30 minutes ago
    },
    {
      id: '2',
      name: 'New Tab',
      description: 'Open a new terminal tab',
      category: 'Navigation',
      shortcut: 'Ctrl+T',
      lastUsed: new Date(Date.now() - 1000 * 60 * 60) // 1 hour ago
    },
    {
      id: '3',
      name: 'Split Terminal',
      description: 'Split the current terminal into two panes',
      category: 'Layout',
      shortcut: 'Ctrl+Shift+D',
      lastUsed: new Date(Date.now() - 1000 * 60 * 60 * 2) // 2 hours ago
    },
    {
      id: '4',
      name: 'Search History',
      description: 'Search through command history',
      category: 'Search',
      shortcut: 'Ctrl+R'
    },
    {
      id: '5',
      name: 'Copy Selection',
      description: 'Copy the selected text to clipboard',
      category: 'Edit',
      shortcut: 'Ctrl+C'
    },
    {
      id: '6',
      name: 'Paste',
      description: 'Paste from clipboard',
      category: 'Edit',
      shortcut: 'Ctrl+V'
    }
  ],
  sharingSessions: [
    {
      id: '1',
      name: 'Debug Session with Team',
      status: 'active',
      participants: 3,
      createdAt: new Date(Date.now() - 1000 * 60 * 15) // 15 minutes ago
    },
    {
      id: '2',
      name: 'Code Review Session',
      status: 'paused',
      participants: 2,
      createdAt: new Date(Date.now() - 1000 * 60 * 60) // 1 hour ago
    }
  ],
  settings: {
    theme: 'custom',
    notifications: true,
    autoSave: true,
    fontSize: 'medium'
  },
  setActiveTab: (tab) => set({ activeTab: tab }),
  executeCommand: (commandId) => {
    const commands = get().commands;
    const updatedCommands = commands.map(cmd => 
      cmd.id === commandId ? { ...cmd, lastUsed: new Date() } : cmd
    );
    set({ commands: updatedCommands });
  },
  createSharingSession: (name) => {
    const newSession: SharingSession = {
      id: Date.now().toString(),
      name,
      status: 'active',
      participants: 1,
      createdAt: new Date()
    };
    set(state => ({ 
      sharingSessions: [newSession, ...state.sharingSessions] 
    }));
  },
  updateSettings: (newSettings) => {
    set(state => ({ 
      settings: { ...state.settings, ...newSettings } 
    }));
  },
  toggleLeftSidebar: () => set(state => ({ leftSidebarOpen: !state.leftSidebarOpen })),
  toggleRightSidebar: () => set(state => ({ rightSidebarOpen: !state.rightSidebarOpen })),
  setRightSidebarOpen: (open) => set({ rightSidebarOpen: open })
}));