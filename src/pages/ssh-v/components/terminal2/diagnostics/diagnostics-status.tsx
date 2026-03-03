import { useMemo } from 'react';
import { AlertCircle, AlertTriangle, Trash2 } from 'lucide-react';
import { useSessionTheme } from '@/hooks/useSessionTheme';
import type { DiagnosticCounts } from './useDiagnostics';

interface Props {
  counts: DiagnosticCounts;
  onClickErrors: () => void;
  onClickWarnings: () => void;
  onClear: () => void;
}

/**
 * Compact inline status indicators for the bottom status bar.
 *
 * Single Responsibility: only renders diagnostic count badges.
 * Dependency Inversion: receives counts + callbacks, no direct store dependency.
 */
export default function DiagnosticsStatus({ counts, onClickErrors, onClickWarnings, onClear }: Props) {
  const { colors } = useSessionTheme();

  const hasIssues = counts.errors > 0 || counts.warnings > 0;

  const errorColor = useMemo(() => {
    const c = colors as Record<string, string | undefined>;
    return c.red ?? '#ef4444';
  }, [colors]);

  const warnColor = useMemo(() => {
    const c = colors as Record<string, string | undefined>;
    return c.yellow ?? '#eab308';
  }, [colors]);

  if (!hasIssues) return null;

  return (
    <span className="inline-flex items-center gap-2">
      {counts.errors > 0 && (
        <button
          onClick={onClickErrors}
          className="inline-flex items-center gap-1 hover:opacity-80 transition-opacity cursor-pointer"
          title={`${counts.errors} error${counts.errors > 1 ? 's' : ''} — click to diagnose`}
        >
          <AlertCircle size={12} style={{ color: errorColor }} />
          <span style={{ color: errorColor }}>{counts.errors}</span>
        </button>
      )}
      {counts.warnings > 0 && (
        <button
          onClick={onClickWarnings}
          className="inline-flex items-center gap-1 hover:opacity-80 transition-opacity cursor-pointer"
          title={`${counts.warnings} warning${counts.warnings > 1 ? 's' : ''} — click to diagnose`}
        >
          <AlertTriangle size={12} style={{ color: warnColor }} />
          <span style={{ color: warnColor }}>{counts.warnings}</span>
        </button>
      )}
      <button
        onClick={onClear}
        className="hover:opacity-80 transition-opacity cursor-pointer"
        title="Clear diagnostics"
      >
        <Trash2 size={10} style={{ color: `${colors.foreground}60` }} />
      </button>
    </span>
  );
}
