/* eslint-disable @typescript-eslint/no-explicit-any */
import { Suspense } from 'react'
import { nanoid } from './utils/nanoid';
import { FolderOpen, Plus } from 'lucide-react';

import SFTPTabClient from './components/SFTPTabClient';
import { SFTPTabBar } from './components/SFTPTabBar';
import { useSFTPStore } from '@/store/sftpStore';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import ServerStatus from '@/components/layout/ServerStatus';

const SFTP = () => {
  const { tabs, activeTabId, addTab, addSession, sessions } = useSFTPStore();
  const navigate = useNavigate();
  const activeSession = activeTabId ? sessions[activeTabId] : null;

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
        <p className="text-gray-700 text-[11px] italic mt-2">Switch to SSH via the bottom bar</p>

        {/* SSH / SFTP toggle — bottom bar */}
        <div className="absolute bottom-0 inset-x-0 flex justify-end items-center flex-wrap px-4 py-1 border-t text-xs shrink-0 border-gray-800 bg-[#0A0A0A]/90 text-gray-300">
          <div className="flex items-center gap-1">
            <button
              onClick={() => navigate('/ssh/connect')}
              className="px-2 py-0.5 rounded text-[11px] font-medium transition-colors text-gray-400 hover:text-gray-100"
            >
              SSH
            </button>
            <button
              className="px-2 py-0.5 rounded text-[11px] font-medium transition-colors text-gray-200 bg-gray-700/50"
            >
              SFTP
            </button>
          </div>
        </div>
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

      {/* Status bar */}
      <div className="flex justify-between items-center flex-wrap px-4 py-1 border-t text-xs shrink-0 bg-[#0A0A0A]/90 text-gray-300 border-gray-800">
        {/* Left: SSH/SFTP toggle */}

        {/* Centre: session info */}
        <div className="flex flex-row gap-4">
          {activeSession?.host && (
            <span>Host: <span className="text-gray-200">{activeSession.host}</span></span>
          )}
          {activeSession?.username && (
            <span>User: <span className="text-gray-200">{activeSession.username}</span></span>
          )}
        </div>
        <div className="flex flex-row gap-4">
          {activeSession && (
            <span>Socket: <span className={activeSession.isConnected ? 'text-green-400' : 'text-gray-500'}>
              {activeSession.isConnected ? 'Connected' : activeSession.status}
            </span></span>
          )}
          {activeSession?.currentDir && (
            <span className="truncate max-w-[200px]" title={activeSession.currentDir}>
              Dir: {activeSession.currentDir}
            </span>
          )}
        </div>
        {/* Right: server status */}
        <div className="flex items-center gap-3">
        Session:

          <ServerStatus isConnected={activeSession?.status === 'connected'} />
        </div>
        <div className="flex items-center gap-1 mr-3">
          <button
            onClick={() => navigate('/ssh/connect')}
            className="px-2 py-0.5 rounded text-[11px] font-medium transition-colors opacity-60 hover:opacity-100 text-gray-300"
          >
            SSH
          </button>
          <button
            className="px-2 py-0.5 rounded text-[11px] font-medium transition-colors text-gray-200 bg-gray-700/50"
          >
            SFTP
          </button>
        </div>
      </div>
    </div>
  );
}

export default SFTP