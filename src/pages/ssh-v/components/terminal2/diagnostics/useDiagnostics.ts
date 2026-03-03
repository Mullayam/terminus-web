import { useCallback, useRef, useState } from 'react';

/**
 * Diagnostic entry captured from terminal output.
 * Follows the Single Responsibility Principle — only holds parsed data.
 */
export interface DiagnosticEntry {
  id: number;
  type: 'error' | 'warning';
  /** The first line that matched the pattern */
  line: string;
  /** Additional context lines captured after the match (until next prompt) */
  context: string[];
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

// ─── Prompt detection ────────────────────────────────────────
// Matches common shell prompts: user@host:~$, root#, bash-5.1$, PS C:\>, etc.
const PROMPT_PATTERNS = [
  /^.*?[$#>]\s*$/,             // ends with $, #, or >
  /^.*@.*[:~].*[$#]\s*$/,     // user@host:~$
  /^\w+@\w+.*\$\s*$/,         // user@hostname ...$
  /^(bash|sh|zsh|fish)-?\d*.*[#$>]\s*$/i,
  /^PS\s+[A-Z]:\\/i,          // PowerShell prompt
];

function isPromptLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  return PROMPT_PATTERNS.some((p) => p.test(trimmed));
}

/** Max entries to keep in memory */
const MAX_ENTRIES = 200;

/**
 * Hook that scans raw terminal output for errors and warnings.
 * When an error/warning is detected, it captures all subsequent lines
 * until a shell prompt line appears — giving full stack trace context.
 *
 * Open/Closed Principle: add new patterns to the arrays above
 * without changing the hook logic.
 *
 * Interface Segregation: callers only get { counts, entries, feed, clear }.
 */
export function useDiagnostics() {
  const [entries, setEntries] = useState<DiagnosticEntry[]>([]);
  const nextId = useRef(1);

  // Track in-progress context capture across feed() calls
  const pendingRef = useRef<{
    entry: DiagnosticEntry;
    contextLines: string[];
  } | null>(null);

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

      // If we're capturing context for a previous error...
      if (pendingRef.current) {
        if (isPromptLine(line)) {
          // Prompt detected → finalize the pending entry with captured context
          pendingRef.current.entry.context = [...pendingRef.current.contextLines];
          newEntries.push(pendingRef.current.entry);
          pendingRef.current = null;
        } else {
          // Still in error output → accumulate context (max 150 lines)
          if (pendingRef.current.contextLines.length < 150) {
            pendingRef.current.contextLines.push(line);
          }

          // Also check if this line is a NEW error/warning
          const type = classify(line);
          if (type) {
            // Finalize previous pending with what we have so far
            pendingRef.current.entry.context = [...pendingRef.current.contextLines];
            newEntries.push(pendingRef.current.entry);
            // Start new pending
            pendingRef.current = {
              entry: { id: nextId.current++, type, line, context: [], timestamp: now },
              contextLines: [],
            };
          }
          continue;
        }
      }

      // Check if this line starts a new error/warning
      const type = classify(line);
      if (type) {
        // Start capturing context for this error
        pendingRef.current = {
          entry: { id: nextId.current++, type, line, context: [], timestamp: now },
          contextLines: [],
        };
      }
    }

    // If pending has been accumulating for a while (>150 lines), flush it
    if (pendingRef.current && pendingRef.current.contextLines.length >= 150) {
      pendingRef.current.entry.context = [...pendingRef.current.contextLines];
      newEntries.push(pendingRef.current.entry);
      pendingRef.current = null;
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

  // Flush any pending entry after 3s of no new data
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const feedWithFlush = useCallback((chunk: string) => {
    feed(chunk);

    // Reset flush timer
    if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
    flushTimerRef.current = setTimeout(() => {
      if (pendingRef.current) {
        pendingRef.current.entry.context = [...pendingRef.current.contextLines];
        setEntries((prev) => {
          const combined = [...prev, pendingRef.current!.entry];
          pendingRef.current = null;
          return combined.length > MAX_ENTRIES
            ? combined.slice(combined.length - MAX_ENTRIES)
            : combined;
        });
      }
    }, 3000);
  }, [feed]);

  /** Clear all diagnostics */
  const clear = useCallback(() => {
    setEntries([]);
  }, []);

  /** Computed counts */
  const counts: DiagnosticCounts = {
    errors: entries.filter((e) => e.type === 'error').length,
    warnings: entries.filter((e) => e.type === 'warning').length,
  };

  return { entries, counts, feed: feedWithFlush, clear } as const;
}
