/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { Suspense } from 'react'
import SFTPClient from "@/pages/sftp/sftp-client";
import { useSockets } from '@/hooks/use-sockets';
import { useNavigate } from 'react-router-dom';

const SFTP = () => {
  const { isSSH_Connected } = useSockets()
  const navigate = useNavigate()
  React.useEffect(() => {
    
    if (!isSSH_Connected) {
      navigate('/ssh')  // Navigate to /ssh if not connected
    }
    
  }, [isSSH_Connected, navigate])
  return (
    <div>
      <Suspense fallback={<div>Loading...</div>}>
        {isSSH_Connected && <SFTPClient />}
        <SFTPClient />
      </Suspense>
    </div>
  )
}

export default SFTP