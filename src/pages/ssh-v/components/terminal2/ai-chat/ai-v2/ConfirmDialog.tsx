import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Check, ShieldAlert, X } from 'lucide-react';
import type { ConfirmRequest } from './types';
import { CONFIRM_TIMEOUT_MS } from './constants';

interface Props {
  request: ConfirmRequest;
  colors: Record<string, string>;
  onReply: (confirmId: string, approved: boolean) => void;
}

/**
 * Dangerous-command approval. `blocked` is styled red ("destructive — cannot be
 * undone"), `confirm` amber. Auto-denies after 120s to match the server.
 */
export function ConfirmDialog({ request, colors, onReply }: Props) {
  const { confirmId, command, reason, level } = request;
  const blocked = level === 'blocked';
  const accent = blocked ? colors.brightRed || colors.red : colors.brightYellow || colors.yellow;

  const [remaining, setRemaining] = useState(Math.round(CONFIRM_TIMEOUT_MS / 1000));
  const startRef = useRef(Date.now());

  useEffect(() => {
    startRef.current = Date.now();
    setRemaining(Math.round(CONFIRM_TIMEOUT_MS / 1000));
    const int = setInterval(() => {
      const left = Math.max(0, CONFIRM_TIMEOUT_MS - (Date.now() - startRef.current));
      setRemaining(Math.ceil(left / 1000));
    }, 500);
    return () => clearInterval(int);
  }, [confirmId]);

  return (
    <div
      className="absolute inset-0 z-50 flex items-end justify-center p-4"
      style={{ backgroundColor: `${colors.background}cc`, backdropFilter: 'blur(2px)' }}
    >
      <div
        className="w-full rounded-xl border overflow-hidden animate-in slide-in-from-bottom-4"
        style={{
          backgroundColor: colors.background,
          borderColor: `${accent}66`,
          boxShadow: `0 8px 40px ${colors.background}, 0 0 0 1px ${accent}22`,
        }}
      >
        <div className="flex items-center gap-2 px-4 py-2.5 border-b" style={{ borderColor: `${accent}33`, backgroundColor: `${accent}12` }}>
          {blocked ? <ShieldAlert size={15} style={{ color: accent }} /> : <AlertTriangle size={15} style={{ color: accent }} />}
          <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: accent }}>
            {blocked ? 'Destructive — cannot be undone' : 'Confirm command'}
          </span>
          <span className="ml-auto text-[10px] tabular-nums" style={{ color: `${colors.foreground}70` }}>
            auto-deny in {remaining}s
          </span>
        </div>

        <div className="px-4 py-3 space-y-2">
          <pre
            className="text-[12px] rounded-md px-3 py-2 overflow-x-auto whitespace-pre-wrap break-all"
            style={{ backgroundColor: `${colors.foreground}0d`, color: colors.foreground, border: `1px solid ${colors.foreground}14` }}
          >
            <code>{command}</code>
          </pre>
          <p className="text-[11px]" style={{ color: `${colors.foreground}99` }}>
            {reason}
          </p>
        </div>

        <div className="flex items-center gap-2 px-4 py-3 border-t" style={{ borderColor: `${colors.foreground}12` }}>
          <button
            onClick={() => onReply(confirmId, true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-opacity hover:opacity-90"
            style={{ backgroundColor: accent, color: colors.background }}
          >
            <Check size={13} /> {blocked ? 'Run anyway' : 'Approve & run'}
          </button>
          <button
            onClick={() => onReply(confirmId, false)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors hover:bg-white/10"
            style={{ color: colors.foreground, border: `1px solid ${colors.foreground}22` }}
          >
            <X size={13} /> Deny
          </button>
          <span className="ml-auto text-[10px]" style={{ color: `${colors.foreground}55` }}>
            {level} tier
          </span>
        </div>
      </div>
    </div>
  );
}
