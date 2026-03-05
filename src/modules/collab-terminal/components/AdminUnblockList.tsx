/**
 * AdminUnblockList — shows blocked IPs with an unblock button each.
 */
import { Unlock } from 'lucide-react';
import { useCollabStore } from '../store';

interface AdminUnblockListProps {
  onUnblock: (ip: string) => void;
}

export function AdminUnblockList({ onUnblock }: AdminUnblockListProps) {
  const blockedIPs = useCollabStore((s) => s.blockedIPs);

  if (blockedIPs.length === 0) {
    return (
      <p className="text-xs text-gray-500 text-center py-2">
        No blocked IPs.
      </p>
    );
  }

  return (
    <div className="space-y-1">
      {blockedIPs.map((ip) => (
        <div
          key={ip}
          className="flex items-center justify-between px-2 py-1.5 rounded bg-[#181818] border border-gray-700/50"
        >
          <code className="text-[11px] text-gray-400 font-mono">{ip}</code>
          <button
            onClick={() => onUnblock(ip)}
            title="Unblock IP"
            className="p-1 rounded bg-green-800/40 text-green-300 hover:bg-green-700/60 transition-colors"
          >
            <Unlock size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}
