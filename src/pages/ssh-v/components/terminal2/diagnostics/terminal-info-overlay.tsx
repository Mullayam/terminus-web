import { useEffect, useState } from 'react';
import { useSessionTheme } from '@/hooks/useSessionTheme';
import { Lightbulb, X } from 'lucide-react';

interface Props {
  /** Called when the overlay is dismissed */
  onDismiss?: () => void;
}

/**
 * A non-intrusive grey info overlay shown once when the user first
 * connects to a terminal session. Auto-fades after 8 seconds or
 * can be dismissed manually.
 *
 * Single Responsibility: only displays informational tips.
 */
export default function TerminalInfoOverlay({ onDismiss }: Props) {
  const { colors } = useSessionTheme();
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFading(true), 6000);
    const hideTimer = setTimeout(() => {
      setVisible(false);
      onDismiss?.();
    }, 8000);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, [onDismiss]);

  const dismiss = () => {
    setFading(true);
    setTimeout(() => {
      setVisible(false);
      onDismiss?.();
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
          backgroundColor: `${colors.background}cc`,
          borderColor: `${colors.foreground}20`,
          color: `${colors.foreground}80`,
        }}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Lightbulb size={14} style={{ color: `${colors.foreground}60` }} />
            <span className="text-xs font-medium" style={{ color: `${colors.foreground}aa` }}>
              Quick Tips
            </span>
          </div>
          <button
            onClick={dismiss}
            className="p-0.5 rounded hover:bg-white/10 transition-colors"
          >
            <X size={12} style={{ color: `${colors.foreground}60` }} />
          </button>
        </div>
        <div className="space-y-1">
          {tips.map((t) => (
            <p key={t.key} className="text-[11px] leading-relaxed" style={{ color: `${colors.foreground}70` }}>
              • {t.text}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
