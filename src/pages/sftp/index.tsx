/* eslint-disable @typescript-eslint/no-explicit-any */
import { Suspense } from 'react'
import { nanoid } from './utils/nanoid';
import { FolderOpen, Plus } from 'lucide-react';

import SFTPTabClient from './components/SFTPTabClient';
import { SFTPTabBar } from './components/SFTPTabBar';
import { useSFTPStore } from '@/store/sftpStore';
import { Button } from '@/components/ui/button';

const SFTP = () => {
  const { tabs, activeTabId, addTab, addSession } = useSFTPStore();

  const handleAddTab = () => {
    const id = nanoid();  // SFTP-specific ID, independent of SSH session IDs
    addTab({ id, title: `SFTP ${tabs.length + 1}` });
    addSession({
      tabId: id,
      host: '',
      username: '',
      status: 'idle',
      isConnecting: false,
      isConnected: false,
      isSftpConnected: false,
      loading: false,
      isError: false,
      currentDir: '',
      homeDir: '',
      title: '',
      remoteFiles: [],
      authMethod: 'password',
    });
  };

  // Empty state — no tabs yet
  if (tabs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-[#0A0A0A] text-gray-400 gap-4">
        <FolderOpen className="h-16 w-16 text-green-500/60" />
        <h2 className="text-xl font-semibold text-white">No Previously used SFTP Sessions</h2>
        <p className="text-sm text-gray-500">Click below to start a new SFTP connection</p>
        <Button
          onClick={handleAddTab}
          className="mt-2 gap-2 bg-green-600 hover:bg-green-700 text-white"
        >
          <Plus className="h-4 w-4" />
          New SFTP Connection
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#0A0A0A]">
      <SFTPTabBar onAddTab={handleAddTab} />
      <div className="flex-1 min-h-0 overflow-hidden">
        <Suspense fallback={<div className="text-white p-4">Loading...</div>}>
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={tab.id === activeTabId ? 'h-full' : 'hidden'}
            >
              <SFTPTabClient tabId={tab.id} />
            </div>
          ))}
        </Suspense>
      </div>
    </div>
  );
}

export default SFTP