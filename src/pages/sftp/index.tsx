/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { Suspense } from 'react'
import { socket } from '@/lib/sockets'
import { SocketEventConstants } from '@/lib/sockets/event-constants'
import SFTPClient from "@/pages/sftp/sftp-client";
import { useSockets } from '@/hooks/use-sockets';
import { useNavigate } from 'react-router-dom';

const SFTP = () => {
  const { isSSH_Connected } = useSockets()
  const navigate = useNavigate()
  const [remoteFiles, setRemoteFiles] = React.useState([])
  React.useEffect(() => {
    socket.emit(SocketEventConstants.SFTP_GET_FILE)
    socket.on(SocketEventConstants.SFTP_FILES_LIST, (data: any) => {
      console.log(data)
    })
    if (!isSSH_Connected) {
      navigate('/ssh')  // Navigate to /ssh if not connected
    }
    return () => {
      socket.off(SocketEventConstants.SFTP_FILES_LIST)
    }
  }, [isSSH_Connected, navigate])
  return (
    <div>
      <Suspense fallback={<div>Loading...</div>}>
       {isSSH_Connected && <SFTPClient />}  
      </Suspense>
    </div>
  )
}

export default SFTP