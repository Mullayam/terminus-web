/* eslint-disable @typescript-eslint/no-explicit-any */
import { Suspense, useEffect } from 'react'
import { Navigate, useLocation } from 'react-router-dom';
import { v4 as uuid } from 'uuid';

import SftpClient from './SftpClient';
import SFTPTabClient from './components/SFTPTabClient';
import { SFTPTabBar } from './components/SFTPTabBar';
import { useSFTPStore } from '@/store/sftpStore';

const SFTP = ({ only_sftp = false }: { only_sftp?: boolean }) => {
  const location = useLocation();
  const { tabs, activeTabId, addTab, addSession } = useSFTPStore();

  const sftpEnabled = location.state?.sftp_enabled;
  if (only_sftp && !sftpEnabled) {
    return <Navigate to="/ssh" />
  }

  // If rendering multi-tab SFTP (only_sftp=false), auto-create first tab
  useEffect(() => {
    if (!only_sftp && tabs.length === 0) {
      handleAddTab();
    }
  }, []);

  const handleAddTab = () => {
    const id = uuid();
    addTab({ id, title: `SFTP ${tabs.length + 1}` });
    addSession({ tabId: id, host: '', username: '', status: 'idle' });
  };

  if (only_sftp) {
    return (
      <div className="h-full">
        <Suspense fallback={<div>Loading...</div>}>
          <SftpClient />
        </Suspense>
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