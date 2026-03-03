import { useCallback, useRef, useState } from 'react';

/**
 * Diagnostic entry captured from terminal output.
 * Follows the Single Responsibility Principle — only holds parsed data.
 */
export interface DiagnosticEntry {
  id: number;
  type: 'error' | 'warning';
  /** The full line that matched */
  line: string;
  /** Timestamp when captured */
  timestamp: number;
}

/** Summary counts exposed by the hook */
export interface DiagnosticCounts {
  errors: number;
  warnings: number;
}

// ─── Patterns ────────────────────────────────────────────────
// Common error/warning patterns across shells, compilers, linters etc.
const ERROR_PATTERNS = [
  /\berror\b/i,
  /\bERR[!:]/i,
  /\bfatal\b/i,
  /\bFAILED\b/,
  /\bsegmentation fault\b/i,
  /\bcommand not found\b/i,
  /\bpermission denied\b/i,
  /\bno such file or directory\b/i,
  /\bconnection refused\b/i,
  /\bsyntax error\b/i,
  /\btraceback\b/i,
  /\bpanic:/i,
];

const WARNING_PATTERNS = [
  /\bwarning\b/i,
  /\bWARN[!:]/i,
  /\bdeprecated\b/i,
  /\bdeprecation\b/i,
];

// Lines that look like errors but are not (false-positive guard)
const IGNORE_PATTERNS = [
  /grep.*error/i,
  /echo.*error/i,
  /cat.*error/i,
  /if.*error/i,
  /test.*error/i,
  /--.*error/i,
];

function classify(line: string): 'error' | 'warning' | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length < 4) return null;

  // Skip false-positives
  for (const p of IGNORE_PATTERNS) {
    if (p.test(trimmed)) return null;
  }

  for (const p of ERROR_PATTERNS) {
    if (p.test(trimmed)) return 'error';
  }
  for (const p of WARNING_PATTERNS) {
    if (p.test(trimmed)) return 'warning';
  }
  return null;
}

/** Max entries to keep in memory */
const MAX_ENTRIES = 200;

/**
 * Hook that scans raw terminal output for errors and warnings.
 *
 * Open/Closed Principle: add new patterns to the arrays above
 * without changing the hook logic.
 *
 * Interface Segregation: callers only get { counts, entries, feed, clear }.
 */
export function useDiagnostics() {
  const [entries, setEntries] = useState<DiagnosticEntry[]>([]);
  const nextId = useRef(1);

  /**
   * Feed a chunk of terminal output (may contain \\n-separated lines).
   * Call this from the SSH_EMIT_DATA listener.
   */
  const feed = useCallback((chunk: string) => {
    // Strip ANSI escape codes for pattern matching
    const clean = chunk.replace(
      // eslint-disable-next-line no-control-regex
      /\x1b\[[0-9;]*[A-Za-z]|\x1b\].*?(?:\x07|\x1b\\)|\x1b[()][A-B012]|\r/g,
      '',
    );

    const lines = clean.split('\n');
    const newEntries: DiagnosticEntry[] = [];
    const now = Date.now();

    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;
      const type = classify(line);
      if (type) {
        newEntries.push({ id: nextId.current++, type, line, timestamp: now });
      }
    }

    if (newEntries.length > 0) {
      setEntries((prev) => {
        const combined = [...prev, ...newEntries];
        return combined.length > MAX_ENTRIES
          ? combined.slice(combined.length - MAX_ENTRIES)
          : combined;
      });
    }
  }, []);

  /** Clear all diagnostics */
  const clear = useCallback(() => {
    setEntries([]);
  }, []);

  /** Computed counts */
  const counts: DiagnosticCounts = {
    errors: entries.filter((e) => e.type === 'error').length,
    warnings: entries.filter((e) => e.type === 'warning').length,
  };

  return { entries, counts, feed, clear } as const;
}
