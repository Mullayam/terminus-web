import React from 'react';
import { Socket } from 'socket.io-client';

export const SFTPContext = React.createContext<{
  socket: Socket | undefined;
  handleSSHConnection?: (data?: boolean) => void;
  isConnected: boolean;
  tabId?: string;
}>({ socket: undefined, isConnected: false });

export const useSFTPContext = () => React.useContext(SFTPContext);
