import { useEffect, useState } from 'react';
import { History } from 'lucide-react';
import { useTerminalStore } from '@/store/terminalStore';

const VISIBLE_MS = 6000;

/**
 * Transient "Reconnected · history restored" pill, shown after a session
 * re-establishes so the user knows their scrollback is still there.
 */
export function ReconnectBadge({ sessionId }: { sessionId: string }) {
    const reconnectedAt = useTerminalStore((s) => s.reconnectedAt[sessionId] ?? 0);
    const clearReconnected = useTerminalStore((s) => s.clearReconnected);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (!reconnectedAt) return;
        setVisible(true);
        const hide = setTimeout(() => {
            setVisible(false);
            clearReconnected(sessionId);
        }, VISIBLE_MS);
        return () => clearTimeout(hide);
    }, [reconnectedAt, sessionId, clearReconnected]);

    if (!visible) return null;

    return (
        <div className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 z-30">
            <div
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium shadow-lg
                           animate-in fade-in slide-in-from-top-2"
                style={{
                    backgroundColor: 'rgba(16, 185, 129, 0.15)',
                    color: '#34d399',
                    border: '1px solid rgba(52, 211, 153, 0.35)',
                    backdropFilter: 'blur(6px)',
                }}
            >
                <History className="w-3 h-3" />
                Reconnected · History restored
            </div>
        </div>
    );
}

export default ReconnectBadge;
