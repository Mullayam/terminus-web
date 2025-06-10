/* eslint-disable @typescript-eslint/no-explicit-any */
import { Suspense } from 'react'
import OnlySFTPClient from "@/pages/sftp/components/only-sftp-client";

import { Navigate, useLocation } from 'react-router-dom';
import SftpClient from './SftpClient';
import SocketContextProvider from '@/context/socket-context';

const SFTP = ({ only_sftp = false }: { only_sftp?: boolean }) => {
  const location = useLocation();


  const sftpEnabled = location.state?.sftp_enabled;
  if (only_sftp && !sftpEnabled) {
    return <Navigate to="/ssh" />
  }

  return (
    <div>
      <Suspense fallback={<div>Loading...</div>}>
        {!only_sftp ?
          <SocketContextProvider>
            <OnlySFTPClient />
          </SocketContextProvider>
          : <SftpClient />}
      </Suspense>
    </div>
  )
}

export default SFTP