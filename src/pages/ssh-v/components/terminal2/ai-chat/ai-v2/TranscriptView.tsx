import { useState } from 'react';
import {
  AlertCircle,
  ChevronRight,
  CircleCheck,
  CircleSlash,
  FileCog,
  Flag,
  Play,
  ShieldAlert,
  Terminal as TerminalIcon,
  User,
} from 'lucide-react';
import type { TranscriptItem } from './types';

// ── tiny MESSAGE renderer: preserves newlines, lifts ``` fences ──
function MessageText({ text, colors }: { text: string; colors: Record<string, string> }) {
  const parts = text.split(/```/);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <pre
            key={i}
            className="my-1.5 text-[11.5px] rounded-md px-2.5 py-2 overflow-x-auto whitespace-pre-wrap"
            style={{ backgroundColor: `${colors.foreground}0d`, border: `1px solid ${colors.foreground}14` }}
          >
            <code>{part.replace(/^\w*\n/, '')}</code>
          </pre>
        ) : (
          <span key={i} className="whitespace-pre-wrap">
            {part}
          </span>
        ),
      )}
    </>
  );
}

function OutputItem({
  command,
  output,
  exitCode,
  timedOut,
  colors,
}: {
  command: string;
  output: string;
  exitCode: number;
  timedOut?: boolean;
  colors: Record<string, string>;
}) {
  const [open, setOpen] = useState(true);
  const ok = exitCode === 0 && !timedOut;
  const accent = ok ? colors.green : colors.brightRed || colors.red;
  return (
    <div className="rounded-md overflow-hidden" style={{ border: `1px solid ${colors.foreground}14` }}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-1.5 px-2.5 py-1.5 text-left transition-colors hover:bg-white/5"
        style={{ backgroundColor: `${colors.foreground}08` }}
      >
        <ChevronRight size={12} className="transition-transform" style={{ color: `${colors.foreground}70`, transform: open ? 'rotate(90deg)' : 'none' }} />
        {ok ? <CircleCheck size={12} style={{ color: accent }} /> : <CircleSlash size={12} style={{ color: accent }} />}
        <span className="text-[11px] truncate font-mono" style={{ color: `${colors.foreground}aa` }}>
          {command}
        </span>
        <span className="ml-auto text-[10px] tabular-nums shrink-0" style={{ color: accent }}>
          {timedOut ? 'timed out' : `exit ${exitCode}`}
        </span>
      </button>
      {open && (
        <pre
          className="text-[11px] px-2.5 py-2 overflow-x-auto whitespace-pre-wrap"
          style={{ color: `${colors.foreground}cc`, maxHeight: 220 }}
        >
          <code>{output || '(no output)'}</code>
        </pre>
      )}
    </div>
  );
}

function DangerousItem({
  command,
  reason,
  level,
  resolved,
  colors,
}: {
  command: string;
  reason: string;
  level: 'confirm' | 'blocked';
  resolved?: 'approved' | 'denied' | 'auto-approved';
  colors: Record<string, string>;
}) {
  const blocked = level === 'blocked';
  const accent = blocked ? colors.brightRed || colors.red : colors.brightYellow || colors.yellow;
  const resolvedLabel =
    resolved === 'approved' ? 'approved' : resolved === 'auto-approved' ? 'auto-approved' : resolved === 'denied' ? 'denied' : null;
  return (
    <div className="rounded-md px-2.5 py-2" style={{ backgroundColor: `${accent}10`, border: `1px solid ${accent}3a` }}>
      <div className="flex items-center gap-1.5">
        <ShieldAlert size={12} style={{ color: accent }} />
        <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: accent }}>
          {blocked ? 'blocked' : 'confirm'}
        </span>
        {resolvedLabel && (
          <span
            className="ml-auto text-[10px]"
            style={{ color: resolved === 'denied' ? colors.brightRed || colors.red : colors.green }}
          >
            {resolvedLabel}
          </span>
        )}
      </div>
      <code className="block text-[11.5px] font-mono mt-1 break-all" style={{ color: colors.foreground }}>
        {command}
      </code>
      <p className="text-[10.5px] mt-0.5" style={{ color: `${colors.foreground}88` }}>
        {reason}
      </p>
    </div>
  );
}

export function TranscriptView({ items, colors }: { items: TranscriptItem[]; colors: Record<string, string> }) {
  return (
    <div className="space-y-2.5">
      {items.map((item) => {
        switch (item.type) {
          case 'user':
            return (
              <div key={item.id} className="flex justify-end">
                <div
                  className="flex items-start gap-2 max-w-[85%] rounded-xl rounded-tr-sm px-3 py-2"
                  style={{ backgroundColor: `${colors.blue}1f`, border: `1px solid ${colors.blue}30` }}
                >
                  <span className="text-[12.5px] whitespace-pre-wrap" style={{ color: colors.foreground }}>
                    {item.text}
                  </span>
                  <User size={12} className="mt-0.5 shrink-0" style={{ color: `${colors.blue}` }} />
                </div>
              </div>
            );
          case 'message':
            return (
              <div key={item.id} className="text-[12.5px] leading-relaxed" style={{ color: `${colors.foreground}e6` }}>
                <MessageText text={item.text} colors={colors} />
              </div>
            );
          case 'command':
            return (
              <div
                key={item.id}
                className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5"
                style={{ backgroundColor: `${colors.cyan}12`, border: `1px solid ${colors.cyan}2e` }}
              >
                <Play size={11} style={{ color: colors.cyan }} />
                <code className="text-[11.5px] font-mono truncate" style={{ color: colors.foreground }}>
                  {item.command}
                </code>
                <TerminalIcon size={11} className="ml-auto shrink-0" style={{ color: `${colors.foreground}55` }} />
              </div>
            );
          case 'task':
            return (
              <div
                key={item.id}
                className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5"
                style={{ backgroundColor: `${colors.magenta}12`, border: `1px solid ${colors.magenta}2e` }}
              >
                <FileCog size={11} style={{ color: colors.magenta }} />
                <span className="text-[11.5px]" style={{ color: colors.foreground }}>
                  {item.task}
                </span>
              </div>
            );
          case 'output':
            return <OutputItem key={item.id} {...item} colors={colors} />;
          case 'dangerous':
            return <DangerousItem key={item.id} {...item} colors={colors} />;
          case 'error':
            return (
              <div
                key={item.id}
                className="flex items-start gap-1.5 rounded-md px-2.5 py-2"
                style={{ backgroundColor: `${colors.red}12`, border: `1px solid ${colors.red}33` }}
              >
                <AlertCircle size={12} className="mt-0.5 shrink-0" style={{ color: colors.brightRed || colors.red }} />
                <span className="text-[11.5px]" style={{ color: colors.foreground }}>
                  {item.error}
                </span>
              </div>
            );
          case 'done':
            return (
              <div key={item.id} className="flex items-center gap-1.5 py-1">
                <Flag size={11} style={{ color: item.stopped ? colors.brightYellow || colors.yellow : `${colors.foreground}55` }} />
                <span className="text-[10.5px]" style={{ color: `${colors.foreground}70` }}>
                  {item.stopped ? 'Stopped by you' : 'Turn complete'}
                </span>
              </div>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}
