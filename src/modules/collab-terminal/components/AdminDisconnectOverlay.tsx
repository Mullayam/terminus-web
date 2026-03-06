/**
 * AdminDisconnectOverlay — shows a banner when the admin (host) disconnects.
 *
 * Displays a countdown based on `gracePeriod`. When the server fires
 * `@@COLLAB_ADMIN_RECONNECTED` the store resets `adminDisconnect` to null
 * and this overlay disappears automatically.
 */
import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';
import { useCollabStore } from '../store';
import { useCollabTheme } from '../hooks';

export function AdminDisconnectOverlay() {
  const adminDisconnect = useCollabStore((s) => s.adminDisconnect);
  const { colors } = useCollabTheme();
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!adminDisconnect) return;

    setRemaining(adminDisconnect.gracePeriod);

    const interval = setInterval(() => {
      setRemaining((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(interval);
  }, [adminDisconnect]);

  if (!adminDisconnect) return null;

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const timeStr = mins > 0 ? `${mins}:${String(secs).padStart(2, '0')}` : `${secs}s`;

  return (
    <div className="absolute inset-0 z-20 flex items-start justify-center pt-6 pointer-events-none">
      <div
        className="flex items-center gap-3 px-5 py-3 rounded-lg"
        style={{
          backgroundColor: `${colors.background}CC`,
          backdropFilter: 'blur(4px)',
          border: `1px solid ${colors.red}40`,
        }}
      >
        <WifiOff size={16} style={{ color: `${colors.red}CC` }} />
        <div className="flex flex-col gap-0.5">
          <span
            className="text-xs font-medium"
            style={{ color: `${colors.foreground}CC`, fontFamily: 'monospace' }}
          >
            {adminDisconnect.message}
          </span>
          <span
            className="text-[11px]"
            style={{ color: `${colors.foreground}70`, fontFamily: 'monospace' }}
          >
            Session will end in{' '}
            <span style={{ color: `${colors.red}DD` }}>{timeStr}</span>
            {' '}if admin doesn't reconnect
          </span>
        </div>
      </div>
    </div>
  );
}
