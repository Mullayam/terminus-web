import { useSSHStore } from '@/store/sshStore';
import { useTerminalStore } from '@/store/terminalStore';

export const useSessionDisconnect = () => {
  const {
    updateStatus,
    removeSession,
    removeTab,
    sessions

  } = useSSHStore();

  const { removeLog } = useTerminalStore();

  const disconnect = (sessionId: string, tabId: string) => {
    sessions[sessionId].socket?.disconnect();
    updateStatus(sessionId, 'disconnected');
    removeSession(sessionId);
    removeTab(tabId);
    removeLog(sessionId);
    console.log(
      `%c Disconnected`,
      'background: #222; color: #bada55'
    )
  };

  return { disconnect };
};
