import { useEffect, useMemo, useRef, useState } from 'react';
import { useSessionTheme } from '@/hooks/useSessionTheme';
import { Lightbulb, X } from 'lucide-react';

interface Props {
  /** Unique key per host to persist shown state */
  hostKey: string;
}

const STORAGE_PREFIX = 'terminus-tips-shown:';

function mixHex(c1: string, c2: string, t: number): string {
  const parse = (hex: string) => {
    const h = hex.replace("#", "").slice(0, 6);
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  };
  const [r1, g1, b1] = parse(c1);
  const [r2, g2, b2] = parse(c2);
  const m = (a: number, b: number) => Math.round(a + (b - a) * t);
  return `#${m(r1, r2).toString(16).padStart(2, "0")}${m(g1, g2).toString(16).padStart(2, "0")}${m(b1, b2).toString(16).padStart(2, "0")}`;
}

/**
 * A non-intrusive info overlay shown once per host.
 * Manages its own visibility via localStorage — no parent state needed.
 * On unmount (disconnect) the storage key is removed so tips show again
 * on the next connection to the same host.
 */
export default function TerminalInfoOverlay({ hostKey }: Props) {
  const { colors } = useSessionTheme();
  const bg = colors.background ?? '#1a1b26';
  const fg = colors.foreground ?? '#e0e0e0';
  const t = useMemo(() => ({
    label: mixHex(bg, fg, 0.7),
    icon: mixHex(bg, fg, 0.45),
    tip: mixHex(bg, fg, 0.55),
    border: mixHex(bg, fg, 0.12),
  }), [bg, fg]);
  const storageKey = `${STORAGE_PREFIX}${hostKey}`;
  const dismissed = useRef(false);

  const [visible, setVisible] = useState(() => {
    try { return localStorage.getItem(storageKey) !== '1'; } catch { return true; }
  });
  const [fading, setFading] = useState(false);

  const markShown = () => {
    if (dismissed.current) return;
    dismissed.current = true;
    try { localStorage.setItem(storageKey, '1'); } catch { /* ignore */ }
  };

  useEffect(() => {
    if (!visible) return;
    const fadeTimer = setTimeout(() => setFading(true), 6000);
    const hideTimer = setTimeout(() => {
      setVisible(false);
      markShown();
    }, 8000);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, [visible]);

  const dismiss = () => {
    setFading(true);
    setTimeout(() => {
      setVisible(false);
      markShown();
    }, 300);
  };

  if (!visible) return null;

  const tips = [
    { key: 'autocomplete', text: 'Ghost text autocomplete — toggle from Settings panel' },
    { key: 'commands', text: 'Install command packs from the Extensions tab in the sidebar' },
    { key: 'download', text: 'Download commands to your quick-access list from any command pack' },
    { key: 'search', text: 'Press Ctrl+F to search in terminal output' },
    { key: 'history', text: 'View command history from the sidebar' },
    { key: 'diagnostics', text: 'Error & warning detection — enable in Settings' },
    { key: 'split', text: 'Right-click a tab to split terminals side-by-side' },
    { key: 'switch', text: 'Switch between SSH and SFTP from the bottom status bar' },
  ];

  return (
    <div
      className="absolute inset-0 z-20 pointer-events-none flex items-end justify-center pb-6"
      style={{ transition: 'opacity 0.3s ease', opacity: fading ? 0 : 1 }}
    >
      <div
        className="pointer-events-auto rounded-lg border px-4 py-3 max-w-md w-full shadow-lg backdrop-blur-sm"
        style={{
          backgroundColor: `${bg}cc`,
          borderColor: t.border,
          color: t.tip,
        }}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Lightbulb size={14} style={{ color: t.icon }} />
            <span className="text-xs font-medium" style={{ color: t.label }}>
              Quick Tips
            </span>
          </div>
          <button
            onClick={dismiss}
            className="p-0.5 rounded hover:bg-white/10 transition-colors"
          >
            <X size={12} style={{ color: t.icon }} />
          </button>
        </div>
        <div className="space-y-1">
          {tips.map((tip) => (
            <p key={tip.key} className="text-[11px] leading-relaxed" style={{ color: t.tip }}>
              • {tip.text}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
